# Implementasi Tahap 4 — Booking dan Kalender

26 Oktober 2026. Expo SDK 58, Firebase Auth/Firestore/Functions Emulator, project `demo-lensflow`. Source dan pemeriksaan backend/SDK selesai; penerimaan UI langsung masih terbuka karena alat browser gagal diinisialisasi. Tidak ada deploy cloud atau transaksi uang.

## Fitur dan penggunaan

Setelah `npm ci`, jalankan `npm run backend:install`. Terminal pertama: `npm run backend:start`; pastikan Auth 9099, Firestore 8082, Functions 5001 tercantum. Terminal kedua: `npm run backend:seed`, lalu `npm start`. Daftar Booking dan Kalender sekarang membaca Firestore; Beranda masih pratinjau sampai Tahap 6. Emulator tanpa impor/ekspor kehilangan data saat dihentikan.

Booking baru dari daftar, Beranda, pelanggan, atau kalender membuka tiga langkah: pelanggan → paket aktif → jadwal/rincian. Paket mengisi harga, durasi dan lokasi; target DP ditampilkan sebelum simpan. Tambah pelanggan dari alur ini menyimpan draft, membuka CRM, lalu menyerahkan ID pelanggan baru kembali ke draft. Izin CRM tetap diperlukan untuk menambah pelanggan; staf booking dapat memilih kontak lama melalui endpoint minimum tanpa mendapat catatan/alamat CRM.

Detail menampilkan status sesi, kontak (untuk operator), snapshot paket, jadwal, catatan, target DP, terbayar dan sisa. Edit rincian hanya mengubah lokasi/catatan. Reschedule mempertahankan identitas dan harga. Pembatalan memerlukan alasan/konfirmasi, melepas slot dan mempertahankan histori. Selesai sesi baru diizinkan setelah jam mulai tercapai; belum lunas tetap ditampilkan sebagai belum lunas. Selesai/batal tidak dapat dibuka kembali. Pencatatan DP, pelunasan dan refund menyusul Tahap 5.

Daftar mempunyai filter gabungan status dan pencarian server atas awalan nama/kata pelanggan, paket, kode atau tanggal ISO. Setiap halaman 25 record; badge menunjukkan jumlah dimuat. Kalender Hari/Minggu memakai agenda berurutan per jam dan tanggal, navigasi periode, input tanggal, Hari ini, serta tombol booking pada tanggal terpilih. Pembatalan tidak ditampilkan sebagai sesi kalender; record tetap ada di daftar/detail. Riwayat pelanggan membaca projection jadwal yang sama.

## Keputusan baseline yang diterapkan

- Satu kalender dengan kapasitas satu sesi; lokasi indoor/outdoor tidak membuat kapasitas paralel. Tidak ada buffer.
- WIB/Asia/Jakarta; UTC Timestamp disimpan. Zona studio lain ditolak secara eksplisit sampai dukungan zona ditambahkan.
- Jam default 08.00–21.00, dikonfigurasi lewat `openingTime`/`closingTime` pada studio. Interval 15 menit, minimal 15 menit, satu tanggal, tidak melewati tengah malam.
- Booking/reschedule hanya mendatang dan maksimal dua tahun ke depan. Backdate belum dibuka untuk owner/staf.
- Interval setengah terbuka: 09.00–10.00 dan 10.00–11.00 sah berdampingan. Sesi selesai tetap mempertahankan interval historis; pembatalan melepas interval.
- DP default 30%, melalui `defaultDpPercent`. Target dihitung half up ke rupiah bulat dan disimpan sebagai snapshot. Perubahan persentase yang belum ditinjau pengguna menolak submit dengan permintaan memilih ulang paket.
- Lifecycle sesi `confirmed | done | cancelled`, pembayaran `pending_dp | dp_paid | paid`. Menyelesaikan sesi tidak mengubah pembayaran. Pembatalan membuat tagihan aktif nol tanpa menghapus pembayaran atau membuat refund.
- Operator booking dapat melihat nilai kontrak pada detail; staf kalender/CRM hanya mendapat projection tanpa nominal/kontak/catatan. Keputusan pengetatan nominal operator pada K01 dapat dikembangkan kemudian tanpa memberi akses kas studio.

## Arsitektur dan koleksi

Callable di region `asia-southeast2`:

| Fungsi | Kegunaan |
|---|---|
| `bookingChoices` | Pelanggan minimum atau paket aktif, search awalan dan cursor 25 pilihan; juga lookup ID untuk handoff |
| `bookingAvailability` | Pemeriksaan awal slot; hasil bersifat informasi, bukan reservasi |
| `bookingCommand` | Create, edit, reschedule, cancel, complete dengan transaksi dan idempotensi |

Semua path di bawah `studios/{studioId}`:

