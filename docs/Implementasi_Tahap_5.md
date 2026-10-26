# Implementasi Tahap 5 — Keuangan dan Ledger

26 Oktober 2026. Lingkungan: Expo SDK 58, Firebase Auth/Firestore/Functions Emulator, project `demo-lensflow`. Backend, SDK dan bundle telah diverifikasi. Pengujian interaksi browser/perangkat fisik belum dapat dilakukan karena runtime kontrol browser masih gagal diinisialisasi. Tidak ada deploy cloud atau perpindahan uang sungguhan.

## Alur penggunaan

Jalankan layanan sesuai README. Owner memakai **Lainnya → Keuangan**; staf melihat menu jika memiliki izin pembayaran atau laporan. Buat pelanggan, paket dan booking terlebih dahulu jika studio masih kosong. Fixture otomatis tidak dimasukkan sebagai transaksi Studio Cahaya.

1. Buka booking lalu **Terima pembayaran**, atau Keuangan → Terima pembayaran → pilih booking.
2. Pilih DP atau Pelunasan. DP wajib positif dan lebih kecil dari sisa; Pelunasan sama dengan seluruh sisa. Pembayaran pertama dapat langsung lunas. Target DP hanya saran, bukan batas minimum atau penerimaan otomatis.
3. Isi metode, tanggal dan catatan. Konfirmasi setelah uang benar-benar diterima. Detail transaksi terbuka hanya setelah server mengonfirmasi posting.
4. Untuk pengeluaran, owner membuka Keuangan → Catat pengeluaran, memilih kategori, nominal, metode, tanggal dan uraian.
5. Untuk refund, batalkan booking terlebih dahulu. Buka Keuangan booking → Catat refund pelanggan, pilih pembayaran asal dan nominal maksimal sisa refundable. Konfirmasi setelah uang benar-benar dikembalikan.

Aplikasi mencatat penerimaan/pengeluaran yang diverifikasi pengguna; tidak menghubungi bank, menagih QRIS, atau mengirim refund otomatis. Metode baseline PRD hanya Transfer dan QRIS. Detail transaksi menampilkan referensi, tanggal efektif, waktu pencatatan, pencatat dan hubungan booking/pembayaran asal. Tidak ada tombol edit/hapus transaksi posted.

## Hak akses

| Aktor aktif di studio | Baca ledger/ringkasan | DP/pelunasan | Pengeluaran/refund |
|---|---|---|---|
| Owner | Ya | Ya | Ya |
| Staf pembayaran | Ya | Ya | Tidak |
| Staf laporan | Ya, hanya baca | Tidak | Tidak |
| Staf booking/CRM tanpa izin keuangan | Tidak | Tidak | Tidak |
| Membership nonaktif, studio lain, anonim | Ditolak | Ditolak | Ditolak |

Staf pembayaran tanpa izin booking memperoleh konteks minimum melalui callable: kode/nama pelanggan, paket, tanggal, status, versi dan saldo. Telepon, email, catatan CRM/booking dan perubahan jadwal tidak ikut diberikan. Izin pembayaran tidak memberi izin menulis booking operasional. Detail booking lengkap tetap mengikuti kebijakan Tahap 4; operator booking dapat melihat nilai kontrak terkait, bukan arus kas studio.

Rules melarang seluruh client write ledger, cache saldo, refund counter, receipt, audit dan ringkasan bulan, termasuk dari owner. Callable membaca profil dan membership di dalam transaksi, menggunakan boolean izin yang ketat. Replay receipt tetap memerlukan akses aktif; pencabutan izin juga menolak retry.

## Aturan nominal dan tanggal

- Integer rupiah positif, maksimal Rp 1.000.000.000 per entry. Client menerima `150000` atau `150.000`; format ambigu, pecahan, notasi ilmiah dan nilai nol/negatif ditolak.
- Penerimaan hanya untuk sesi confirmed/done dengan sisa positif; cancelled menolak pembayaran baru. Selesai sesi dan lunas merupakan status berbeda.
- Tanggal efektif berupa tanggal WIB, disimpan sebagai UTC Timestamp awal hari; createdAt menyimpan waktu server ketika posting.
- Staf hanya hari ini. Owner boleh hari ini atau maksimal 30 hari sebelumnya secara default; `studios/{studioId}.maxFinanceBackdateDays` dapat diatur Admin dalam 0–366. Tanggal masa depan ditolak.
- Penerimaan tidak boleh mendahului tanggal booking dibuat. Refund tidak boleh mendahului tanggal efektif pembayaran asal.
- Refund hanya untuk booking cancelled, owner, dan original entry income pada booking/studio yang sama. Tidak boleh melebihi sisa refundable asal atau total bersih yang masih dipegang studio.
- Pengeluaran tidak memakai kategori refund. Refund mengurangi penerimaan bersih dan tidak dihitung lagi sebagai pengeluaran operasional.

## Kontrak backend

Tambahan callable di region `asia-southeast2`:

| Endpoint | Tugas |
|---|---|
| `financeCommand` | Posting income_dp, income_settlement, expense, refund secara atomik |
| `financeBookings` | Booking minimum untuk konteks bayar/baca, lookup ID, search dan cursor 25 record |
| `financeSources` | Pilihan pembayaran asal dan sisa refundable, khusus owner, 25 record per halaman |

Command menerima `studioId`, `entryId`, `mutationId`, kind, amount, method, effectiveDate, description dan acknowledged=true. Income/refund menyertakan bookingId dan expectedVersion; refund juga originalEntryId; expense menyertakan category. Field lain ditolak: client tidak dapat menetapkan saldo, status, aktor atau cache kas.

