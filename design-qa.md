# QA Tahap 2 — design system dan navigasi utama

Tanggal: 25 Oktober 2026. QA autentikasi sebelumnya dipertahankan di `docs/qa/Login_Splash_QA.md`.

## Lingkup dan sumber visual

Sumber: `C:/Users/Public/Downloads/Slice 1 (1).png`, 5397 × 12184 px. Instruksi pekerjaan berasal dari teks terlampir yang meminta melanjutkan Tahap 2 yang terhenti. Penilaian ini mencakup kerangka lima tab, fondasi UI, serta komposisi Beranda dan pratinjau Booking. Ini bukan penerimaan seluruh layar atau integrasi bisnis pada board.

- Crop Beranda: x=3330, y=582, 390 × 900 px, `test-results/stage2-home-reference.png`.
- Crop Booking: x=3753, y=582, 390 × 900 px, `test-results/stage2-bookings-reference.png`.
- Browser-rendered implementation: `test-results/stage2-home.png`, `test-results/stage2-bookings.png`, `test-results/stage2-more.png`.
- Full-view comparisons: `test-results/stage2-home-comparison.png`, `test-results/stage2-bookings-comparison.png`; sumber di kiri dan implementasi di kanan.
- Focused comparison: `test-results/stage2-tabs-comparison.png` dan `test-results/stage2-header-comparison.png`.
- Compact evidence: `test-results/stage2-home-compact.png`, `test-results/stage2-bookings-compact.png`.

## Viewport, normalisasi dan state

Viewport utama 390 × 900 CSS px; screenshot 390 × 900 px; browser melaporkan DPR sekitar 1. Tidak ada pembesaran screenshot implementasi untuk perbandingan. Referensi di-crop dari board pada resolusi aslinya. Status bar, bingkai bulat perangkat dan home indicator pada referensi dikecualikan dari penilaian konten aplikasi; web preview tidak menggambarnya ulang. Perbandingan detail memeriksa header dan navigasi secara terpisah agar perbedaan device chrome tidak dinilai sebagai bug.

State: owner demo terautentikasi; data Beranda dan Booking adalah fixture lokal yang diberi label Pratinjau. Tanggal menampilkan hari berjalan dalam zona Jakarta. Kalender dan Pelanggan tetap kerangka fitur mendatang. Uji tambahan pada 320 × 700 CSS px menunjukkan lebar dokumen 320 px tanpa overflow horizontal; konten dapat di-scroll sementara tab bar tetap tersedia.

## Evaluasi lima permukaan visual

- **Tipografi:** sistem sans-serif dengan judul 24–25 px, label/kartu 11–16 px dan tab 10 px. Hierarki judul, KPI, nama pelanggan dan status mengikuti referensi. Pemenggalan teks pada 320 px tetap terbaca; panjang nama dan label tidak mendorong kontrol keluar viewport. Font asli Figma tidak disertakan, sehingga rasterisasi dan metrik font masih dapat berbeda.
- **Spasi dan layout:** header hijau, dua KPI, daftar jadwal dan CTA hijau mengikuti susunan sumber. Margin 18–22 px, radius dan spacing menggunakan token. Lima tab berada di bawah konten, bukan overlay yang menutupi tombol. Chip dapat digeser horizontal pada layar sempit. Banner pratinjau menambah tinggi yang disengaja agar angka contoh tidak tampak sebagai transaksi nyata.
- **Warna:** ink hijau dan krem memakai token proyek; status memakai green/amber/red pastel. Warna teks amber digelapkan untuk keterbacaan. CTA tahap ini memakai tone brand, sedangkan default tombol autentikasi tetap dipertahankan.
- **Aset dan ikon:** memakai ikon Feather yang sudah tersedia; tidak ada logo atau ilustrasi pengganti hasil CSS/SVG buatan. Ikon tab mengikuti fungsi Beranda, Booking, Kalender, Pelanggan dan Lainnya. Aset login/splash tidak diubah. Tidak ada aset foto baru dalam lingkup Tahap 2.
- **Copy dan data:** judul, struktur kartu, label navigasi dan aksi mengikuti referensi. Nama fixture diambil sebagai contoh UI, selalu disertai penanda pratinjau. Kalender/CRM dan fitur lain yang belum terhubung menyatakan ketersediaan, tanpa mengklaim penyimpanan atau transaksi berhasil. Profil akun memakai data Firebase sebenarnya.

## Riwayat temuan dan perbaikan

