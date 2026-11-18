# Progress Report — Checklist Bukti

- [ ] Website demo lokal terbuka di browser.
- [ ] Booking dummy dan nominal DP tampil (Rp300.000).
- [ ] Server mengirim request Snap sandbox, memperoleh URL checkout Midtrans.
- [ ] Melakukan satu pembayaran **sandbox** tanpa dana sungguhan.
- [ ] Endpoint webhook terpapar lewat HTTPS public tunnel dan dikonfigurasi di Midtrans Sandbox.
- [ ] Webhook diverifikasi; status payment berubah menjadi PAID (bukan dari return URL browser).
- [ ] Ledger internal demo menambah satu entri tertahan, tanpa transaksi ganda.
- [ ] Smart contract Solidity telah dikompilasi/di-deploy di Sepolia.
- [ ] Jika berhasil: worker backend mencatat bukti pembayaran ke smart contract dan ada tx hash.
- [ ] Siapkan foto/screenshot, commit Git, dan daftar kendala yang masih ada.

## Keterangan penting untuk dosen
Figma adalah rancangan antarmuka. Prototype ini menguji integrasi teknis. Jika hanya checkout yang selesai, sampaikan smart contract masih tahap pengembangan. Demo tidak mewakili layanan keuangan nyata.
