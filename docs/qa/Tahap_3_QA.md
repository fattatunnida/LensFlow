# QA Tahap 3 — Pelanggan dan Paket Foto

Tanggal: 26 Oktober 2026. Laporan Tahap 2 dipertahankan di `docs/qa/Tahap_2_QA.md`; autentikasi awal di `docs/qa/Login_Splash_QA.md`.

## Lingkup dan sumber

Tahap ini mencakup daftar, tambah, detail, dan edit pelanggan/paket yang benar-benar membaca serta menulis Firestore. Referensi visual: gambar pengguna `C:/Users/Public/Downloads/Slice 1 (1).png` (5397 × 12184), crop pelanggan/paket x=2908, y=1605, 810 × 950 pada `test-results/stage3-reference-lists.png`. Figma MCP tidak digunakan; tidak diklaim sebagai pencocokan 1:1 seluruh desain.

Pengujian menggunakan project emulator `demo-lensflow`, Auth 9099, Firestore 8082, dan Expo lokal 8081. Viewport bukti daftar akhir 390 × 844 CSS px, compact 320 × 700, DPR sekitar 1. Bukti alur awal memakai viewport 390 × 900; beberapa capture dibatasi tinggi browser 875 px, sehingga bukti daftar akhir diambil ulang pada tinggi 844 agar navigasi bawah terlihat lengkap. Bingkai perangkat dan status bar pada board bukan konten aplikasi web. Ukuran viewport pengujian dikembalikan sesudah selesai.

## Penerimaan fungsi

| Alur | Hasil yang diamati |
|---|---|
| Daftar awal | Membaca server; kosong menampilkan ajakan tambah, tanpa pelanggan/paket contoh tersembunyi |
| Validasi pelanggan | Nama/telepon kosong ditolak; kesalahan inline dan ringkasan di dekat Simpan; form tetap tersedia |
| Simpan pelanggan | Rina Amelia Demo tersimpan; 081234500011 menjadi +6281234500011; email dirapikan; detail memuat nilai dari server |
| Edit pelanggan | Catatan tersimpan dan dibaca ulang; metadata pembuatan tetap |
| Perubahan bersamaan | Versi dokumen dinaikkan oleh fixture perangkat lain; edit versi lama ditolak, isian pengguna tetap ada |
| Pemulihan konflik | Konfirmasi memuat versi terbaru mengganti isian; edit berikutnya berhasil |
| Duplikat nomor | Peringatan menyebut kontak lama; Periksa kembali mempertahankan isian; Tetap simpan menerima kontak keluarga kedua |
| Cari pelanggan | Awalan nama tidak peka huruf besar/kecil dan telepon 08 dikenali; reset memuat daftar kembali |
| Tambah/edit paket | Harga 0 ditolak; 500.000 tersimpan sebagai integer 500000; durasi 90 menit dan 12 foto edit terbaca kembali |
| Status paket | Konfirmasi Nonaktifkan mengubah server; filter aktif menjadi kosong dan nonaktif menampilkan paket; aktivasi kembali melalui edit berhasil |
| Navigasi | Setelah edit/save, detail dibaca ulang; Kembali menghapus layar dari stack dan langsung membuka daftar |
| Staf booking | Paket aktif terlihat; tidak ada tambah/edit/toggle; tab pelanggan menampilkan Akses terbatas |
| Staf CRM | Daftar pelanggan dan tambah tersedia; menu paket tidak tersedia tanpa izin booking |
| Draft | Keluar/masuk form memulihkan draft memori; logout membersihkan draft dan akun berikutnya mendapat form kosong |
| Compact | Daftar pelanggan, katalog, dan form dapat dipakai pada 320 px; lebar dokumen 320 px; tombol Simpan dapat dicapai melalui scroll |

Tombol Telepon dan WhatsApp terlihat pada detail pelanggan. URL diuji melalui unit test. Aplikasi eksternal tidak dibuka sehingga tidak ada panggilan atau pesan uji kepada kontak.

## Verifikasi otomatis

- `npm run lint`: lulus tanpa peringatan.
- `npm run typecheck`: lulus.
- `npm test`: 19/19 lulus, mencakup autentikasi, formatter, validasi master data, akses, URL kontak, dan draft.
- Test integrasi emulator: 22/22 lulus, termasuk 14 regresi autentikasi dan 8 kelompok master data. Test mengimpor repository yang dipakai aplikasi; Rules juga diuji dengan write mentah yang tidak sah.
- Isolasi studio, pengguna anonim, membership nonaktif, izin salah, schema, field asing, metadata, penghapusan, increment versi, idempotensi, duplikat, pagination 25+2, dan katalog aktif staf diperiksa di emulator.
- Ekspor Expo Android, iOS, dan web berhasil; log final `test-results/stage3-final-export.log`. Ini verifikasi bundle, bukan pemasangan build pada perangkat.
- Log error browser pada pemeriksaan akhir: kosong.

