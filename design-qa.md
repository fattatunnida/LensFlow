# QA Tahap 5 — Keuangan

26 Oktober 2026. Catatan Tahap 4 dipertahankan di `docs/qa/Tahap_4_QA.md`; QA sebelumnya tetap tersedia. Lingkungan terverifikasi adalah emulator project demo-lensflow dan SDK aplikasi, bukan Firebase cloud atau perangkat fisik.

## Status

Implementasi: Keuangan dari Lainnya, daftar dan detail transaksi, filter bulan/metode/jenis, konteks booking minimum, DP/pelunasan, pengeluaran owner, refund owner yang merujuk pembayaran asal, ringkasan kas dan pembaruan status/saldo booking. Login/splash tetap memakai implementasi sebelumnya. Beranda masih pratinjau sampai Tahap 6.

Lint dan TypeScript lulus. **28 test aplikasi + 52 test integrasi = 80 lulus**. Ekspor bundle Android/iOS/web lulus. Tidak dinyatakan lulus pengujian klik/layout/screenshot atau perangkat fisik.

## Bukti layanan dan SDK

| Kasus | Hasil |
|---|---|
| Multiple DP lalu Pelunasan | Nominal tersimpan sekali; saldo dan paymentStatus tepat |
| Pelunasan sebagai pembayaran pertama | Seluruh harga diterima tepat, tanpa DP nol |
| DP sama/melebihi sisa, settlement kurang, nol/negatif/pecahan/overflow | Ditolak tanpa perubahan saldo |
| Retry receipt sama | Hasil awal dikembalikan; audit/entry tidak bertambah |
| Mutation dipakai dengan payload berbeda | Ditolak |
| Entry ID sama dengan mutation baru | Ditolak; dapat diperiksa melalui detail entry |
| Dua pelunasan bersamaan | Hanya satu diterima; tidak ada overpayment |
| Bayar dan batal bersamaan | Hanya satu perubahan versi diterima |
| Refund sebelum batal atau lintas pembayaran/booking | Ditolak |
| Refund parsial dan penuh tiap asal | Batas asal terjaga; original ledger tidak diubah |
| Dua refund bersamaan | Tidak melampaui saldo refundable |
| Pembatalan saja | Tidak mencatat refund otomatis |
| Booking done belum lunas | Tetap dapat menerima pembayaran |
| Owner expense | Tidak mengubah saldo booking; retry tidak menggandakan pengeluaran |
| Staf pembayaran/laporan/booking/CRM | Batas baca/tulis ditegakkan server, bukan hanya UI |
| Revoke, membership nonaktif, anonim, studio lain, boolean salah tipe | Ditolak; replay juga memerlukan izin aktif |
| Write/update/delete langsung ke ledger/cache/counter | Ditolak, termasuk bagi owner |
| Tanggal palsu/masa depan, backdate staf, sebelum transaksi asal | Ditolak |
| Cache saldo tidak sesuai ledger | Posting ditolak dan meminta rekonsiliasi |
| Pagination | Ledger 25+3, picker booking 25+2, pembayaran asal 25+2 terbaca tanpa duplikasi/hilang |
| Audit akhir | Setiap entry posted cocok dengan booking, projection, akun saldo, counter refund dan cache kas bulan/metode |
| SDK aplikasi | Booking → DP → lunas → batal → refund → expense → detail/filter/ringkasan lulus |
| Regresi Tahap 4 | Bentrok create/reschedule, adjacent slots, versi, snapshots, kalender dan akses tetap lulus |

Artefak: `test-results/stage5-unit-tests.log`, `stage5-backend-tests.log`, `stage5-app-sdk.log`, `stage5-verified-export.log`, dan `stage5-verified-export/metadata.json`. Error PERMISSION_DENIED dalam log integrasi merupakan kasus negatif yang disengaja. Fixture hanya pada namespace pengujian; tidak mengisi kas Studio Cahaya.

## Pemeriksaan UI yang belum dapat dilakukan

Permintaan awal untuk menguji Booking/Kalender melalui browser dicoba kembali. Runtime kontrol browser tetap gagal sebelum membaca halaman, dengan kegagalan menulis kernel assets karena path tidak ditemukan. Tidak diambil screenshot baru dan screenshot Tahap 3 tidak digunakan sebagai bukti tahap ini. Pembacaan/penulisan SDK serta bundling tidak menggantikan pengujian interaksi.

Dari source: daftar utama memakai FlatList, form ScrollView/KeyboardAvoidingView, field berlabel, validasi inline, konfirmasi sebelum posting, single-submit lock, error/retry, draft memori, pembatasan role, serta referensi pembayaran asal pada refund. Ini belum membuktikan hasil layout, urutan fokus, keyboard, safe area atau navigasi di perangkat.

Checklist penerimaan manual yang masih terbuka:

1. Booking: pelanggan baru dari draft, pilihan paket, bentrok, reschedule, batal dan kembali ke kalender/list.
2. DP: input salah dan benar, konfirmasi uang diterima, detail sukses, saldo terbarui, kembali ke booking.
3. Pelunasan: nominal sesuai sisa terbaru, konflik versi tidak menghapus isian, retry hasil belum pasti tidak membuat entry kedua.
4. Expense: owner dapat mencatat; staf pembayaran/laporan tidak memperoleh aksi posting keluar.
5. Refund: booking harus batal, pembayaran asal dapat dibedakan lewat referensi, batas sisa, alasan/konfirmasi, parsial/penuh dan link asal.
6. Filter periode/metode/jenis, pagination, empty/error/retry, dan ringkasan kas tidak dianggap subtotal halaman.
7. Role pembayaran tanpa booking dapat memilih konteks minimum; report hanya baca; booking/CRM tidak membuka kas studio.
8. Layar 320/390 px, nama/nominal panjang, keyboard native, safe area dan Back Android; aksesibilitas dan font scaling.

## Batas hasil

Tidak ada transfer bank/QRIS, pembayaran nyata, email/pesan, deployment cloud atau pemasangan build yang dilakukan. Ledger adalah pencatatan manual yang diverifikasi pengguna. Draft hilang bila proses berhenti/reload; riwayat harus diperiksa sebelum membuat catatan baru bila hasil lama belum pasti. Koreksi/reversal dan offline permanen belum diimplementasikan. Source backup bukan backup database emulator.

QA visual 1:1, interaksi langsung Tahap 4–5 dan perangkat fisik tetap terbuka. Backend/SDK selesai diuji tanpa kegagalan yang diketahui; fitur tidak dinyatakan siap produksi berdasarkan bundle/test saja.
