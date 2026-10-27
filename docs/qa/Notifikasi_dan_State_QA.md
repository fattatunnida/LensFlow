# Notifikasi aksi dan pengelolaan state — 27 Oktober 2026

## Perilaku aplikasi

Pesan singkat berlogo aperture ditampilkan di atas navigasi, sehingga konfirmasi tetap terlihat setelah perpindahan halaman dan logout. Pesan dapat ditutup, otomatis hilang, tidak memblokir kontrol halaman, dan antreannya maksimal tiga item. Tidak menyimpan isi pesan ke disk/Firestore. Retry dengan mutation ID yang sama tidak menggandakan konfirmasi.

Pesan mencakup login/logout, penolakan akses studio, reset/perubahan password, pelanggan/paket, booking/reschedule/cancel/selesai, pembayaran/refund/pengeluaran, profil/pengaturan, undangan/akses staf dan preferensi inbox. Kegagalan form tetap memakai pesan inline yang sudah tersedia; transaksi gagal tidak menghasilkan pesan sukses.

Notifikasi HP bersifat **lokal**, melalui expo-notifications SDK 58. Pengguna mengaktifkannya di Pengaturan notifikasi; aplikasi baru meminta izin sistem setelah switch diaktifkan. Preferensi disimpan di SecureStore per perangkat. Web tidak meminta izin notifikasi browser. Login/logout dan perubahan password dapat ditampilkan pada perangkat dengan pesan generik, tanpa email/nama pelanggan/nominal uang. Tidak mendaftarkan push token, memakai scheduler, mengaktifkan APNs remote entitlement atau mengubah Firebase billing.

## Perbaikan state

- AuthActionGate menunggu keberhasilan kredensial dan validasi akses studio untuk UID yang sama sebelum promise login berhasil. Login gagal/tidak punya membership, timeout/disposal, atau operasi lain yang masih berjalan tidak menghasilkan konfirmasi sukses.
- Logout membatalkan generation pembacaan dan listener data secara langsung, menahan pemeriksaan foreground selama sign-out, kemudian menunggu Firebase menghapus sesi sebelum konfirmasi. Logout manual dibedakan dari revokasi akses oleh owner.
- Event metadata, refresh token, reload/pemulihan sesi dan pemeriksaan foreground tidak dianggap login baru. Pemeriksaan foreground mempertahankan form yang sedang diisi; jika akses gagal, layar koneksi/akses tetap menutup ruang kerja.
- Antrean feedback memiliki scope UID/studio dan epoch. Callback hasil sesi lama diabaikan setelah logout/pergantian akun. Pesan dan notifikasi perangkat sebelumnya dibersihkan saat scope berubah. Operasi perangkat diserialkan dan memeriksa scope sebelum/sesudah delivery.
- Form login, reset password, logout dan pengaturan notifikasi perangkat tidak memperbarui state setelah ditinggalkan. Kegagalan menyimpan email yang diingat tidak mengubah login yang valid menjadi gagal.
- Hook pembacaan lama sudah menggunakan key actor/izin/filter dan generation guard; pola tersebut dipertahankan. Draft/handoff tetap dibersihkan saat signed-out.

## Verifikasi

- 38 unit test: lulus, termasuk tujuh skenario baru untuk ordering kredensial/akses, kegagalan, lock aksi, disposal/timeout, scope/late callback dan deduplikasi antrean.
- 14 skenario integrasi Firestore Spark: lulus; Rules dan data bisnis tidak diubah oleh fitur notifikasi.
- Lint dan TypeScript: lulus. Bukti di test-results/feedback-lint.log dan feedback-typecheck.log.
- Uji E2E khusus sesi/notifikasi: lulus, termasuk password salah, akun tanpa membership, sukses sekali, perubahan metadata, form saat foreground, restore tanpa pesan login ulang, simpan profil, logout dan revokasi akses. Bukti screenshot feedback-login.png/feedback-logout.png dan log feedback-e2e-final.log.
- Ketiga alur E2E (sesi/notifikasi, operasional, manajemen) lulus dalam 2,8 menit, termasuk booking, DP/pelunasan/refund, undangan, revokasi dan perubahan password. Ekspor bundle Android/iOS/web juga lulus; bukti test-results/feedback-export.log dan feedback-export/metadata.json.
- Pemeriksaan terakhir guard logout lulus pada pengulangan E2E sesi/notifikasi, lint dan TypeScript (feedback-guard-e2e.log). Preview cloud di port 8081 juga berhasil menampilkan login tanpa runtime error (feedback-cloud-smoke.log).

Pengujian interaksi memakai Chromium mobile web dan emulator project demo-lensflow, dengan fixture studio terpisah. Tidak mengirim kredensial pribadi atau membuat transaksi bisnis palsu di Firebase cloud. Uji notifikasi sistem, izin Android/iOS, tampilan tray dan cold-start pada perangkat fisik masih perlu dilakukan melalui build aplikasi; keberhasilan typecheck/ekspor bukan bukti delivery native. Push jarak jauh dan pengingat background belum termasuk.

Referensi: [Expo SDK 58 Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/), [Expo SDK 58 SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/).
