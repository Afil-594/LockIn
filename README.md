# LockIn — Payment Gateway & Blockchain Prototype

LockIn merupakan prototipe marketplace penyedia jasa acara, dengan fokus awal pada layanan fotografi wisuda. Proyek ini dikembangkan untuk Tugas Akhir mata kuliah **Teknologi Blockchain dan Platform Keuangan Dijital**, Universitas Brawijaya.

LockIn dirancang untuk membantu pelanggan dan vendor membuat kesepakatan pemesanan yang jelas, melakukan pembayaran DP dan pelunasan, serta mencatat bukti transaksi menggunakan blockchain.

## 1. Status Pengembangan

**Status saat ini: Proof of Concept (PoC)**

Implementasi dasar payment gateway dan blockchain telah berhasil dibuat, diintegrasikan, dan diuji. Namun, aplikasi belum mencakup seluruh fitur marketplace yang direncanakan dalam proposal.

### Fitur yang sudah diimplementasikan

- Checkout pembayaran DP menggunakan Midtrans Sandbox.
- Checkout pelunasan setelah DP berhasil dibayar.
- Penerimaan webhook Midtrans dan verifikasi signature.
- Sinkronisasi status pembayaran melalui Midtrans Status API.
- Penanganan status pembayaran berhasil, pending, gagal, dan expired.
- Pencegahan pencatatan transaksi ganda pada alur yang telah diuji.
- Database SQLite untuk booking, pembayaran, ledger, dan blockchain jobs.
- Pencatatan dana tertahan secara simulasi (`SIMULATED_HELD`).
- Smart contract pencatatan DP pada Ethereum Sepolia.
- Smart contract pencatatan pelunasan pada Ethereum Sepolia.
- Worker backend untuk mengirim transaksi blockchain dan melakukan retry.
- Tampilan status pembayaran dan tautan transaksi Etherscan.
- Unit test serta script audit kesesuaian database dengan blockchain.

### Fitur yang belum diimplementasikan

- Katalog dan pencarian vendor.
- Pendaftaran, login, dan hak akses pelanggan, vendor, serta admin.
- Pembuatan booking secara dinamis melalui website.
- Persetujuan booking oleh vendor.
- Perjanjian digital yang disimpan dan disetujui kedua pihak.
- Kalender ketersediaan vendor.
- Aturan pembatalan dan refund.
- Simulasi pencairan dana kepada vendor.
- Manajemen sengketa.
- Dashboard berdasarkan peran pengguna.
- Laporan rekonsiliasi yang dapat digunakan melalui aplikasi.
- Verifikasi blockchain melalui antarmuka pengguna.
- Pencatatan perubahan status booking secara lebih lengkap pada blockchain.

## 2. Teknologi yang Digunakan

| Komponen | Teknologi |
|---|---|
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Database | SQLite, better-sqlite3 |
| Payment gateway | Midtrans Snap Sandbox |
| Blockchain | Ethereum Sepolia Testnet |
| Smart contract | Solidity |
| Interaksi blockchain | ethers.js |
| Deployment smart contract | Remix IDE, MetaMask |
| Testing | Node.js Test Runner, script audit |

## 3. Alur Prototipe Saat Ini

1. Backend menyediakan satu booking demo dari database lokal.
2. Pelanggan membuka halaman demo LockIn.
3. Pelanggan melakukan pembayaran DP melalui Midtrans Sandbox.
4. Backend menerima webhook atau mengambil status transaksi dari Midtrans.
5. Setelah pembayaran terverifikasi, status pembayaran diperbarui dan ledger simulasi dicatat.
6. Blockchain worker mencatat bukti pembayaran DP ke smart contract Sepolia.
7. Setelah DP dibayar, pelanggan dapat melakukan pelunasan.
8. Pembayaran pelunasan yang berhasil dicatat pada smart contract Sepolia yang terpisah.
9. Pengguna dapat melihat status transaksi dan tautan Etherscan.

**Catatan:** Smart contract berfungsi sebagai pencatat bukti transaksi. Dana rupiah tidak disimpan di blockchain. Fitur dana tertahan masih berupa simulasi pencatatan pada database, bukan escrow atau pencairan dana sungguhan.

