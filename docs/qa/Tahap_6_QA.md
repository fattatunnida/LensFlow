# QA Tahap 6 — Beranda, Inbox dan Regresi Operasional

26 Oktober 2026. QA Tahap 5 dipertahankan di `docs/qa/Tahap_5_QA.md`. Lingkungan: Expo SDK 58 web, Chromium headless terpisah, Auth/Firestore/Functions emulator demo-lensflow. Tidak ada deployment cloud atau pemasangan perangkat fisik.

## Hasil

- `npm run lint`: lulus tanpa warning.
- `npm run typecheck`: lulus.
- 30 test aplikasi + 66 integrasi emulator = **96 lulus**.
- 1 skenario E2E mobile web lintas modul: lulus.
- Ekspor bundle Android/iOS/web: lulus. Ini bukan pengujian runtime native.
- Worker inbox lokal scoped sekali jalan: processed 1, skipped 0, pending false.

## Bukti otomatis layanan

Dashboard: jumlah confirmed/done mengecualikan batal; kas bruto/refund menurut effectiveDate WIB dihitung dari ledger tanpa cache harian. Booking/CRM tidak menerima field nominal; pembayaran/laporan tidak menerima jadwal tanpa izin tambahan. Anonim, membership nonaktif, studio lain dan field injeksi ditolak.

Inbox: batas waktu 07/09 WIB, H-1/H-3 unpaid saja, item harian/penerimaan/reminder deterministik, dua sync concurrent tidak menduplikasi. First readAt tetap saat retry. Saldo reminder mengikuti perubahan terbaru; lunas/batal/ganti tanggal tersembunyi dan tidak bisa dibuka. Penarikan izin atau business flag menyembunyikan item lama. Preferensi scoped/versioned, off/on pembayaran tidak melakukan backfill periode nonaktif. Cursor timestamp sama melewati 25 item tanpa hilang/duplikasi, retensi 30 hari, worker berhenti/melanjutkan checkpoint. Baca/tulis langsung inbox/preferences/state ditolak termasuk owner. SDK aplikasi memanggil keempat callable melalui shared Firebase client.

Seluruh regresi backend tahap sebelumnya tetap lulus: booking slot/version/snapshot, pembayaran/refund bersamaan, receipt replay, saldo, Rules, isolasi studio, pagination dan rekonsiliasi ledger/booking/projection/cache.

## Bukti interaksi mobile web

Fixture hanya studio `e2e-lensflow`, direset sebelum run; akun dan transaksi uji tidak mengubah Studio Cahaya. Browser uji terpisah menggantikan kontrol browser bawaan yang gagal diinisialisasi. Cakupan:

1. Login → Booking → pelanggan baru → kembali dengan pelanggan otomatis terpilih.
2. Pilih paket 500.000, tanggal/jam, simpan booking, DP 150.000, sisa 350.000.
3. Pelunasan 350.000, batal dengan alasan, refund parsial 50.000, expense 50.000; kas bersih 400.000.
4. Slot booking batal dapat digunakan lagi; ubah jadwal 11.00–12.00; booking 11.30–12.30 ditolak bentrok dengan isian tetap.
5. Kalender menampilkan booking baru; viewport 320×700 tidak overflow horizontal.
6. Beranda menunjukkan bruto 500.000, refund 50.000, kartu sesi mendatang; inbox H-3, Pelunasan, DP.
7. Membuka DP menandai dibaca dan menuju detail entry server; preferensi pembayaran nonaktif tersimpan setelah reload dan menyembunyikan event.
8. Setelah role menjadi staf booking, Beranda tidak menampilkan nominal kas dan inbox tidak menampilkan pembayaran/reminder.
9. Tidak ada pageerror atau warning Unexpected text node pada keseluruhan skenario.

Perbaikan dari temuan: handoff pelanggan tidak terpilih akibat lifecycle form, navigasi kembali membawa clientId eksplisit, serta spasi JSX literal di luar Text pada beberapa layar yang menghasilkan peringatan Expo dan menghalangi klik. Unit AST ditambahkan untuk regresi native text node.

## Artefak

Log: `test-results/stage6-unit-tests.log`, `stage6-backend-tests.log`, `stage6-e2e-final.log`, `stage6-lint.log`, `stage6-typecheck.log`, `stage6-export.log`, `stage6-worker.log`. Bundle: `test-results/stage6-export/metadata.json`. Report: `test-results/e2e-report/index.html`.

Screenshot baru (390×844 kecuali compact):

- `test-results/stage6-booking-proof.png`
- `test-results/stage6-finance-proof.png`
- `test-results/stage6-collision-proof.png`
- `test-results/stage6-calendar-proof.png`
- `test-results/stage6-calendar-compact.png` (320×700)
- `test-results/stage6-home-proof.png`
- `test-results/stage6-inbox-proof.png`
- `test-results/stage6-home-booking-staff.png`

Beranda, inbox dan kalender compact telah diperiksa secara visual dari screenshot: teks terbaca, kartu dan tombol berada di dalam lebar layar. Kalender compact dapat digulir untuk melihat agenda di bawah header; tombol buat booking dan tab berada di bawah. Screenshot lain menjadi bukti interaksi, bukan klaim seluruh Figma sudah cocok 1:1.

## Batas verifikasi

Belum diverifikasi: runtime Android/iOS, keyboard dan safe-area perangkat fisik, seluruh ukuran/landscape/tablet, seluruh state offline/timeout di UI, seluruh role dalam UI (cakupan backend lebih lengkap), visual 1:1 seluruh Figma, index provisioning/latency/billing produksi dan scheduler cloud. Push, email/WhatsApp pengingat dan transaksi bank otomatis tidak diimplementasikan pada tahap ini. Scheduler aplikasi tersedia setiap 15 menit WIB; emulator memakai worker lokal opsional dan sync saat inbox dibuka.

Berikutnya Tahap 7: laporan dan grafik keuangan yang direkonsiliasi terhadap ledger.