Semua koleksi berikut berada di `studios/{studioId}`:

- `transactions/{entryId}`: ledger append-only dengan kind, amount positif, method, effectiveDate/effectiveAt, category, description, referensi booking/original, metadata server dan pencatat.
- `financeMutations/{uid_mutationId}`: fingerprint payload yang dinormalisasi dan hasil committed. Payload sama mengembalikan hasil lama; payload berbeda dengan key sama ditolak.
- `financeAccounts/{bookingId}`: received/refunded/version untuk mengunci dan memeriksa konsistensi cache saldo booking.
- `refundBalances/{originalEntryId}`: jumlah refund terhadap penerimaan asal; original ledger entry tetap tidak diubah.
- `financeMonths/{YYYY-MM}_{all|transfer|qris}`: cache income bruto, refund, expense, count dan version. Cache all serta metode aktual ditulis dalam transaksi posting yang sama.
- Booking menambah/menjaga paidAmount (gross diterima), refundedAmount, netPaidAmount dan refundStatus, serta menaikkan version. Projection sessions dan event audit diperbarui dalam commit yang sama tanpa memasukkan nominal ke projection kalender.

Semua read dilakukan sebelum write. Posting income/refund membaca dan membandingkan versi booking, cache akun serta saldo, sehingga dua permintaan bersamaan tidak bisa melampaui saldo. Refund juga mengunci counter pembayaran asal. Counter/statistik yang rusak menolak posting; saldo lama positif tanpa ledger/account sah memerlukan rekonsiliasi, bukan otomatis dipercaya sebagai penerimaan valid.

Sumber kebenaran kas adalah ledger. Cache dapat direkonsiliasi kembali terhadap seluruh entry. Formula ringkasan: penerimaan bersih = income − refund; kas bersih periode = income − refund − expense. Nilai kontrak atau target DP yang belum dibayar tidak dihitung sebagai kas. Ringkasan UI sesuai bulan/metode untuk seluruh jenis; tab daftar Pemasukan/Pengeluaran/Refund hanya memfilter daftar rinci.

## Retry, draft dan kegagalan

Form memakai entry ID tetap dan mutation ID tetap selama payload sama. Double submit dikunci. Jika respons hilang setelah commit, retry mengembalikan receipt; entry ID yang sudah dipakai juga tidak dapat menciptakan record kedua dengan mutation baru. Form menyediakan **Periksa hasil transaksi** untuk membaca entry tersebut dari server.

Error mempertahankan isian. Versi/saldo usang menyediakan konfirmasi memuat saldo terbaru; aplikasi memeriksa hasil entry lama dahulu sebelum mengganti draft. Retry receipt boleh memakai versi lama karena hasil sudah committed diperiksa sebelum aturan saldo/tanggal saat ini. Field yang diubah menghasilkan mutation baru tetapi entry ID draft tetap sama sehingga hasil belum pasti tidak menggandakan entry.

Draft hanya memori proses dan dibatasi UID, studio, jenis, booking. Logout membersihkannya. Reload browser/proses berhenti menghilangkan draft; ini belum mode offline atau penyimpanan draft permanen. Setelah kehilangan draft karena proses berhenti, periksa riwayat ledger sebelum mencatat ulang uang yang sama. Transaksi berbeda dengan identitas baru dianggap pencatatan baru; tanpa referensi bank/gateway, aplikasi tidak dapat menebak dua catatan manual mewakili uang yang sama.

## Hasil pemeriksaan

- `npm run lint`, `npm run typecheck`: lulus.
- 28 test aplikasi: validasi uang/tanggal, batas WIB, peran, DP/pelunasan, refund dan replay, beserta regresi sebelumnya.
- 52 test integrasi emulator: 35 sebelumnya, 16 kelompok keuangan dan 1 alur repository SDK keuangan.
- Memastikan race pelunasan, race bayar/batal, race refund, immutable original entry, exact settlement, multiple DP, status done/cancelled, revoke/anon/cross-studio, raw write denial, tanggal, backdate, schema, pagination serta receipt replay.
- Audit akhir merekonsiliasi setiap ledger posted dengan booking, projection, financeAccounts, refundBalances dan ringkasan bulan/metode.
- Repository SDK aplikasi menjalankan create booking → DP → pelunasan → batal → refund tiap asal → pengeluaran → query detail/pagination/ringkasan. Ini bukan klik UI.
- Bundle Android, iOS dan web berhasil diekspor. QA UI/perangkat fisik masih terbuka; lihat `../design-qa.md`.

Fixture tambahan hanya menggunakan `finance-test-a`, `finance-test-b`, dan `finance-sdk-test`. Source backup tidak mencakup database emulator. Tidak ada transaksi bisnis, panggilan bank, deployment cloud atau kredensial baru pada project cloud.

## Batas tahap dan langkah berikutnya

Koreksi/reversal posted belum dibuka; tidak ada penghapusan ledger atau perubahan harga kontrak lewat modul keuangan. Refund tidak membatalkan booking secara otomatis. Zona selain Asia/Jakarta, tunai, gateway pembayaran, unggah bukti dan invoice PDF bukan lingkup tahap ini.

Lanjutkan QA interaksi mobile/web: form tiga langkah booking, bentrok/reschedule/batal, handoff pelanggan, konfirmasi uang, konflik saldo, pemeriksaan hasil, hak staf, layar kecil dan keyboard. Setelah itu Tahap 6 menghubungkan Beranda/notifikasi ke data nyata; Tahap 7 menambahkan laporan analitis/grafik. Deploy keenam Functions, Rules dan indeks secara eksplisit ketika lingkungan cloud disiapkan; tahap ini belum melakukan deployment tersebut.