## Bukti tersimpan

- `test-results/stage3-clients.png`: daftar dua pelanggan nyata di emulator.
- `test-results/stage3-client-detail.png`: kontak, alamat, sumber, dan catatan.
- `test-results/stage3-conflict.png`: versi lama ditolak dan draft tetap terlihat.
- `test-results/stage3-duplicate.png`: konfirmasi nomor yang sudah dipakai.
- `test-results/stage3-packages.png`, `stage3-package-detail.png`: katalog dan detail hasil penyimpanan.
- `test-results/stage3-staff-package.png`, `stage3-staff-denied.png`: katalog hanya baca dan penolakan CRM tanpa izin.
- `test-results/stage3-clients-compact.png`, `stage3-packages-compact.png`, `stage3-form-compact.png`, `stage3-form-validation-compact.png`: ukuran 320 × 700.
- `test-results/stage3-unit-test.log`, `stage3-backend-test.log`: hasil test. Error PERMISSION_DENIED di log backend merupakan kasus negatif yang disengaja.

## Pemeriksaan visual

- **Tipografi:** judul 24 px, judul kartu 16–20 px, isi 14 px, keterangan lebih kecil. Nama membungkus pada 320 px dan tetap terbaca. Font memakai sistem yang sudah ada; metrik font Figma belum diverifikasi.
- **Spasi/layout:** margin 18 px, kartu putih beradius 14 px, pemisahan field, form scrollable, CTA daftar di bawah konten, detail/form di Stack luar tab. Search field tidak kehilangan fokus setiap karakter. Chip dapat digeser horizontal.
- **Warna:** memakai token krem, hijau tua, putih, status hijau/abu, dan error merah dari proyek. Login/splash dan token global tidak diubah.
- **Aset/ikon:** kontak nyata menggunakan inisial, paket menggunakan Feather package; tidak menampilkan foto pelanggan/paket fiktif. Foto avatar dan thumbnail seperti referensi menunggu alur unggah aset.
- **Copy/data:** jumlah menunjukkan data yang sudah dimuat; tidak mengarang jumlah booking, riwayat sesi, atau harga dari fixture. Fitur booking menjelaskan ketersediaannya. Field opsional yang kosong memiliki keterangan jelas.

## Temuan yang sudah diperbaiki

1. Navigasi sebelumnya dapat meninggalkan detail ganda setelah edit pada preview web. Aksi selesai edit/kembali kini memakai dismiss stack; pengujian baru dari daftar mengonfirmasi satu klik Kembali menuju daftar.
2. Nama sumber list/search sempat berisiko remount saat render. Header sekarang elemen stabil sehingga input tetap dapat diketik.
3. Konflik edit mempertahankan draft; reload hanya setelah konfirmasi. Retry memakai mutation ID yang sama, dan callback terlambat tidak membersihkan draft yang lebih baru.
4. Pesan error inline di atas form sulit diketahui saat tombol Simpan berada di bawah pada 320 px. Ringkasan error ditambahkan di dekat tombol.

## Batas penerimaan yang masih terbuka

- **P3 visual:** header daftar memakai komponen putih/krem proyek, sementara board menampilkan header hijau. Foto/thumbnail dan metrik font belum disamakan. Pencocokan 1:1 seluruh layar tetap Tahap 9.
- **Tahap 4:** riwayat/jumlah booking, form booking, bentrok jadwal, dan kalender belum terhubung. Placeholder menyatakan hal ini; tidak ada penulisan booking dari Tahap 3.
- Belum diuji pada perangkat fisik: keyboard, safe area native, tombol Back Android, dan pembukaan Telepon/WhatsApp. Tidak diklaim lulus.
- Pembacaan/penyimpanan memerlukan koneksi server. Draft hanya memori, bukan dukungan offline. Belum dilakukan simulasi jaringan terputus di browser; penanganan gagal baca tersedia, konflik/server denial diuji.
- Rules dan indeks belum dideploy ke cloud. Data emulator hilang saat backend dihentikan tanpa ekspor; cadangan source tidak mencakup database.

Tidak ada kegagalan fungsi Tahap 3 yang diketahui setelah pemeriksaan ini. Penerimaan terbatas pada lingkungan emulator dan preview browser yang disebutkan di atas.