## 4. Struktur Proyek

```text
lockin-starter/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── db.js
│   │   ├── midtrans.js
│   │   └── blockchain.js
│   ├── test/
│   ├── audit-lockin.mjs
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
├── contracts/
│   ├── LockInBookingLog.sol
│   └── LockInFinalPaymentLog.sol
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   └── DEMO_CHECKLIST.md
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── style.css
│   ├── package.json
│   └── package-lock.json
├── .gitignore
└── README.md
```

## 5. Cara Menjalankan Proyek

### Prasyarat

- Node.js dan npm (disarankan Node.js 22 atau versi yang kompatibel).
- Git.
- VS Code atau editor lain.

Akun Midtrans, wallet, dan RPC Sepolia hanya diperlukan untuk pengujian integrasi terkait.

### A. Clone repository

Clone repository ini melalui URL HTTPS pada menu **Code** di GitHub.

Buka folder proyek pada VS Code.

### B. Jalankan backend

Buka terminal pertama:

```bash
cd backend
npm install
```

Buat file `.env` berdasarkan `.env.example`.

Untuk pengguna Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Isi konfigurasi sesuai kebutuhan pengujian masing-masing. Jangan memasukkan kredensial asli ke `.env.example`.

Jalankan backend:

```bash
npm run dev
```

Backend berjalan pada:

```text
http://127.0.0.1:4000
```

Cek endpoint:

```text
http://127.0.0.1:4000/api/health
```

Database SQLite lokal akan dibuat oleh kode backend jika belum tersedia. Database yang baru dibuat tidak otomatis berisi transaksi pengujian anggota lain.

### C. Jalankan frontend

Buka terminal kedua dari folder utama proyek:

```bash
cd frontend
npm install
npm run dev
```

Buka:

```text
http://127.0.0.1:5173
```

Frontend dapat dikembangkan tanpa kredensial Midtrans atau Sepolia, tetapi checkout dan pencatatan blockchain memerlukan konfigurasi integrasi yang valid.

## 6. Konfigurasi Environment

File `backend/.env.example` berisi daftar variabel konfigurasi tanpa nilai rahasia.

| Variabel | Fungsi |
|---|---|
| `PORT` | Port backend, default 4000 |
| `MIDTRANS_SERVER_KEY` | Server Key Midtrans Sandbox |
| `MIDTRANS_SIGNATURE_SECRET_KEY` | Server Key Sandbox yang sama, digunakan untuk verifikasi signature pada implementasi saat ini |
| `SEPOLIA_RPC_URL` | Endpoint JSON-RPC Ethereum Sepolia |
| `SEPOLIA_WRITER_PRIVATE_KEY` | Private key wallet khusus pengujian yang diizinkan menulis ke smart contract |
| `SEPOLIA_DP_CONTRACT_ADDRESS` | Alamat kontrak pencatatan DP |
| `SEPOLIA_FINAL_CONTRACT_ADDRESS` | Alamat kontrak pencatatan pelunasan |

**Jangan commit file `.env`, private key, seed phrase, atau kredensial asli ke GitHub.**

### Pengujian Midtrans

Anggota yang akan menguji pembayaran perlu:

1. Membuat atau menggunakan akun Midtrans Sandbox.
2. Mengambil Server Key dari lingkungan Sandbox.
3. Mengisi konfigurasi Midtrans pada `.env`.
4. Menjalankan backend dan frontend.
5. Melakukan transaksi menggunakan metode pembayaran pengujian yang disediakan Midtrans.

Agar webhook dari Midtrans dapat mencapai backend lokal, gunakan HTTPS tunnel seperti ngrok dan arahkan Payment Notification URL ke:

```text
https://ALAMAT-TUNNEL/webhooks/midtrans
```

Tanpa URL publik yang dapat dijangkau Midtrans, webhook tidak akan masuk ke backend lokal. Fitur sinkronisasi status pembayaran dapat digunakan sebagai bantuan pengujian, tetapi bukan pengganti implementasi webhook.

### Pengujian Blockchain

Anggota yang akan menguji pencatatan blockchain secara mandiri perlu:

