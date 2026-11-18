# LockIn — Sprint 1 (Payment Gateway + Blockchain PoC)

Project starter untuk tugas akhir Teknologi Blockchain dan Platform Keuangan Dijital.

## Apa yang sudah dibuat?

- Frontend React + Vite: halaman demo transaksi DP, status pembayaran, status Sepolia.
- Backend Node.js + Express: checkout Midtrans Snap **sandbox**, webhook signature SHA512, pencatatan status idempoten, ledger dana tertahan **simulasi**.
- Database SQLite: booking, payments, simulated ledger, blockchain outbox jobs.
- Solidity: `LockInBookingLog.sol`, mencatat hash referensi booking, hash perjanjian, dan referensi payment pada **Ethereum Sepolia testnet**; tanpa uang, token, data pribadi, atau escrow riil.
- Worker backend mengirim transaksi blockchain setelah status pembayaran diverifikasi. Jika jaringan gagal, job ditandai RETRY; pembayaran tidak dinyatakan gagal.

**Belum dites terhadap layanan Midtrans atau Sepolia sungguhan** di paket awal ini. Dibutuhkan akun/kunci sandbox, wallet khusus Sepolia, RPC, dan kontrak yang dideploy.

## 0. Prasyarat

- Node.js >=22.13 dan npm
- VS Code
- Akun Midtrans Sandbox + Server Key (jangan bagikan/chat/upload Git)
- Untuk blockchain: testnet Sepolia wallet khusus (bukan wallet utama), Sepolia ETH untuk gas, RPC Sepolia, Remix IDE
- Untuk webhook dari internet ke backend lokal: HTTPS tunnel yang tepercaya (mis. ngrok atau Cloudflare Tunnel); **tidak diperlukan untuk menampilkan UI awal**

## 1. Jalankan backend (Terminal 1)

Dari root `lockin-starter`, di terminal:

```bash
cd backend
npm install
```

Buat file `.env` dari `.env.example` (PowerShell: `Copy-Item .env.example .env`), lalu isi `MIDTRANS_SERVER_KEY` dengan **Server Key sandbox**.

```bash
npm run dev
```

Cek `http://127.0.0.1:4000/api/health`.

## 2. Jalankan frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Buka `http://127.0.0.1:5173` di browser. Website menunjukkan satu booking dummy yang telah disetujui vendor, tanggal dan nominal DP. Tombol pembayaran akan memperoleh URL dari Midtrans Sandbox. **Tanpa server key sandbox, checkout belum bisa dilakukan.**

## 3. Konfigurasi webhook Midtrans Sandbox

Webhook tidak bisa dipanggil oleh Midtrans bila backend hanya berada di `127.0.0.1`. Buka akses HTTPS melalui tunnel untuk port backend `4000`, lalu isi **Payment Notification URL** di dashboard Midtrans Sandbox:

```text
https://<alamat-publik-dari-tunnel>/webhooks/midtrans
```

**Catatan teknis:** server dalam starter hanya listen di `127.0.0.1` agar tidak terekspos LAN; tunnel lokal harus bisa menjangkau `127.0.0.1:4000`. Batasi penggunaan tunnel untuk pengujian. URL finish redirect opsional: kembalikan ke UI, tapi **jangan anggap parameter redirect sebagai bukti sukses pembayaran**. Status benar berasal dari webhook terverifikasi.

Lakukan transaksi **hanya di Midtrans sandbox**, mengikuti dokumentasi simulasi. Setelah notifikasi pembayaran sukses masuk, tunggu polling UI sekitar 4 detik. Status seharusnya PAID dan ledger bertambah Rp300.000 simulasi.

## 4. Deploy smart contract Sepolia dengan Remix

1. Buka `https://remix.ethereum.org`.
2. Buat `LockInBookingLog.sol` dan salin isi `contracts/LockInBookingLog.sol`.
3. Compile Solidity ^0.8.24.
4. Buat wallet khusus testnet untuk server writer, dan **jangan pernah commit private key**. Backend akan menggunakan wallet ini untuk menulis log ke Sepolia.
5. Deploy lewat `Injected Provider` di Remix, MetaMask sudah memilih Ethereum Sepolia, dengan test ETH. Parameter constructor `writer` adalah **alamat wallet server writer**.
6. Ambil deployed address dari Remix. Isi di `backend/.env`:

```ini
SEPOLIA_RPC_URL=https://<rpc-sepolia-anda>
SEPOLIA_WRITER_PRIVATE_KEY=<private-key-wallet-testnet-saja>
LOCKIN_CONTRACT_ADDRESS=0x<alamat-kontrak-deployed>
```

**Jangan gunakan seed phrase/private key wallet utama.** Gunakan wallet pengujian terpisah dan simpan `.env` lokal saja. Wallet writer perlu Sepolia ETH untuk biaya gas. Pastikan kontrak menerima address wallet server sebagai writer.

Restart backend. Worker memproses job blockchain tiap sekitar 15 detik dan mengecek receipt untuk transaksi yang sudah dikirim. Jika gagal (gas/RPC salah), lihat status RETRY di UI dan log backend. Transaksi blockchain hanya dikirim setelah pembayaran diterima oleh webhook tervalidasi.

## 5. Pengujian tanpa kredensial

Backend murni tidak bisa mengakses Midtrans tanpa sandbox Server Key. Namun unit test signature/status dapat dijalankan:

```bash
cd backend
npm test
```

**Jangan memalsukan screenshot pembayaran untuk presentasi.** Bila integrasi belum selesai, tunjukkan bagian yang benar-benar telah bekerja.

## 6. Batasan starter

- Hanya 1 booking dummy, 1 jenis pembayaran DP; vendor sudah menyetujui di data demo.
- Tidak ada login dan role-based access control. Jangan deploy ini sebagai produk publik.
- Tidak ada pelunasan, refund otomatis, atau dana riil ditahan.
- Pembuatan checkout ditahan oleh lock in-memory (cukup untuk proses demo tunggal); aplikasi produksi butuh kontrol concurrency terdistribusi.
- Status blockchain hanya bukti hash, bukan pelunasan atau settlement bank.
- Cek `docs/DECISIONS.md` dan `docs/DEMO_CHECKLIST.md` sebelum demo.

## Dokumentasi resmi

- Midtrans Snap: https://docs.midtrans.com/docs/snap-snap-integration-guide
- Midtrans Webhooks: https://docs.midtrans.com/docs/https-notification-webhooks
- Midtrans Sandbox: https://docs.midtrans.com/docs/testing-payment-on-sandbox
- ethers.js v6: https://docs.ethers.org/v6/getting-started/
- Remix: https://remix.ethereum.org
