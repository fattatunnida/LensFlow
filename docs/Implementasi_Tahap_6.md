> Catatan arsitektur historis: koneksi Functions pada tahap ini telah diganti Firestore langsung. Gunakan [panduan Firebase terkini](Hubungkan_Firebase.md) dan [catatan migrasi Spark](Migrasi_Firestore_Spark.md).

# Implementasi Tahap 6 — Beranda dan Inbox

26 Oktober 2026. Expo SDK 58, Firebase JS SDK, backend Callable Functions regional `asia-southeast2`. Data dari studio akun aktif, tanpa angka pratinjau. Implementasi dan uji menggunakan emulator; cloud belum dideploy.

## Perilaku aplikasi

Beranda menampilkan sapaan nama, tanggal WIB, sesi hari ini (confirmed + done, batal dikecualikan), jumlah selesai, serta lima sesi confirmed terdekat yang belum berakhir, termasuk yang sedang berlangsung. Kartu membuka detail booking. Shortcut membuat booking/pelanggan mengikuti izin. Data dimuat ulang saat layar mendapat fokus atau tombol muat ulang digunakan; kegagalan tidak ditampilkan sebagai saldo nol.

Kas Masuk Hari Ini menjumlahkan penerimaan DP/pelunasan berdasarkan **effectiveDate WIB** dari ledger, sebelum refund. Refund ditampilkan terpisah. Ini berbeda dari kas bersih yang juga mengurangi pengeluaran. Agregasi membaca ledger sehingga data Tahap 5 langsung terhitung tanpa migrasi cache harian. Owner, staf pembayaran dan staf laporan boleh melihat kas; nominal sama sekali tidak dikirim kepada booking/CRM tanpa izin finansial.

Inbox diakses melalui ikon lonceng Beranda dan menyimpan event 30 hari terakhir. Pengguna dapat membuka item untuk menandainya dibaca; waktu baca pertama dipertahankan saat retry. Tujuan navigasi divalidasi server dan dibatasi ke Kalender, konteks keuangan booking atau detail transaksi.

| Jenis | Kondisi | Penerima | Tujuan |
|---|---|---|---|
| Ringkasan jadwal | Mulai 07.00 WIB, ada sesi confirmed/done hari ini | Owner atau izin booking/kalender CRM | Kalender tanggal terkait |
| Pengingat H-3/H-1 | Mulai 09.00 WIB, sesi confirmed pada tanggal H-3/H-1, belum dimulai dan sisa > 0 | Owner atau izin pembayaran | Keuangan booking |
| Pembayaran masuk | Entry income_dp/income_settlement sudah tercatat | Owner atau izin pembayaran | Detail entry ledger |

Pengingat dihitung berdasarkan tanggal WIB, bukan tepat 24/72 jam. Tidak ada pengingat H-2. Pembayaran menggunakan waktu pencatatan untuk urutan inbox dan menampilkan tanggal efektif. Refund dan expense tidak menghasilkan notifikasi pembayaran masuk. Hak laporan saja tidak menerima detail pembayaran melalui inbox.

Saat list atau buka item, server membaca ulang izin, preferensi dan data sumber. Pengingat lunas, batal, dimulai atau berpindah tanggal disembunyikan, termasuk saat item lama masih tersimpan. Sisa tagihan ditampilkan dari saldo terbaru. Penarikan izin langsung menutup akses data server pada panggilan selanjutnya.

## Penyimpanan dan kontrak

```text
studios/{studioId}/inboxes/{uid}/items/{deterministicId}
  kind, date, bookingId?/entryId?/offset?, createdAt, readAt
studios/{studioId}/inboxPreferences/{uid}
  schedule, payments, reminders, version, updatedAt
studios/{studioId}/inboxSyncState/{uid}
  paymentCursor, paymentsSince?, updatedAt
system/inboxDispatch[_scopeHash]
  studioId, memberId, updatedAt
```

Item menyimpan referensi, bukan salinan telepon/email/catatan pelanggan. Text dan tujuan dibentuk server dari sumber yang masih sah. ID harian, pengingat per booking/tanggal/offset, serta penerimaan per entry memakai hash stabil. Transaksi memeriksa item yang sudah ada sebelum membuat; refresh, worker berulang, proses bersamaan dan retry tidak membuat duplikasi.

