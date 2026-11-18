import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const dbDir = path.resolve(process.cwd(), 'data');
fs.mkdirSync(dbDir, { recursive: true });
export const db = new Database(path.join(dbDir, 'lockin.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  vendor TEXT NOT NULL,
  service TEXT NOT NULL,
  event_date TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  dp_amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  agreement_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  provider_order_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  redirect_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);
CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  payment_id INTEGER NOT NULL UNIQUE REFERENCES payments(id),
  entry_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS blockchain_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  payment_id INTEGER NOT NULL UNIQUE REFERENCES payments(id),
  status TEXT NOT NULL DEFAULT 'QUEUED',
  tx_hash TEXT,
  last_error TEXT,
  retry_after INTEGER NOT NULL DEFAULT 0
);
`);

// Migrasi: membedakan pembayaran DP dan pelunasan
const paymentColumns = db.pragma("table_info(payments)");

if (!paymentColumns.some(column => column.name === "payment_type")) {
  db.exec(`
    ALTER TABLE payments
    ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'DP'
    CHECK (payment_type IN ('DP', 'FINAL'))
  `);
}

const bookingId = 'LOCKIN-DEMO-003';
const terms = {
  bookingId,
  vendor: 'Lensa Wisuda Malang (dummy)',
  service: 'Paket Foto Wisuda 2 Jam',
  date: '2026-12-10',
  totalAmount: 1000000,
  dpAmount: 300000,
  refundRule: 'Simulasi saja; aturan refund final belum ditentukan.',
  vendorApproval: true
};
const agreementHash = crypto.createHash('sha256').update(JSON.stringify(terms)).digest('hex');
db.prepare(`INSERT OR IGNORE INTO bookings
 (id, vendor, service, event_date, total_amount, dp_amount, status, agreement_hash)
 VALUES (?, ?, ?, ?, ?, ?, 'APPROVED_AWAITING_DP', ?)`)
 .run(bookingId, terms.vendor, terms.service, terms.date, terms.totalAmount, terms.dpAmount, agreementHash);


export function getBookingView(id) {
  const booking = db.prepare(
    "SELECT * FROM bookings WHERE id = ?"
  ).get(id);

  if (!booking) return null;

  const findPayment = (type) => {
    return db.prepare(`
      SELECT *
      FROM payments
      WHERE booking_id = ? AND payment_type = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(id, type) || null;
  };

  const findBlockchainJob = (payment) => {
    if (!payment) return null;

    return db.prepare(`
      SELECT status, tx_hash, last_error
      FROM blockchain_jobs
      WHERE payment_id = ?
    `).get(payment.id) || null;
  };

  const dpPayment = findPayment("DP");
  const finalPayment = findPayment("FINAL");

  const dpBlockchain = findBlockchainJob(dpPayment);
  const finalBlockchain = findBlockchainJob(finalPayment);

  const held = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM ledger_entries
    WHERE booking_id = ?
      AND entry_type = 'SIMULATED_HELD'
  `).get(id).total;

  const remainingAmount =
    booking.total_amount - booking.dp_amount;

  return {
    booking,

    // Kompatibilitas dengan frontend DP lama
    payment: dpPayment,
    blockchain: dpBlockchain,

    // Data terpisah untuk pengembangan berikutnya
    dpPayment,
    dpBlockchain,
    finalPayment,
    finalBlockchain,
    remainingAmount,

    simulatedHeldAmount: held
  };
}

export const DEMO_BOOKING_ID = bookingId;
