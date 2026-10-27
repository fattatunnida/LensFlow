> QA terbaru: notifikasi aksi/login/logout dan pengelolaan state telah diuji. Lihat [QA notifikasi dan state](docs/qa/Notifikasi_dan_State_QA.md).

> QA terkini: migrasi Firestore Spark dan deployment cloud telah selesai. Lihat [Firestore Spark QA](docs/qa/Firestore_Spark_QA.md). Catatan tahap sebelumnya di bawah bersifat historis.

# QA Tahap 7–8 dan Regresi Tahap 9

26 Oktober 2026. QA Tahap 6 disimpan di docs/qa/Tahap_6_QA.md. Lingkungan: Expo SDK 58, Chromium headless terpisah, Firebase Auth/Firestore/Functions emulator demo-lensflow. Tidak ada deployment cloud atau build terpasang di perangkat fisik.

## Hasil akhir

- Lint: lulus tanpa warning. TypeScript: lulus.
- 31 unit + 75 integrasi emulator = 106 lulus. Pengujian manajemen terakhir: 9/9 lulus.
- Dua skenario E2E operasional dan manajemen: lulus. Manajemen diuji ulang setelah perbaikan grafik dan undang ulang: lulus.
- Ekspor Android/iOS/web: lulus. Ekspor bukan pengujian runtime native.
- Tidak ada pageerror atau Unexpected text node sepanjang skenario E2E.

## Layanan dan SDK

Laporan membaca seluruh ledger pada periode WIB, bukan subtotal halaman atau nilai booking. Bruto/refund/expense/count dan bucket direkonsiliasi dengan transaksi SDK yang benar-benar diposting. Net negatif dipertahankan. Rentang tidak sah/terbalik/masa depan/lebih dari 366 hari ditolak; hari kosong tetap nol. Owner/reports boleh membaca; payments saja, booking, anonim, nonaktif dan studio lain ditolak. Batas 5.000 transaksi eksplisit pada server agar tidak memotong angka diam-diam.

Studio owner-only, validasi nama/telepon/jam kelipatan 15 menit/DP 0–100 dan optimistic version diuji. Profil hanya identitas sendiri; email/studio/role tidak dapat ditimpa. Izin staf wajib empat boolean, owner terkunci, versi konflik ditolak. Raw writes studio/profil/member/audit/receipt tetap tertutup termasuk bagi owner aplikasi.

Undangan membuat Auth user stabil dan membership invited; retry command tidak menggandakan anggota, payload berbeda ditolak. Firebase token reset dipakai sungguhan untuk membuat password, lalu identitas password terautentikasi menerima undangan melalui staffAccept. Anonim, owner dan staf nonaktif tidak dapat menerima. Pembatalan pending dapat diundang ulang tanpa langsung aktif. Penarikan izin/nonaktif menutup akses server. Tidak ada pengiriman email undangan otomatis.

Seluruh regresi sebelumnya tetap lulus: Auth, CRM, paket, booking slot/snapshot/version, pembayaran/refund race dan receipt replay, ledger/cache rekonsiliasi, Beranda RBAC, inbox WIB/deduplikasi/retensi/preferensi/paging/worker.

## Mobile web

Fixture terpisah e2e-lensflow dan e2e-management, tidak mengubah Studio Cahaya.

Operasional: login → pelanggan baru dari booking → paket/jadwal → DP 150.000 → lunas 350.000 → batal → refund 50.000 → expense 50.000 → kas bersih 400.000. Slot batal dipakai ulang, reschedule, bentrok mempertahankan isian, kalender 320px, Beranda dan inbox, tanda baca, preferensi persist, serta staf tanpa nominal kas lulus.

Manajemen: masuk melalui menu Lainnya, laporan bruto 500.000/refund 50.000/expense 50.000/net 400.000, bulan kosong, validasi kustom dan viewport 320px lulus. Grafik otomatis menunjukkan periode terbaru. Simpan/reload studio 09.00–20.00 dan DP 40% terpakai pada form booking (target 200.000). Edit profil memperbarui sapaan Beranda. Undang → batal → undang ulang → buat password Firebase → login staf → aktif → beri izin laporan → baca laporan → nonaktif → sesi staf berakhir lulus. Ganti password memerlukan autentikasi ulang dan password baru berhasil untuk login baru. FAQ/Tentang terbuka.

Screenshot laporan 390/320px, grafik terkini, pengaturan dan staf diperiksa secara visual: teks/kartu terbaca, tidak melebar keluar halaman. Grafik/filter dapat digeser horizontal. Tautan undangan pada screenshot ditutupi. Ini bukan bukti seluruh Figma sudah sama 1:1.

## Artefak

- test-results/stage78-unit-tests.log (31)
- test-results/stage78-backend-tests.log (75)
- test-results/stage78-management-tests.log (9 kasus setelah pembetulan assert periode)
- test-results/stage78-e2e-final.log (dua skenario)
- test-results/stage78-management-final.log (run terakhir manajemen, termasuk undang ulang/grafik)
- test-results/stage78-lint.log dan stage78-typecheck.log
- test-results/stage78-export-final.log dan stage78-export-final/metadata.json
- test-results/stage78-report.png dan stage78-report-compact.png
- test-results/stage78-studio.png, stage78-staff.png dan stage78-staff-invitation.png (masked)
- test-results/stage6-*.png: bukti operasional diperbarui pada run regresi ini

Error PERMISSION_DENIED dalam log backend adalah pengujian negatif yang disengaja. Laporan HTML test-results/e2e-report/index.html mengikuti run E2E yang terakhir dijalankan.

## Yang masih memerlukan penerimaan rilis

Tahap 7–8 inti dan QA otomatis selesai; Tahap 9 belum selesai penuh. Masih terbuka: seluruh Figma 1:1, seluruh state offline/timeout/unsaved changes, keyboard/safe area/splash/performa native, UAT owner/staf, seluruh variasi viewport, deployment/index/billing/Scheduler cloud dan uji produksi. Avatar upload, push perangkat, email undangan otomatis, UI reset custom seluruh state Figma dan App Check produksi belum dibuka. Aplikasi belum dinyatakan siap rilis toko aplikasi.

Project Firebase Anda belum dihubungkan. Panduan konfigurasi/deploy/provisioning/UAT: docs/Hubungkan_Firebase.md. Backup source tidak memuat database atau kredensial lingkungan.