1. **P1, diperbaiki — route `/home` ganda.** Halaman akun lama dan Beranda dalam `(tabs)` memakai URL yang sama. Halaman lama dihapus dari route tree, Stack menunjuk `(tabs)`, dan `/home` tetap menjadi URL awal. Bukti akhir: login menuju Beranda beserta kelima tab, reload memulihkan sesi; ekspor route dan typecheck lolos.
2. **P1, diperbaiki — kode navigasi belum lolos tipe SDK 58.** Ikon kini menerima string warna token yang pasti, tanpa `any`/type suppression. Konfigurasi tab mengikuti API terpasang. Tipe route dihasilkan oleh Expo CLI setelah restart, tanpa mengedit file generated. File non-route tidak muncul sebagai route setelah regenerasi.
3. **P2, diperbaiki — angka contoh tampak sebagai KPI studio.** Data dipisahkan di `features/preview` dan banner pratinjau ditampilkan pada kedua layar yang memakainya. Lihat perbandingan penuh akhir; tambahan banner merupakan perbedaan yang disengaja.
4. **P2, diperbaiki — menu tanpa respons.** Menu fitur mendatang sekarang membuka dialog informasi. Profil menampilkan akun aktif; dialog ditutup tanpa flash konten kosong. Tidak ada callback kosong. Bukti akhir: dialog Booking baru dan Profil diuji melalui browser.
5. **P2, diperbaiki — izin staf belum diterapkan pada shell baru.** Akun staf sementara dengan empat izin nonaktif diuji melalui login Firebase. KPI keuangan dan menu Keuangan/Laporan/Kelola Staf tidak muncul; Booking, Kalender dan Pelanggan menampilkan akses terbatas. Fixture akun staf dihapus setelah pengujian. Bukti tambahan: `test-results/stage2-staff.png`.
6. **P2, diperbaiki — aksesibilitas kontrol.** Tab memiliki nama aksesibel, tombol clear/back/chip minimal 44 px, input pencarian memiliki label dan peran input standar. Reset pencarian dibedakan dari tombol clear. Filter, clear dan kondisi hasil kosong sudah diuji.

Tidak ada temuan P0/P1/P2 terbuka untuk lingkup Tahap 2.

## Verifikasi fungsi dan build

- Login owner → Beranda dan kelima tab.
- Filter Menunggu → satu hasil; pencarian gabungan filter → tanpa hasil; reset → semua hasil; pencarian paket tidak membedakan kapital; clear mengembalikan hasil.
- Switch Hari/Minggu; pencarian/clear pada kerangka Pelanggan.
- Profil menampilkan nama/email/studio/peran sebenarnya. Dialog fitur mendatang terbuka dan tertutup.
- Batal logout mempertahankan sesi, konfirmasi logout kembali ke Login. Membuka `/bookings` tanpa sesi diarahkan ke Login.
- Reload `/home` memulihkan sesi dan tab bar.
- Staff test memverifikasi pembatasan UI di atas; Rules bisnis tidak diperluas.
- Console browser pasca-perbaikan: tidak ada error aplikasi saat smoke test.
- `npm run typecheck`: lulus.
- `npm run lint`: lulus tanpa warning.
- `npm test`: 13/13 lulus; mencakup 9 tes auth yang ada dan 4 tes format Rupiah, pergantian hari Jakarta, tanggal invalid dan nomor internasional.
- Expo export Android/iOS/web: lulus, artefak di `test-results/stage2-export`. Ini validasi bundle JS/Hermes, bukan uji APK/IPA atau perangkat fisik.

## Batas dan polish berikutnya

- Kalender operasional, penyimpanan pelanggan/paket, bentrok booking, pembayaran, laporan dan undangan staf belum termasuk tahap ini; lihat roadmap.
- P3: penyamaan font, ikon calendar-check persis dan ritme pixel detail dapat disempurnakan pada polish 1:1 setelah aset desain lengkap tersedia. Foto/bingkai perangkat pada board tidak dibuat ulang.
- UI baru belum diuji di perangkat fisik; safe area dan status bar native dikonfigurasi melalui Expo/React Native.
- Emulator lokal Firestore menggunakan 8082 karena 8080 dipakai program lain. Auth 9099 dan UI 4000; project cloud tidak diubah.

## Checklist

- [x] Sumber dan render aktual dibandingkan bersama pada ukuran yang sama.
- [x] Header dan tab bar dibandingkan secara terfokus.
- [x] Lima permukaan visual, ukuran 390/320 dan state inti diperiksa.
- [x] Login, navigasi, dialog, pencarian, logout dan pembatasan staf diuji.
- [x] Typecheck, lint, tests dan export bundel selesai.

final result: passed