1. Menyiapkan wallet khusus Ethereum Sepolia.
2. Memperoleh Sepolia ETH untuk biaya gas pengujian.
3. Menyiapkan endpoint RPC Sepolia.
4. Membuka Remix IDE dan mengompilasi kedua file Solidity pada folder `contracts`.
5. Men-deploy kontrak DP dan FINAL ke Sepolia.
6. Mengisi parameter constructor `writer` dengan alamat wallet yang private key-nya akan digunakan oleh backend.
7. Mengisi kedua alamat kontrak hasil deployment ke `.env`.
8. Menjalankan backend dan menguji pembayaran menggunakan Midtrans Sandbox.

Wallet yang baru dibuat tidak otomatis mempunyai izin menulis pada smart contract milik anggota lain. Hak akses writer ditetapkan saat kontrak di-deploy.

Untuk menghindari pencampuran hasil pengujian, gunakan Booking ID demo yang berbeda antaranggota apabila melakukan pengujian mandiri dengan database dan kontrak masing-masing.

## 7. Testing

Jalankan pengujian otomatis dari folder `backend`:

```bash
npm test
```

Untuk melakukan audit transaksi yang telah tercatat di database dan blockchain:

```bash
node audit-lockin.mjs
```

Audit blockchain membutuhkan konfigurasi RPC, alamat kontrak, serta transaksi yang memang sudah tercatat.

Skenario pengujian yang perlu dipertahankan atau diperluas:

- Pembayaran berhasil.
- Pembayaran pending.
- Pembayaran gagal atau dibatalkan.
- Pembayaran expired.
- Webhook dengan signature tidak valid.
- Webhook yang diterima lebih dari sekali.
- Pencegahan pembayaran ganda.
- Pencatatan blockchain DP dan FINAL.
- Penanganan kegagalan sementara RPC.
- Konsistensi status booking, pembayaran, ledger, dan blockchain.

## 8. Rencana Pengembangan

### Prioritas 1 — Marketplace dan Booking

**Target:** pengguna dapat memilih vendor dan membuat booking sendiri.

Pekerjaan:
- Membuat data vendor, layanan, harga, dan ketersediaan.
- Menambahkan tabel yang diperlukan pada `backend/src/db.js`.
- Membuat endpoint untuk melihat vendor dan membuat booking.
- Mengembangkan halaman katalog dan formulir booking di frontend.
- Menghasilkan Booking ID unik secara otomatis.

**Selesai jika:** booking baru dapat dibuat melalui website dan tersimpan di database tanpa harus mengubah kode seed secara manual.

### Prioritas 2 — Persetujuan dan Perjanjian Digital

**Target:** pelanggan dan vendor menyetujui informasi booking sebelum DP dibayar.

Pekerjaan:
- Menentukan struktur perjanjian: layanan, harga, tanggal, DP, pelunasan, dan aturan refund.
- Menyimpan isi perjanjian pada database.
- Menyediakan tindakan persetujuan pelanggan dan vendor.
- Menghasilkan hash dari isi perjanjian final yang telah disetujui.
- Menghubungkan hash tersebut dengan pencatatan blockchain.
- Mencegah perubahan sepihak setelah perjanjian dikunci.

**Selesai jika:** sistem memiliki bukti isi perjanjian serta status persetujuan kedua pihak, bukan hanya hash dari data dummy.

### Prioritas 3 — Pembatalan, Refund, dan Pencairan

**Target:** dana simulasi diproses sesuai aturan perjanjian.

Pekerjaan:
- Menentukan kebijakan pembatalan dan perhitungan refund.
- Membuat status booking tambahan untuk pembatalan dan penyelesaian.
- Mencatat refund pada ledger simulasi.
- Membuat konfirmasi penyelesaian layanan.
- Mengimplementasikan simulasi pencairan ke vendor setelah syarat terpenuhi.
- Menambahkan kondisi sengketa apabila diperlukan.

**Selesai jika:** setiap perubahan saldo simulasi dapat ditelusuri berdasarkan booking dan aturan perjanjian.

Tidak perlu membuat transfer dana sungguhan untuk memenuhi kebutuhan prototipe ini.

