# Implementasi tahap pertama LensFlow

Catatan 25 Oktober 2026: halaman akun awal telah digantikan shell lima tab pada Tahap 2. Backend identitas di dokumen ini tetap berlaku. Data contoh pada Beranda/Booking kini ditandai sebagai pratinjau; lihat `Rencana_Implementasi_Bertahap.md` untuk batas implementasi terbaru.

Tahap ini menghubungkan backend identitas dan akses studio dengan Splash dan Login. Stack yang dipilih adalah Expo SDK 58, React Native, TypeScript, Expo Router, Firebase JS SDK 13, Firebase Auth, dan Firestore. Versi rinci dicatat pada `package.json` dan `package-lock.json`. Toolchain memakai Node.js 24.12 atau lebih baru agar konsisten dengan persyaratan SDK Firebase.

## Batas tahap

Termasuk login email/password, validasi form, show/hide password, splash native dan React, pemulihan sesi, pemeriksaan membership dari server, penolakan akses, timeout dan retry, halaman akun setelah login, konfirmasi logout, serta permintaan email reset. Tidak ada data dashboard atau booking fiktif. Provisioning owner tersedia melalui script Admin dan seed emulator.

Belum termasuk dashboard operasional, undangan staf, pengubahan profil, custom action handler reset 30 menit, App Check, atau operasi booking dan uang. Rules untuk fitur tersebut tetap menolak akses sampai implementasinya tersedia. Figma belum menjadi acuan visual terverifikasi untuk layar tahap ini karena batas kuota MCP.

## Urutan boot

1. Splash native tampil sampai React siap. React mengambil alih dengan SplashView selama minimal 3 detik dan sampai pemeriksaan sesi selesai, agar tampilan tidak terlalu singkat dan koneksi lambat tetap dapat menuju error yang memiliki tombol retry.
2. Firebase memulihkan sesi dari penyimpanan sesuai platform.
3. Tanpa user: tampilkan Login.
4. Dengan user: baca `users/{uid}` dari server, lalu membership dan studio. Snapshot cache tidak digunakan untuk membuka sesi saat boot.
5. Profil lengkap dan membership aktif: buka `/home`. Data tidak lengkap atau inactive: keluarkan akun dan tampilkan pesan generik akses.
6. Layanan tidak terjangkau: tampilkan state koneksi, retry, dan jalan keluar dari sesi. Request memiliki timeout; respons pemeriksaan lama tidak dapat menimpa sesi yang lebih baru.

## Pembagian kepercayaan

Firebase Auth memverifikasi password. Firestore Rules memeriksa identitas dan membership aktif. Client hanya menampilkan informasi yang sudah diizinkan. Penulisan profil, studio, dan membership hanya dilakukan Admin script. Admin SDK melewati Security Rules, sehingga script harus dijalankan dalam lingkungan tepercaya dan harus menetapkan project tujuan secara eksplisit.

Satu user memiliki satu studio aktif pada profil tahap ini. Izin staf memakai empat flag sementara dari usulan PRD. Flag tersebut belum membuka fitur operasional; pemetaan final tetap mengikuti keputusan K01 saat modul berikutnya dibangun.

## Persistensi sesi

Android/iOS memakai adapter SecureStore untuk `getReactNativePersistence`. Adapter memecah record menjadi potongan maksimal 400 code point, menulis manifest setelah seluruh potongan sukses, dan menserialisasi operasi per key. Kegagalan menulis record baru mempertahankan versi terakhir yang sudah berhasil disimpan. Penghapusan manifest membuat record tidak dapat dipulihkan melalui adapter. Web preview memakai sessionStorage per tab, bukan persistensi akun lintas tab.

## Keterlacakan

| PRD | Implementasi tahap ini |
| --- | --- |
| FR01 dan UC01 | Boot, auth observer, pemeriksaan membership, protected routes |
| FR02 | Login dan error kredensial generik |
| FR03 | Permintaan email reset; durasi custom PRD masih belum diimplementasikan |
| FR05 dan UC24 | Konfirmasi logout dan penghentian sesi |
| FR06 dan BR01 | Firestore Rules, pembatasan studio, membership aktif |
| NF01 | SecureStore native dan tanpa token pada log aplikasi |
| AT01 sampai AT03, AT32, AT34 | Sebagian melalui test unit, emulator, dan pengujian UI; cakupan reset custom dan undangan masih di luar tahap |

## Pengujian manual perangkat

Jalankan akun demo, tutup dan buka ulang aplikasi, periksa splash tidak menampilkan halaman akun sebelum akses diperiksa, ubah membership menjadi inactive melalui emulator dan pastikan pengguna keluar, uji startup tanpa jaringan, serta periksa tombol kembali setelah logout. Uji splash asli dan Keychain/Keystore membutuhkan perangkat atau development build native; preview browser tidak membuktikan kedua perilaku platform tersebut.
