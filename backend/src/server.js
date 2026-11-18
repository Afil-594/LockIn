import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { db, getBookingView, DEMO_BOOKING_ID } from './db.js';
import {
  createSnapPayment,
  fetchMidtransStatus,
  verifySignature,
  interpretNotification
} from './midtrans.js';
import { syncBlockchainJobs } from './blockchain.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_, res) => res.json({ ok: true, environment: 'SANDBOX_ONLY' }));
app.get('/api/demo', (_, res) => res.json(getBookingView(DEMO_BOOKING_ID)));
app.get('/api/bookings/:id', (req, res) => {
  const view = getBookingView(req.params.id);
  return view ? res.json(view) : res.status(404).json({ error: 'Booking tidak ditemukan.' });
});

let creatingCheckout = false; // Guard sederhana untuk satu booking PoC; nantinya gunakan lock/queue DB.
app.post('/api/bookings/:id/pay-dp', async (req, res) => {
  if (req.params.id !== DEMO_BOOKING_ID) return res.status(404).json({ error: 'Demo hanya punya satu booking.' });
  if (creatingCheckout) return res.status(409).json({ error: 'Checkout sedang dibuat, coba lagi.' });
  creatingCheckout = true;
  try {
    const view = getBookingView(req.params.id);
    if (
      view.dpPayment?.status === 'PAID' ||
      view.booking.status === 'FULLY_PAID'
    ) {
      return res.status(409).json({
        error: 'DP booking ini sudah dibayar.'
      });
    }
    if (view.payment?.status === 'PENDING' && view.payment.redirect_url) {
      return res.json({ redirect_url: view.payment.redirect_url, reused: true });
    }
    const orderId = `LOCKIN-DP-${randomUUID()}`; // <=50 karakter, unik per percobaan.
    const redirectUrl = await createSnapPayment({ orderId, amount: view.booking.dp_amount });
    db.prepare(`INSERT INTO payments (booking_id,provider_order_id,amount,status,redirect_url) VALUES(?,?,?,'PENDING',?)`)
      .run(view.booking.id, orderId, view.booking.dp_amount, redirectUrl);
    return res.json({ redirect_url: redirectUrl, reused: false });
  } catch (error) {
    console.error('Create checkout:', error.message);
    return res.status(502).json({ error: 'Gagal membuat checkout sandbox.', detail: error.message });
  } finally { creatingCheckout = false; }
});


app.post('/api/bookings/:id/pay-final', async (req, res) => {
  if (req.params.id !== DEMO_BOOKING_ID) {
    return res.status(404).json({
      error: 'Booking demo tidak ditemukan.'
    });
  }

  if (creatingCheckout) {
    return res.status(409).json({
      error: 'Checkout sedang dibuat, coba lagi.'
    });
  }

  creatingCheckout = true;

  try {
    const view = getBookingView(req.params.id);

    // Pelunasan hanya boleh dilakukan setelah DP dibayar
    if (!view || view.dpPayment?.status !== 'PAID') {
      return res.status(409).json({
        error: 'DP belum dibayar.'
      });
    }

    if (
      view.booking.status === 'FULLY_PAID' ||
      view.finalPayment?.status === 'PAID'
    ) {
      return res.status(409).json({
        error: 'Pelunasan sudah dibayar.'
      });
    }

    // Gunakan checkout lama jika masih pending
    if (
      view.finalPayment?.status === 'PENDING' &&
      view.finalPayment.redirect_url
    ) {
      return res.json({
        redirect_url: view.finalPayment.redirect_url,
        reused: true
      });
    }

    const amount = view.remainingAmount;

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(409).json({
        error: 'Jumlah pelunasan tidak valid.'
      });
    }

    const orderId = `LOCKIN-FINAL-${randomUUID()}`;

    const redirectUrl = await createSnapPayment({
      orderId,
      amount
    });

    db.prepare(`
      INSERT INTO payments (
        booking_id,
        provider_order_id,
        payment_type,
        amount,
        status,
        redirect_url
      )
      VALUES (?, ?, 'FINAL', ?, 'PENDING', ?)
    `).run(view.booking.id, orderId, amount, redirectUrl);

    return res.json({
      redirect_url: redirectUrl,
      reused: false
    });

  } catch (error) {
    console.error('Create final checkout:', error.message);

    return res.status(502).json({
      error: 'Gagal membuat checkout pelunasan sandbox.'
    });

  } finally {
    creatingCheckout = false;
  }
});