- `bookings/{id}`: kode, identitas pelanggan/paket, snapshot, UTC start/end, tanggal/jam WIB, lokasi/catatan, status sesi/pembayaran, total/targetDP/terbayar, metadata dan versi.
- `sessions/{id}`: projection jadwal dari transaksi yang sama; tanpa telepon/email, catatan, nominal atau snapshot harga. Memuat token pencarian dan stateKey untuk query.
- `scheduleDays/{YYYY-MM-DD}`: daftar interval minimum `{id,startMs,endMs}` serta revision; server-only.
- `bookingCounters/main`: nomor kode `BK-000001` per studio, tidak didaur ulang; server-only.
- `bookingMutations/{uid_mutationId}`: fingerprint input dan hasil command yang sudah committed; server-only.
- `bookings/{id}/events/{mutationId}`: audit aksi, aktor, versi, alasan, jadwal, dan waktu; maksimal 20 terbaru ditampilkan.

Rules menolak seluruh client write pada koleksi di atas. Owner/staf booking membaca detail lengkap dan audit; owner/booking/CRM membaca sessions dengan batas query. Backend memeriksa token Auth, profil, membership aktif, studio dan izin pada setiap command/percobaan ulang. Input tidak dapat menentukan total, paidAmount, status, kode atau aktor sendiri. Akun/paket/klien lintas studio ditolak.

## Transaksi slot dan retry

Create membaca data studio, membership, pelanggan/paket terbaru dan versinya, receipt, penghitung, serta dokumen slot hari yang dituju. Reschedule membaca slot hari lama dan baru. Semua pembacaan selesai sebelum write. Pemeriksaan overlap mengecualikan booking itu sendiri, kemudian booking, projection, slot, audit dan receipt ditulis bersama. Lock dokumen hari tetap dipakai ketika hari sebelumnya kosong; dua reschedule ke hari baru tidak dapat melewati pemeriksaan yang sama. Kegagalan tidak melepaskan slot lama.

Edit/status memerlukan expectedVersion. Versi lama ditolak dan isian dipertahankan. Client menyimpan ID booking dan mutation ID tetap di draft; retry payload sama mengembalikan receipt tanpa record/nomor/audit ganda. Mutation ID dengan payload berbeda ditolak. Bila hasil jaringan belum pasti, ulangi isian yang sama; jika booking sudah tersimpan dengan perubahan input berikutnya, tersedia jalan membuka detail yang sudah ada.

Draft memakai cache memori dari Tahap 3, dibatasi UID/studio/jenis/ID. Logout membersihkan draft dan handoff pelanggan; tidak ada submit otomatis. Reload browser/proses berhenti menghilangkan draft. Ini belum mode offline. Transaksi membutuhkan koneksi server dan hanya menampilkan keberhasilan setelah acknowledgement.

## Verifikasi

- Lint dan TypeScript lulus.
- 23 test aplikasi lulus: regresi akses, formatter, master data, WIB/pergantian tanggal, validasi waktu dan handoff antar akun.
- 35 test integrasi emulator lulus: 14 autentikasi, 8 master data, 12 kelompok command booking, dan 1 alur repository SDK aplikasi.
- Race create hari kosong dan race reschedule dua booking ke hari baru masing-masing hanya menerima satu penulis; interval berdampingan tetap diterima.
- Snapshot/rounding, replay, mutation salah pakai, versi lama, paket berubah/nonaktif, jam studio khusus, pembatalan, selesai sesi, isolasi studio, Rules dan projection diuji.
- Repository yang dipakai aplikasi sendiri diuji end-to-end untuk choices, create, retry, detail, calendar range, edit, reschedule, history/events, availability dan cancel.
- Ekspor bundle Android/iOS/web berhasil. Pemasangan build dan UI melalui browser/perangkat fisik belum diuji pada tahap ini. Detail batas hasil ada di `../design-qa.md`.

Fixture otomatis menggunakan namespace `booking-test-a`, `booking-test-b`, `booking-sdk-test`, dan namespace test sebelumnya. Tidak menyisipkan booking palsu ke Studio Cahaya. Setelah seed, buat pelanggan dan paket sendiri dari aplikasi untuk mencoba alur demo.

## Pekerjaan sebelum produksi

Lengkapi QA interaksi UI pada mobile/web, keyboard/safe area, navigasi Android dan buka WhatsApp. Deploy Rules beserta indeks sessions serta ketiga Functions ke project yang dikonfigurasi secara eksplisit; cloud belum diubah. Deploy backend memerlukan dependensi `backend/functions/package-lock.json`, Node 24, dan konfigurasi layanan yang sesuai. Pertahankan Rules client-write tertutup. Selesaikan pengaturan bisnis/staf, App Check, serta ledger Tahap 5 sebelum pilot yang menerima pembayaran nyata.