Endpoint baru: `dashboardRead({studioId})`, `inboxList({studioId,next?})`, `inboxRead({studioId,id})`, `inboxPreferences({studioId})` atau update dengan `value` tiga boolean dan `expectedVersion`. UID berasal dari Auth, bukan payload. Field tambahan termasuk UID, izin dan jam palsu ditolak. Semua jalur inbox/preferences/state tertutup untuk baca/tulis langsung oleh client, termasuk owner; akses melalui callable dengan pemeriksaan membership aktif dan studio profil.

List mengembalikan maksimal 25 item sah, memindai maksimal 100 kandidat per halaman dengan cursor timestamp + document ID. Event yang sudah tidak berlaku dapat menghasilkan halaman pendek dengan cursor lanjutan. Pengambilan penerimaan baru memproses 25 entry per transaksi dan mengembalikan `pending` jika masih ada backfill; muat ulang melanjutkan tanpa kehilangan entry dengan timestamp sama. Riwayat tampil maksimal 30 hari dan tidak sebelum tanggal membership jika tersedia. Batas 30 hari adalah batas tampil/akses; pembersihan fisik dokumen atau TTL belum dikonfigurasi.

Preferensi pribadi default aktif. Simpan memakai pemeriksaan versi; konflik meminta muat ulang. Mematikan jenis menyembunyikan item terkait. Menyalakan pembayaran kembali tidak menambahkan event penerimaan yang tercatat saat nonaktif; item lama yang sudah pernah dibuat dapat tampil kembali. Preferensi tidak memberikan izin baru. Konfigurasi Admin opsional pada studio: `inboxEnabled`, `dailyScheduleInboxEnabled`, `paymentInboxEnabled`, `reminderInboxEnabled` (default aktif). UI konfigurasi studio menyusul Tahap 8.

## Worker dan menjalankan lokal

`inboxScheduler` adalah Scheduled Function setiap 15 menit WIB, maksimum 200 anggota per eksekusi dan checkpoint untuk melanjutkan. Pekerjaan berulang aman karena ID stabil dan transaksi. Penyiapan event juga terjadi saat inbox dibuka sehingga tidak bergantung pada worker untuk pemakaian lokal. Worker bukan pengiriman push.

```powershell
npm run backend:start
# terminal lain, opsional:
npm run backend:inbox -- --studio studio-cahaya
# sekali jalan:
npm run backend:inbox -- --once --studio studio-cahaya
```

Worker lokal memeriksa loopback emulator demo-lensflow dan memakai Admin SDK dependency backend. Tanpa `--studio`, ia memproses seluruh studio emulator. Loop lokal setiap 60 detik. Konfigurasi emulator saat ini tidak menjalankan Cloud Scheduler otomatis. Produksi perlu deploy Rules/indexes dan seluruh Functions, layanan Scheduler serta billing yang sesuai; belum dilakukan pada tahap ini. Tidak ada email, WhatsApp, push perangkat, atau transfer bank otomatis.

## Verifikasi

30 unit + 66 integrasi emulator lulus. Uji repository aplikasi memanggil seluruh endpoint baru menggunakan Firebase client yang sama dengan aplikasi. Kasus mencakup RBAC, isolasi studio, membership nonaktif, raw write denial, agregasi ledger tanpa cache, jam 07/09 WIB, H-1/H-3, lunas/batal/reschedule, deduplikasi concurrent, first readAt, versi preferensi, off/on pembayaran, retensi, cursor timestamp sama dan checkpoint worker. Worker sekali jalan terverifikasi pada fixture studio terpisah.

Chromium headless 390×844 menguji alur Booking → DP → pelunasan → batal/refund → expense → slot dipakai ulang → reschedule → bentrok → kalender, lalu Beranda → inbox → detail pembayaran → preferensi persist → pembatasan kas staf booking. Kalender 320×700 tidak overflow horizontal. Screenshot dan log di `test-results/stage6-*`.

Perbaikan regresi yang ditemukan lewat uji tampilan: pelanggan baru kembali ke draft booking dalam keadaan terpilih, serta spasi literal di luar Text pada beberapa layar yang memicu peringatan React Native dan menghalangi tombol preview web. Pengujian AST menjaga agar teks literal tersebut tidak muncul kembali. Pemeriksaan layout ini belum merupakan kecocokan 1:1 seluruh Figma, pengujian keyboard/safe-area native atau uji perangkat fisik.

Tahap berikutnya: **Tahap 7 — Laporan keuangan dan grafik**, memakai ledger aktual serta rekonsiliasi bruto, refund, pengeluaran dan kas bersih.