const recordNotification = db.transaction((notification) => {
  const payment = db.prepare('SELECT * FROM payments WHERE provider_order_id = ?').get(notification.order_id);
  if (!payment) return { status: 'ignored', reason: 'Unknown order_id' };
  const amount = Number(notification.gross_amount);
  if (!Number.isFinite(amount) || amount !== payment.amount) return { status: 'rejected', reason: 'Jumlah pembayaran tidak cocok.' };
  if (!['DP', 'FINAL'].includes(payment.payment_type)) {
    return {
      status: 'rejected',
      reason: 'Jenis pembayaran tidak dikenal.'
    };
  }

  if (payment.payment_type === 'FINAL') {
    const booking = db.prepare(
      'SELECT * FROM bookings WHERE id = ?'
    ).get(payment.booking_id);

    const dpPaid = db.prepare(`
      SELECT id FROM payments
      WHERE booking_id = ?
        AND payment_type = 'DP'
        AND status = 'PAID'
      LIMIT 1
    `).get(payment.booking_id);

    if (
      !booking ||
      !dpPaid ||
      payment.amount !== booking.total_amount - booking.dp_amount
    ) {
      return {
        status: 'rejected',
        reason: 'Syarat pelunasan tidak terpenuhi.'
      };
    }
  }
  const nextStatus = interpretNotification(notification);
  if (payment.status === 'PAID') return { status: 'duplicate', reason: 'Sudah tercatat PAID.' };
  // Jangan menurunkan state bila pending/failed yang datang terlambat.
  if (nextStatus === 'PENDING' && payment.status !== 'PENDING') return { status: 'ignored', reason: 'Status lebih lama.' };
  db.prepare('UPDATE payments SET status=?, paid_at=CASE WHEN ? = \'PAID\' THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE id=?')
    .run(nextStatus, nextStatus, payment.id);
  if (nextStatus === 'PAID') {
    const bookingStatus =
      payment.payment_type === 'FINAL' ? 'FULLY_PAID' : 'DP_PAID';

    db.prepare(`
      UPDATE bookings
      SET status = ?
      WHERE id = ? AND status <> 'FULLY_PAID'
    `).run(bookingStatus, payment.booking_id);
    db.prepare(`INSERT OR IGNORE INTO ledger_entries(booking_id,payment_id,entry_type,amount)
      VALUES(?,?,'SIMULATED_HELD',?)`).run(payment.booking_id, payment.id, payment.amount);
    db.prepare(`INSERT OR IGNORE INTO blockchain_jobs(booking_id,payment_id,status) VALUES(?,?,'QUEUED')`)
      .run(payment.booking_id, payment.id);
  }
  return { status: 'updated', paymentStatus: nextStatus };
});

app.post('/api/bookings/:id/sync-payment', async (req, res) => {
  if (req.params.id !== DEMO_BOOKING_ID) {
    return res.status(404).json({
      error: "Booking tidak ditemukan"
    });
  }

  const view = getBookingView(DEMO_BOOKING_ID);
  const paymentToSync = view?.finalPayment ?? view?.dpPayment;

  if (!paymentToSync) {
    return res.status(404).json({
      error: "Belum ada transaksi pembayaran"
    });
  }

  try {
    const status = await fetchMidtransStatus(
      paymentToSync.provider_order_id
    );

    if (
      status.order_id !== paymentToSync.provider_order_id ||
      Number(status.gross_amount) !== paymentToSync.amount
    ) {
      return res.status(409).json({
        error: "Data pembayaran tidak sesuai"
      });
    }

    const result = recordNotification(status);

    if (result.status === "rejected") {
      return res.status(409).json({
        error: result.reason
      });
    }

    return res.json({
      result,
      data: getBookingView(DEMO_BOOKING_ID)
    });

  } catch (error) {
    console.error("Sync payment:", error.message);

    return res.status(502).json({
      error: "Gagal memeriksa pembayaran",
      detail: error.message
    });
  }
});

app.post('/webhooks/midtrans', (req, res) => {
  const key = process.env.MIDTRANS_SIGNATURE_SECRET_KEY;

  if (!key) {
    return res.status(503).json({
      error: 'Signature Secret Key belum diatur.'
    });
  }

  if (!verifySignature(req.body, key)) {
    return res.status(403).json({
      error: 'Signature Midtrans tidak valid.'
    });
  }
  try {
    const result = recordNotification(req.body);
    if (result.status === 'rejected') return res.status(400).json(result);
    return res.status(200).json(result); // balas cepat; blockchain diproses oleh worker.
  } catch (error) {
    console.error('Webhook:', error.message);
    return res.status(500).json({ error: 'Webhook tidak dapat diproses.' });
  }
});

// Mengembalikan pelanggan ke website LockIn
app.get('/payment/return', (req, res) => {
  res.redirect(302, 'http://127.0.0.1:5173/');
});

const port = Number(process.env.PORT || 4000);
app.listen(port, '127.0.0.1', () => {
  console.log(`LockIn sandbox backend: http://127.0.0.1:${port}`);
  console.log('Blockchain writer:', process.env.LOCKIN_CONTRACT_ADDRESS ? 'configured' : 'belum diatur');
});
setInterval(() => { syncBlockchainJobs().catch(err => console.error('Worker:',err.message)); }, 15000).unref();
