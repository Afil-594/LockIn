
import React, { useEffect, useState } from "react";

const rupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

function Badge({ children }) {
  return <span className="badge">{children}</span>;
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    try {
      const response = await fetch("/api/demo");

      if (!response.ok) {
        throw new Error(
          "Backend tidak merespons. Jalankan server backend terlebih dahulu."
        );
      }

      setData(await response.json());
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();

    const interval = setInterval(refresh, 4000);

    return () => clearInterval(interval);
  }, []);

  async function syncPayment() {
    if (!data?.payment && !data?.finalPayment) {
      return refresh();
    }

    setSyncing(true);

    try {
      const response = await fetch(
        `/api/bookings/${data.booking.id}/sync-payment`,
        { method: "POST" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal sinkronisasi pembayaran.");
      }

      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function startPayment(type) {
    if (!data?.booking?.id) return;

    setLoading(type);
    setError("");

    const endpoint =
      type === "FINAL" ? "pay-final" : "pay-dp";

    try {
      const response = await fetch(
        `/api/bookings/${data.booking.id}/${endpoint}`,
        { method: "POST" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error +
            (result.detail ? ` (${result.detail})` : "")
        );
      }

      window.location.assign(result.redirect_url);
    } catch (err) {
      setError(err.message);
      setLoading("");
    }
  }

  const booking = data?.booking;

  const dpPayment = data?.dpPayment ?? data?.payment;
  const dpBlockchain = data?.dpBlockchain ?? data?.blockchain;

  const finalPayment = data?.finalPayment;
  const finalBlockchain = data?.finalBlockchain;

  const dpPaid = dpPayment?.status === "PAID";
  const finalPaid =
    finalPayment?.status === "PAID" ||
    booking?.status === "FULLY_PAID";

  const remainingAmount = finalPaid
    ? 0
    : data?.remainingAmount ?? 0;

  return (
    <div className="shell">
      <header>
        <div className="logo">
          Lock<span>In</span>
          <span className="dot">.</span>
        </div>

        <Badge>Sandbox &amp; Sepolia Testnet</Badge>
      </header>

      <main>
        <div className="hero">
          <p className="eyebrow">
            PROOF OF CONCEPT · PEMBAYARAN DP & PELUNASAN
          </p>

          <h1>
            Booking nyaman.
            <br />
            <em>Bayar lebih aman.</em>
          </h1>

          <p>
            Demonstrasi pembayaran DP dan pelunasan melalui
            Midtrans Sandbox dengan pencatatan bukti transaksi
            pada Ethereum Sepolia.
          </p>
        </div>

        {error && <div className="alert">{error}</div>}

        {!data ? (
          <div className="panel">
            Menghubungkan ke backend…
          </div>
        ) : (
          <div className="layout">
            <section className="panel">
              <div className="paneltop">
                <span>BOOKING DEMO</span>
                <Badge>Vendor sudah setuju</Badge>
              </div>

              <h2>{booking.service}</h2>

              <p className="muted">
                {booking.vendor} · Malang
              </p>

              <dl>
                <div>
                  <dt>ID Booking</dt>
                  <dd>{booking.id}</dd>
                </div>

                <div>
                  <dt>Tanggal acara</dt>
                  <dd>{booking.event_date}</dd>
                </div>

                <div>
                  <dt>Total paket</dt>
                  <dd>{rupiah(booking.total_amount)}</dd>
                </div>

                <div>
                  <dt>DP (30%)</dt>
                  <dd>{rupiah(booking.dp_amount)}</dd>
                </div>

                <div>
                  <dt>Sisa tagihan</dt>
                  <dd className="important">
                    {rupiah(remainingAmount)}
                  </dd>
                </div>
              </dl>

              <div className="agreement">
                <strong>Perjanjian digital (demo)</strong>

                <p>
                  Harga dan DP menggunakan data kesepakatan
                  dummy. Ketentuan refund final belum
                  ditentukan. Tidak ada uang sungguhan.
                </p>

                <code>
                  SHA-256: {booking.agreement_hash}
                </code>
              </div>

              <h3>Pembayaran DP</h3>

              <p className="muted">
                Pembayaran awal sebesar{" "}
                {rupiah(booking.dp_amount)}.
              </p>

              <button
                className="pay"
                onClick={() => startPayment("DP")}
                disabled={
                  Boolean(loading) ||
                  dpPaid ||
                  finalPaid
                }
              >
                {dpPaid
                  ? "DP sudah dibayar"
                  : loading === "DP"
                  ? "Memuat checkout DP…"
                  : `Bayar DP ${rupiah(booking.dp_amount)}`}
              </button>

              {dpPaid && (
                <>
                  <h3>Pembayaran Pelunasan</h3>

                  <p className="muted">
                    DP telah dibayar. Pelanggan dapat
                    melunasi sisa pembayaran sebesar{" "}
                    {rupiah(
                      data.remainingAmount
                    )}.
                  </p>

                  <button
                    className="pay"
                    onClick={() => startPayment("FINAL")}
                    disabled={
                      Boolean(loading) || finalPaid
                    }
                  >
                    {finalPaid
                      ? "Pelunasan sudah dibayar"
                      : loading === "FINAL"
                      ? "Memuat checkout pelunasan…"
                      : `Bayar Pelunasan ${rupiah(
                          data.remainingAmount
                        )}`}
                  </button>
                </>
              )}

              <p className="footnote">
                Semua pembayaran menggunakan Midtrans
                Sandbox. Ledger hanya simulasi dan tidak
                menyimpan dana pelanggan sungguhan.
              </p>
            </section>

            <aside className="panel status">
              <div className="paneltop">
                <span>STATUS SISTEM</span>

                <button
                  className="refresh"
                  onClick={syncPayment}
                  disabled={syncing}
                >
                  {syncing ? "Memeriksa…" : "Perbarui"}
                </button>
              </div>

              <div className="step">
                <span className="circle">1</span>
                <div>
                  <b>Booking</b>
                  <p>{booking.status}</p>
                </div>
              </div>

              <div className="step">
                <span className="circle">2</span>
                <div>
                  <b>Pembayaran DP</b>
                  <p>
                    {dpPayment?.status ??
                      "BELUM ADA TRANSAKSI"}
                  </p>
                </div>
              </div>

              <div className="step">
                <span className="circle">3</span>
                <div>
                  <b>Blockchain DP</b>
                  <p>
                    {dpBlockchain?.status ??
                      "BELUM DIJADWALKAN"}
                  </p>
                </div>
              </div>

              {dpBlockchain?.tx_hash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${dpBlockchain.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="explorer"
                >
                  Lihat transaksi DP di Sepolia Etherscan ↗
                </a>
              )}

              {dpPaid && (
                <>
                  <div className="step">
                    <span className="circle">4</span>
                    <div>
                      <b>Pembayaran Pelunasan</b>
                      <p>
                        {finalPayment?.status ??
                          "BELUM ADA TRANSAKSI"}
                      </p>
                    </div>
                  </div>

                  <div className="step">
                    <span className="circle">5</span>
                    <div>
                      <b>Blockchain Pelunasan</b>
                      <p>
                        {finalBlockchain?.status ??
                          "BELUM DIJADWALKAN"}
                      </p>
                    </div>
                  </div>

                  {finalBlockchain?.tx_hash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${finalBlockchain.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="explorer"
                    >
                      Lihat transaksi pelunasan di Sepolia Etherscan ↗
                    </a>
                  )}
                </>
              )}

              <div className="step">
                <span className="circle">
                  {dpPaid ? "6" : "4"}
                </span>

                <div>
                  <b>Ledger internal (simulasi)</b>

                  <p>
                    Total dana tercatat:{" "}
                    {rupiah(data.simulatedHeldAmount)}
                  </p>
                </div>
              </div>

              {dpBlockchain?.last_error && (
                <p className="warning">
                  Blockchain DP:{" "}
                  {dpBlockchain.last_error}
                </p>
              )}

              {finalBlockchain?.last_error && (
                <p className="warning">
                  Blockchain pelunasan:{" "}
                  {finalBlockchain.last_error}
                </p>
              )}

              {dpPayment?.status === "PENDING" && (
                <p className="muted">
                  Pembayaran DP masih menunggu.{" "}
                  <a
                    href={dpPayment.redirect_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lanjutkan pembayaran DP sandbox
                  </a>
                  .
                </p>
              )}

              {finalPayment?.status === "PENDING" && (
                <p className="muted">
                  Pelunasan masih menunggu.{" "}
                  <a
                    href={finalPayment.redirect_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lanjutkan pembayaran pelunasan sandbox
                  </a>
                  .
                </p>
              )}
            </aside>
          </div>
        )}
      </main>

      <footer>
        LockIn · Demo akademik · Midtrans Sandbox ·
        Ethereum Sepolia · Tidak ada dana pelanggan
        yang ditahan
      </footer>
    </div>
  );
}
