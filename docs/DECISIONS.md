# LockIn — Catatan keputusan desain (17 November 2026)

## Bersumber dari proposal kelompok
- Marketplace event vendor, fokus awal Kota Malang dan jasa wisuda.
- Pembayaran via gateway sandbox dan pencatatan blockchain testnet.
- Simulasi dana tertahan hanya melalui ledger internal; bukan escrow riil.
- Smart contract tidak memegang rupiah, tidak ada pembayaran kripto.
- Aktor aplikasi final: pelanggan, vendor, admin.

## Hasil diskusi pengembangan
- MVP pertama: fotografer wisuda.
- Persetujuan vendor dibutuhkan sebelum pelanggan bisa membayar (Opsi B).
- Pembayaran: DP + satu kali pelunasan, bukan cicilan fleksibel.
- Tarif DP dapat diatur vendor pada aplikasi final; contoh 30% hanya dummy.
- Perjanjian terstruktur dan disetujui dua pihak; chat tidak wajib untuk MVP.

## Penyingkatan khusus Sprint 1
- Satu booking **dummy** sudah disetujui vendor, untuk fokus pada payment gateway + blockchain.
- Hanya pembayaran DP; pelunasan, autentikasi, refund, manajemen vendor, dan sengketa ditunda.
- Backend dipakai untuk verifikasi webhook dan pengiriman transaksi Sepolia.
- No personal user data or payment secrets stored on-chain.

## Hal yang belum diputuskan
- Aturan refund dan tenggat DP, pelunasan, persetujuan vendor, dan konfirmasi selesai.
- Persentase DP yang boleh dipilih vendor dan batasannya.
- Manajemen admin untuk sengketa dan kepatuhan produksi.
