> Catatan arsitektur historis: koneksi Functions pada tahap ini telah diganti Firestore langsung. Gunakan [panduan Firebase terkini](Hubungkan_Firebase.md) dan [catatan migrasi Spark](Migrasi_Firestore_Spark.md).

# Tahap 7–8 — Laporan, Pengaturan, Profil dan Staf

26 Oktober 2026. Menambahkan fitur operasional melalui menu Lainnya, tetap memakai Expo SDK 58/Expo Router dan Firebase lokal. Tidak mengganti Login/Splash, tidak memindahkan data ke cloud, dan tidak melakukan deployment.

## Laporan

Route `/reports` menampilkan Bulan ini, Bulan lalu, Tahun ini dan Rentang kustom. Server membatasi periode sah sampai hari ini, maksimal 366 hari dan 5.000 transaksi; rentang yang melewati batas ditolak secara jelas agar hasil tidak menjadi subtotal diam-diam. Tanggal memakai WIB.

Sumber laporan adalah immutable ledger `transactions` berdasarkan `effectiveDate`, sama dengan sumber kas Beranda. Total mencakup DP/pelunasan sebagai pemasukan bruto, refund, penerimaan bersih (bruto − refund), pengeluaran operasional dan kas bersih (bruto − refund − pengeluaran). Angka negatif tetap ditampilkan. Nilai booking belum dibayar tidak dihitung sebagai kas.

Grafik native View menampilkan dua batang: pemasukan bruto dan total kas keluar (refund + expense). Pengelompokan harian untuk ≤31 hari, mingguan untuk ≤100 hari dan bulanan sesudahnya; bucket kosong tetap ada, batas minggu mengikuti Senin dan periode pertama/terakhir dipotong sesuai rentang. Rincian per periode dan label aksesibilitas menyediakan angka di balik grafik. Grafik membuka posisi periode terkini dan dapat digeser tanpa membuat halaman overflow horizontal.

Callable `reportsRead({studioId,from,to})` memerlukan owner atau izin reports. Izin pembayaran saja tidak memberikan laporan. Server memeriksa membership dan studio setiap permintaan, memvalidasi ledger dan menghitung semua total/bucket dalam satu hasil query.

## Pengaturan studio

Route `/settings/studio`, owner saja, mengubah nama, alamat, telepon, jam buka/tutup dan DP default. Jam harus berurutan dan kelipatan 15 menit, DP integer 0–100, zona tetap Asia/Jakarta. Simpan memakai `settingsVersion` di studio, konfirmasi UI dan pemeriksaan versi transaksi. Perubahan tidak menulis ulang snapshot booking atau ledger. Picker/command booking yang sudah ada membaca setting baru; draft dengan pilihan DP lama ditolak server dan diminta memilih ulang paket.

Callable `studioSettings({studioId})` membaca, atau update dengan `value` dan `expectedVersion`. Aturan client write studio tetap tertutup.

## Profil dan kata sandi

Route `/settings/profile` mengubah nama, telepon dan jabatan sendiri melalui `profileSettings`, dengan versi pada profil. Email, studio dan role tidak dapat diganti lewat endpoint ini. Firebase profile/studio snapshot memperbarui nama dan studio pada sesi tanpa menunggu login ulang.

Ganti kata sandi memerlukan kata sandi lama, autentikasi ulang Firebase dan konfirmasi baru 12–128 karakter. Password hanya diteruskan ke Firebase Auth, tidak ke Firestore/callable/log. Token refresh untuk UID yang sama memeriksa ulang akses tanpa membongkar form; startup dan kembali foreground tetap menunggu pemeriksaan server. Avatar upload belum dibuka.

## Staf dan undangan

Route `/staff`, owner saja: daftar 25 anggota per halaman, empat izin booking/calendarCrm/payments/reports, edit izin, aktif/nonaktif, pembuatan ulang tautan untuk pending invitation. Owner tetap terkunci dan tidak dapat diturunkan/dinonaktifkan melalui endpoint staf. Update memakai versi dan konfirmasi, serta audit server-only `staffEvents`.

Undangan menggunakan email baru. Server membuat UID stabil dari hash studio/email, Auth user tanpa password, profil dan membership **invited**. Command memakai mutationId + fingerprint dan receipt `staffMutations` agar retry tidak menduplikasi anggota. Auth dan Firestore merupakan dua layanan; jika terjadi kegagalan di antaranya, retry dengan isian/identitas yang sama dapat melanjutkan. Akun Auth lain yang sudah memakai email tersebut tidak dipindahkan ke studio ini.

Server menghasilkan Firebase password reset link sebagai tautan pembuatan password. Tautan hanya ditampilkan kepada owner, tidak disimpan sebagai teks di Firestore, dapat dipilih/disalin dan dibagikan secara pribadi. Screenshot QA menutupi tautan. Ini **bukan pengiriman email undangan otomatis**. Masa berlaku/validasi token dikelola Firebase; owner dapat membuat ulang tautan yang kedaluwarsa selama membership masih invited. Undangan yang dibatalkan sebelum diterima dapat diundang ulang; status kembali invited, bukan langsung aktif, tanpa menggandakan akun.

Setelah staf membuat password melalui tautan dan login, AuthProvider memanggil `staffAccept` dengan identitas Firebase password yang sudah terautentikasi. Server memeriksa UID/email/profil/studio dan invited state, lalu mengaktifkan membership secara atomik dan mencatat acceptedAt. Anonim, owner, studio lain dan staf nonaktif tidak bisa memakai endpoint penerimaan. Tidak ada pendaftaran publik atau pilihan role oleh staf.

Menonaktifkan membership memblokir endpoint server berikutnya dan listener membership mengakhiri sesi aplikasi. Izin laporan tidak otomatis memberi izin mencatat uang; izin pembayaran tidak memberi izin mengubah jadwal atau mengundang staf. Semua raw write users/studios/members/audit/receipts tetap ditolak oleh Rules, termasuk untuk owner aplikasi.

## Bantuan dan Tentang

Route `/help` menjelaskan alur booking, DP, refund, peran, undangan, retry dan laporan. Route `/about` menampilkan fungsi aplikasi, versi dan studio terhubung. Tidak memakai modal fitur segera tersedia untuk menu yang sudah diimplementasikan. Menu diberi label aksesibilitas eksplisit.

## Batas rilis

Pengujian tahap ini menggunakan emulator dan mobile web. Uji perangkat fisik, seluruh Figma 1:1, seluruh edge-state UI, cloud/index provisioning, delivery email otomatis, push perangkat dan avatar upload belum dinyatakan selesai. Panduan sambungan project Firebase ada di `docs/Hubungkan_Firebase.md`. Hasil QA dan bukti run terakhir ada di `design-qa.md`.