### Prioritas 4 — Dashboard dan Rekonsiliasi

**Target:** pelanggan, vendor, dan admin dapat melihat informasi sesuai kebutuhan.

Pekerjaan:
- Membuat tampilan daftar booking dan statusnya.
- Menampilkan status pembayaran DP dan pelunasan.
- Menampilkan riwayat ledger dan blockchain.
- Membuat laporan rekonsiliasi yang membandingkan pembayaran, ledger, dan blockchain jobs.
- Menyediakan hasil laporan dalam tabel atau ekspor sederhana.

**Selesai jika:** status transaksi dapat diperiksa melalui aplikasi tanpa harus membaca database secara manual.

### Prioritas 5 — Verifikasi Blockchain

**Target:** bukti transaksi dapat diverifikasi melalui antarmuka LockIn.

Pekerjaan:
- Menampilkan transaction hash dan tautan Etherscan.
- Mengambil atau memeriksa receipt dan event smart contract.
- Mencocokkan hash booking, pembayaran, dan perjanjian dengan data aplikasi.
- Menampilkan hasil verifikasi kepada pengguna.

**Selesai jika:** pengguna dapat mengetahui apakah bukti transaksi yang ditampilkan aplikasi sesuai dengan transaksi yang tercatat di Sepolia.

### Prioritas 6 — Dokumentasi dan Persiapan Demo

Pekerjaan:
- Melengkapi user stories dan acceptance criteria.
- Membuat atau memperbarui ERD.
- Memperbarui diagram arsitektur sistem.
- Mendokumentasikan endpoint API dan alur webhook.
- Mendokumentasikan smart contract dan hasil pengujian.
- Mencatat keputusan pengembangan dan kontribusi anggota.
- Menyertakan pernyataan penggunaan AI dan proses verifikasinya.
- Menyiapkan screenshot, video, dan skenario demo.

## 9. Cara Berkontribusi

Repository ini bersifat publik, tetapi akses push langsung tidak diberikan secara otomatis.

Anggota yang belum memiliki akses collaborator dapat menggunakan alur **Fork → Branch → Commit → Pull Request**.

1. Fork repository ke akun GitHub masing-masing.
2. Clone repository hasil fork.
3. Buat branch baru sesuai fitur, misalnya `feat/vendor-catalog`.
4. Kerjakan fitur dan lakukan testing.
5. Commit perubahan dengan pesan yang menjelaskan pekerjaan.
6. Push branch ke repository fork.
7. Buat Pull Request ke repository utama.
8. Lakukan review sebelum perubahan digabungkan.

Contoh nama branch:

- `feat/vendor-catalog`
- `feat/booking-flow`
- `feat/digital-agreement`
- `feat/refund-ledger`
- `feat/dashboard`
- `docs/api-documentation`

Hindari mengubah bagian payment gateway atau blockchain yang sudah berfungsi tanpa melakukan pengujian ulang.

Setiap anggota diharapkan memiliki riwayat commit yang memperlihatkan kontribusi masing-masing, sesuai ketentuan tugas akhir.

## 10. Batasan Prototipe

- Seluruh pembayaran menggunakan Midtrans Sandbox.
- Seluruh transaksi blockchain menggunakan Ethereum Sepolia Testnet.
- Data booking yang tersedia saat ini masih berupa data demo.
- Belum terdapat autentikasi dan otorisasi pengguna yang lengkap.
- Dana tertahan masih merupakan simulasi ledger lokal.
- Smart contract tidak menerima, menyimpan, atau mengirim rupiah.
- Hash perjanjian belum membuktikan persetujuan digital kedua pihak.
- Prototipe belum siap digunakan sebagai layanan keuangan publik.

## 11. Referensi Pengembangan

- [Midtrans Documentation](https://docs.midtrans.com/)
- [Midtrans Webhooks](https://docs.midtrans.com/docs/https-notification-webhooks)
- [Remix IDE](https://remix.ethereum.org/)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Ethereum Sepolia Explorer](https://sepolia.etherscan.io/)

---

**LockIn — Academic Prototype**

Dikembangkan sebagai proyek pembelajaran dan demonstrasi integrasi marketplace, payment gateway, dan blockchain.