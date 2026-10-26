# Login dan splash — pemeriksaan visual

Tanggal: 17 Oktober 2026.

## Sumber dan bukti

- Login: `C:/Users/Public/Downloads/Login.png`.
- Splash: `C:/Users/Public/Downloads/Splash screen (1).png`.
- Kedua sumber berukuran 430 × 940 piksel. Area layar dinormalisasi dengan crop x=20, y=14, 390 × 900 piksel. Bingkai dan status bar pada gambar merupakan perangkat, bukan elemen aplikasi.
- Viewport browser: 390 × 900 CSS px; hasil screenshot 390 × 900 piksel, skala perbandingan 1:1. Tidak ada pembesaran screenshot untuk penilaian.
- Implementasi: `test-results/login-reference-update.png`, `test-results/splash-reference-update.png`.
- Perbandingan penuh, sumber di kiri: `test-results/login-comparison.png`, `test-results/splash-comparison.png`.
- Detail form: `test-results/login-fields-comparison.png`.
- Detail branding: `test-results/splash-brand-comparison.png`.
- State login: form kosong tanpa error; splash: pemeriksaan sesi dengan progress indeterminate. Splash dipasang sementara untuk screenshot, lalu file layout dikembalikan persis ke versi awal (hash cocok). Tidak ada route preview tambahan atau penundaan buatan.

## Temuan dan pemeriksaan

Tidak ada temuan P0/P1/P2 yang masih perlu diperbaiki.

- **Tipografi:** heading 40/48, subtitle login 20/26, subtitle splash 18/24, label/input 14. Arial pada web/iOS dan sans-serif sistem pada Android. Lebar judul, hierarki dan pemenggalan teks sesuai referensi; rasterisasi browser dan font sistem perangkat dapat sedikit berbeda.
- **Spasi:** logo 72 px, margin form 26 px, input 48 px, tombol 50 px dengan radius 12 px. Susunan elemen mengikuti gambar. Pada layar 320 × 640, halaman dapat di-scroll dan tidak meluber horizontal.
- **Warna:** login memakai latar krem, teks gelap dan tombol hijau; splash memakai emas, putih dan foto studio dengan lapisan hijau gelap. Token global tidak diubah.
- **Aset:** aperture diekstrak dari logo yang diberikan. Foto splash dibuat ulang dari referensi untuk menghilangkan teks dan bingkai; posisi kamera, softbox, tanaman serta nuansa warna dipertahankan, tetapi detail fotografinya tidak identik. Ini merupakan keterbatasan aset sumber, bukan klaim kecocokan piksel penuh.
- **Konten:** copy login dan splash mengikuti referensi; tidak ada copy instruksi implementasi di layar.
- **Interaksi:** validasi form kosong, tampil/sembunyi password, toggle checkbox, navigasi lupa sandi, kembali ke login diperiksa melalui browser. Ingat saya menyimpan email saja setelah login berhasil, tanpa menyimpan password atau mengubah kebijakan sesi Firebase.
- **Log browser:** tidak ditemukan exception aplikasi pada pemeriksaan UI. Peringatan driver animasi web diperbaiki dengan memakai driver JS pada web dan driver native pada perangkat.

## Riwayat perbaikan

1. Mengganti heading/copy, logo dan komposisi login; menghapus dekorasi lama hanya dari login. Default AuthShell, Brand, Button dan tampilan field halaman lain dipertahankan.
2. Menyesuaikan font judul, tinggi input dan jarak antarfield setelah perbandingan awal. Bukti akhir: perbandingan penuh login dan crop detail form.
3. [P2, diperbaiki] Foto splash yang diperbesar sempat memperluas dokumen menjadi 410 × 990. Menambahkan clipping di kontainer splash; ukuran dokumen akhir diperiksa 390 × 900 sesuai viewport. Bukti akhir: perbandingan penuh splash dan crop branding, setelah seluruh gambar selesai dimuat.

## Validasi dan batas pemeriksaan

- Typecheck: lulus.
- Expo lint: lulus.
- Sembilan tes autentikasi yang ada: lulus.
- File root layout dikembalikan; backend, provider autentikasi, dashboard, reset password dan token global tidak diedit.
- Native launch dikonfigurasi memakai dasar hijau dan aperture emas; foto penuh ditampilkan oleh React splash. Perubahan native splash memerlukan rebuild untuk terlihat pada binary aplikasi.
- Belum diuji pada perangkat fisik Android/iOS. Login ke backend tidak diulang pada perubahan visual ini; emulator backend tidak sedang berjalan. Penyimpanan email setelah login sukses belum diuji end-to-end pada perangkat.

## Polish lanjutan

- P3: foto studio asli tanpa overlay akan memberi kecocokan fotografi yang lebih tepat daripada hasil rekonstruksi.
- P3: ketajaman logo dibatasi gambar referensi 72 px; aset vektor asli dapat meningkatkan ketajaman pada layar berdensitas tinggi.

## Checklist

- [x] Membandingkan sumber dan implementasi pada viewport yang sama.
- [x] Memeriksa tipografi, spasi, warna, aset, dan konten.
- [x] Memeriksa detail form dan branding.
- [x] Memperbaiki overflow splash dan memeriksa ulang.
- [x] Menjalankan lint, typecheck, dan tes yang ada.

final result: passed
