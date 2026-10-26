# QA Tahap 4 — Booking dan Kalender

26 Oktober 2026. QA Tahap 3 dipertahankan di `docs/qa/Tahap_3_QA.md`. Laporan ini membedakan hasil pengujian layanan/SDK dari penerimaan UI yang belum dijalankan.

## Status penerimaan

Implementasi tersedia: form tiga langkah, pilihan pelanggan/paket aktif, snapshot, daftar/detail booking, edit lokasi/catatan, reschedule, cancel dengan alasan, selesai sesi, audit, kalender Hari/Minggu, dan riwayat pelanggan. Login/splash dan desain tab yang sudah ada tidak didesain ulang. Beranda tetap berlabel Pratinjau; daftar Booking tidak lagi memakai fixture.

Lint dan TypeScript lulus. 23 test aplikasi dan 35 test integrasi emulator lulus. Bundle Android, iOS, web berhasil diekspor. Ini mengonfirmasi logika, kontrak data dan bundling; belum mengonfirmasi interaksi, layout, aksesibilitas atau keyboard pada UI baru.

## Bukti yang benar-benar dijalankan

| Pengujian | Hasil |
|---|---|
| Create booking melalui HTTPS callable | Snapshot pelanggan/paket, harga, target DP half up, metadata, kode dan audit tersimpan |
| Retry setelah hasil belum pasti | Receipt sama; versi, nomor dan audit tidak bertambah |
| Mutation key dipakai untuk input lain | Ditolak |
| Dua create ke slot kosong bersamaan | Tepat satu berhasil; lainnya ditolak bentrok |
| Dua reschedule dari tanggal berbeda ke satu slot baru | Tepat satu berhasil; yang kalah mempertahankan jadwal dan versi lama |
| Interval 09.00–10.00 / 10.00–11.00 | Boleh berdampingan |
| Reschedule interval sendiri | Diperbolehkan; pemeriksaan mengecualikan ID yang diubah |
| Reschedule ke interval terisi | Ditolak; tidak melepas jadwal lama |
| Reschedule lintas tanggal | Slot lama dilepas dan slot baru disimpan bersama |
| Edit versi usang | Ditolak; tidak menimpa perubahan lain |
| Katalog diubah setelah booking | Snapshot harga/nama booking tetap |
| Paket nonaktif, referensi hilang/lintas studio, versi paket usang | Ditolak saat submit |
| Tanggal/jam tidak sah, lampau, luar jam, interval bukan 15 menit, total dari client | Ditolak |
| Jam studio khusus dan DP berubah | Konfigurasi server dipakai; quote DP usang meminta pemilihan ulang |
| Pembatalan | Slot dilepas; pembayaran tetap; tidak ada refund/transaksi uang baru |
| Selesai sesi | Ditolak sebelum mulai; setelah mulai status done, pembayaran tetap pending bila belum dibayar |
| Batal/selesai diubah lagi | Ditolak |
| Tanpa izin, membership nonaktif, studio lain, anonim | Ditolak |
| Izin salah tipe string | Tidak diperlakukan sebagai boolean true |
| Client write langsung booking/projection/slot/counter/receipt/audit/delete | Ditolak Rules, termasuk untuk owner |
| Staf kalender/CRM | Membaca projection tanpa kontak/catatan/nominal; tidak dapat membaca booking lengkap atau melakukan command |
| Pilihan pelanggan untuk operator | Maksimal 25 per halaman, nomor dinormalisasi, tidak mengirim catatan/alamat CRM |
| Search/filter/pagination jadwal | Query server gabungan, halaman berikutnya tanpa duplikasi fixture |
| SDK repository aplikasi | Choices → create → retry → detail/rentang kalender → edit → reschedule → history/events → cancel lulus |
| Helper WIB dan handoff | Pergantian hari/tahun, waktu invalid, pemisahan akun/studio, pembatalan read dan logout diperiksa |

Pemeriksaan menggunakan Auth 9099, Firestore 8082, Functions 5001 project `demo-lensflow`. Fixture hanya pada `booking-test-a`, `booking-test-b`, `booking-sdk-test`, serta namespace test autentikasi/master terdahulu. Tidak ada transaksi sungguhan, panggilan, WhatsApp atau deployment cloud.

## Artefak pemeriksaan

- `test-results/stage4-unit-tests.log`: 23 test aplikasi.
- `test-results/stage4-backend-tests.log`: 35 test integrasi. PERMISSION_DENIED adalah kasus negatif yang disengaja.
- `test-results/stage4-app-sdk.log`: alur awal repository SDK aplikasi (juga termasuk dalam suite final).
- `test-results/stage4-final-export.log` dan `stage4-final-export/metadata.json`: bundle tiga platform.
- `test-results/stage4-backend.log`, `stage4-metro.log`: kesiapan layanan lokal.
- `test-results/stage4-backup.json`: lokasi/hash cadangan source setelah pekerjaan selesai; bukan cadangan database.

## Hambatan pemeriksaan UI

Kontrol browser gagal sebelum dapat membaca atau mengoperasikan halaman: runtime melaporkan kegagalan menulis kernel assets karena path tidak ditemukan. Reset dan inisialisasi ulang gagal; runtime alternatif juga gagal dengan sebab yang sama. Karena itu tidak dibuat screenshot baru dan screenshot Tahap 3 tidak dipakai sebagai bukti Tahap 4. Preview dapat dibuka untuk pemeriksaan manual, tetapi pembukaan tab sendiri bukan bukti UI lulus.

Tampilan mempertahankan token, komponen dan navigasi Expo Router yang ada. Daftar/kalender memakai FlatList, pilihan dibatasi 25 record yang ditampilkan per halaman, dan form memakai ScrollView/KeyboardAvoidingView. Hal-hal ini diperiksa dari source dan bundle; hasil visualnya belum diukur pada 320/390 px atau perangkat fisik.

## Checklist penerimaan UI yang masih terbuka

1. Buat pelanggan dari dalam booking dan pastikan pelanggan terpilih setelah kembali tanpa kehilangan draft.
2. Pilih paket, periksa harga/durasi/lokasi/target DP, simpan, dan pastikan detail serta kalender memuat record yang sama.
3. Coba slot terisi; modal bentrok harus mempertahankan semua isian.
4. Ubah jadwal dan lokasi/catatan, lalu kembali; periksa filter, histori dan slot lama/baru.
5. Batalkan setelah alasan/konfirmasi; periksa record tetap ada dan kalender tidak mengisi slot tersebut.
6. Uji tampilan staf kalender dan operator; tidak ada aksi atau data di luar izin.
7. Uji 320 px, keyboard native, safe area, tombol Back Android, waktu mulai untuk selesai sesi, dan pemulihan koneksi.

Pencocokan 1:1 terhadap board Figma, pemeriksaan aksesibilitas dan pemasangan build Android/iOS tetap belum diterima. Ledger, DP/pelunasan, refund, laporan dan dashboard dinamis tidak termasuk implementasi Tahap 4.
