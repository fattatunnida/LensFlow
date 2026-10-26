# QA migrasi Firestore langsung — 26 Oktober 2026

## Hasil implementasi

Aplikasi memakai Firebase JS SDK Authentication dan Firestore secara langsung. Tidak ada import/pemanggilan Callable Functions dalam aplikasi. Konfigurasi Firebase default hanya Rules, indeks, Auth Emulator dan Firestore Emulator. Functions lama dipertahankan sebagai arsip, tidak dipakai aplikasi atau dideploy.

Booking, proyeksi sesi/konteks keuangan, lock jadwal dan receipt tersimpan atomik. Ledger immutable, receipt, sequence, saldo booking dan refund source terikat oleh Security Rules. Riwayat perubahan booking berasal dari bookingMutations dan transaksi ledger yang boleh dibaca sesuai izin; aplikasi tidak lagi menulis duplikat event projection.

Undangan menggunakan email terverifikasi dan claim transaksi profil/member/invitation. Staf tidak dapat menentukan role owner, mengganti studio atau menaikkan izinnya sendiri. Inbox dihitung saat dibuka; tidak ada scheduler/push latar belakang.

## Pengujian lokal

- `npm run lint`: lulus tanpa warning.
- `npm run typecheck`: lulus.
- 31 unit test aplikasi: lulus.
- 14 skenario integrasi Spark pada Auth/Firestore Emulator: lulus. Mencakup create/retry, bentrok/concurrent booking, reschedule satu/lintas hari, versi stale, DP/pelunasan/cancel/refund/expense, concurrent settlement/refund, immutable ledger, batch booking palsu dengan proyeksi/counter/lock/receipt, pencabutan izin, pemisahan CRM dan keuangan, studio isolation, laporan, preferensi/read marker, pengaturan/profil, verifikasi email, claim/replay, undangan expired/cancelled/accepted.
- 2 alur E2E Chromium mobile web: lulus (sekitar 2,2 menit). Operasional lengkap serta laporan/pengaturan/profil/undang/batal/undang ulang/registrasi/verifikasi/claim/ubah izin/revokasi/ganti password. Viewport 390×844 dan pemeriksaan 320px.
- Ekspor bundle Android, iOS dan web: lulus, `test-results/spark-export-final/metadata.json`.

Log percobaan write ilegal memuat PERMISSION_DENIED yang memang diharapkan. Rules menolak dokumen yang tidak valid; beberapa percobaan palsu juga mencapai batas evaluasi Rules. Seluruh skenario transaksi sah di atas berhasil, termasuk reschedule lintas hari dan pembayaran dengan role payments-only. Pengujian ini bukan audit keamanan menyeluruh atau jaminan skala produksi.

Fixture memakai project demo-lensflow dan studio terpisah; tidak membuat transaksi bisnis palsu pada Firebase cloud. 75 test Functions dari implementasi lama adalah hasil historis, bukan hasil migrasi ini dan tidak termasuk test default Spark.

## Firebase cloud

Target `lensflow-110d3`, database `(default)` asia-southeast2. Auth Email/Password aktif. Owner dan membership aktif tersedia di studio-lensflow. Sebelum flag clientBackendVersion=1 diterapkan, koleksi bookings/transactions/sessions/scheduleDays/scheduleLocks diperiksa kosong; tidak ada data bisnis lama yang ditimpa.

Rules dan 24 indeks berhasil dideploy dengan `firebase deploy --only firestore --project lensflow-110d3`. Seluruh 24 indeks berstatus READY pada verifikasi 26 Oktober 2026 pukul 23.37 WIB. Isi Rules cloud dibandingkan dengan file lokal melalui hash SHA-256. Billing diverifikasi tetap nonaktif. Bukti: `test-results/spark-cloud-verify.log`.

Expo development server pada port 8081 telah direstart dengan konfigurasi cloud. Smoke test menampilkan login tanpa runtime error, tanpa mengirim kredensial pribadi (`test-results/spark-cloud-smoke.log`).

Owner menentukan password sendiri melalui Lupa kata sandi. Login dan UAT menggunakan akun owner cloud masih perlu dilakukan pengguna; pengujian otomatis tidak meminta atau menyimpan password pribadi. Tidak mengirim email nyata melalui alat pengujian.

## Batas verifikasi

Belum diuji pada perangkat Android/iOS fisik atau dirilis melalui EAS/store. Bundle berhasil diekspor bukan bukti native runtime. Push, upload foto/avatar, gateway pembayaran, App Check produksi dan pencocokan seluruh Figma belum termasuk. Laporan maksimal 5.000 transaksi per periode; inbox pembayaran hanya 30 hari terakhir. Spark mengikuti kuota Firebase.

Panduan penggunaan: [Hubungkan Firebase](../Hubungkan_Firebase.md).

