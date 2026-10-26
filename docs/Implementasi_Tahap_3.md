# Implementasi Tahap 3 — Pelanggan dan Paket Foto

Tanggal: 26 Oktober 2026. Lingkungan yang diverifikasi: Expo SDK 58, Firebase Auth/Firestore Emulator project `demo-lensflow`. Belum ada deploy ke Firebase cloud.

## Pemakaian

Jalankan backend dan Expo sesuai README, lalu masuk sebagai owner. Tab **Pelanggan** membuka daftar kontak nyata dari Firestore. **Lainnya → Paket Foto** membuka katalog. Data contoh Beranda/Booking tidak dipakai sebagai data pelanggan atau paket.

Tambah/edit pelanggan menerima nama, telepon, email, alamat, sumber, dan catatan. Nomor Indonesia `08…` disimpan sebagai `+62…`; nomor internasional eksplisit dipertahankan. Nomor yang sudah dipakai menampilkan peringatan dan tetap dapat diterima setelah konfirmasi, karena satu keluarga dapat berbagi kontak. Ini peringatan, bukan jaminan keunikan nomor antarpenulisan bersamaan.

Paket menyimpan nama, harga, durasi, jumlah foto edit, lokasi, deskripsi, dan status aktif. Penonaktifan lewat detail meminta konfirmasi. Belum ada penghapusan pelanggan atau paket. Riwayat sesi dan tombol booking memberi informasi ketersediaan Tahap 4; tidak mencatat booking semu.

Pencarian memakai **awalan** nama atau telepon, bukan substring. Daftar dibaca 25 data per halaman dengan satu data tambahan sebagai penanda halaman berikutnya. Badge menampilkan jumlah yang sudah dimuat, bukan total seluruh koleksi. Query nama tidak peka huruf besar/kecil; `08` dan `+62` dikenali pada pencarian telepon. Kembali ke daftar, tarik untuk refresh, dan tombol coba lagi membaca server kembali.

## Hak akses

| Aktor aktif pada studio | Pelanggan | Paket |
|---|---|---|
| Owner | Baca, tambah, edit | Baca semua, tambah, edit, aktif/nonaktif |
| Staf `calendarCrm` | Baca, tambah, edit | Sesuai izin booking |
| Staf `booking` | Sesuai izin CRM | Baca paket aktif |
| Tanpa izin, membership nonaktif, studio lain, anonim | Ditolak | Ditolak |

UI menggunakan izin sesi untuk menampilkan aksi. Firestore Rules memeriksa membership saat setiap permintaan, sehingga menyunting URL, payload, role lokal, atau studioId tidak memperluas akses. Staf booking harus memakai query `isActive == true`, termasuk ketika mencari nama. Perubahan role/membership masih dilakukan melalui proses Admin tepercaya, bukan aplikasi.

## Kontrak data

Lokasi: `studios/{studioId}/clients/{clientId}` dan `studios/{studioId}/packages/{packageId}`.

Metadata kedua entitas: `version` integer mulai 1, `mutationId`, `createdBy`, `updatedBy`, serta `createdAt`/`updatedAt` Firestore Timestamp. Waktu penulisan harus berasal dari server; pembuat dan waktu pembuatan tidak boleh diubah. ID memakai auto ID Firestore.

Pelanggan: `name`, `nameKey`, `phone`, `email`, `address`, `notes`, `leadSource`. Nama 2–100 karakter; telepon format E.164 dengan 8–15 digit; email opsional maksimal 254; alamat 500; catatan 2.000. Sumber: kosong, instagram, whatsapp, referral, google, other. Nama dirapikan, `nameKey` huruf kecil, email dinormalisasi. Field opsional yang kosong disimpan sebagai string kosong.

Paket: `name`, `nameKey`, `price`, `durationMinutes`, `editedPhotosCount`, `defaultLocation`, `description`, `isActive`. Harga integer rupiah 1–1.000.000.000; input `500000` dan `500.000` diterima. Durasi 15–1.440 menit; foto edit integer 0–1.000; lokasi wajib maksimal 200; deskripsi maksimal 1.000; status boolean. Rules menolak field asing dan tipe/nilai di luar kontrak.

Indeks paket `(isActive ASC, nameKey ASC)` ada di `backend/firestore.indexes.json`. Deploy Rules **dan indeks** ke project cloud yang dipilih saat menyiapkan lingkungan tersebut; perintah `firebase deploy --only firestore --project PROJECT_ID_ANDA` dijelaskan di README. Emulator tidak membuktikan kesiapan indeks pada cloud.

## Penyimpanan, kegagalan, dan konflik

Repository berada di `src/features/master-data/repository.ts`; komponen route tipis tetap di `src/app/`. Pembacaan menggunakan server, dibatasi waktu 12 detik, dan tidak menampilkan cache sebagai sukses ketika jaringan gagal. Schema yang rusak menghasilkan error, bukan daftar kosong palsu.

Submit mengunci tombol selama proses, memeriksa membership dari server, lalu melakukan transaksi online. Edit hanya diterima jika versi dokumen masih sama dengan versi yang dibuka. Konflik mempertahankan isian dan memberi pilihan memuat data terbaru setelah konfirmasi. Dokumen baru memiliki ID tetap; payload yang sama mencoba ulang dengan mutation ID yang sama sehingga acknowledgement yang hilang tidak menghasilkan dokumen/versi ganda. Tidak ada timeout buatan pada commit yang dapat mengklaim kegagalan saat penulisan sebenarnya masih berlangsung.

Draft mentah hanya berada dalam memori proses, dibatasi akun + studio + jenis + ID. Draft bertahan saat keluar/masuk layar dan saat pemeriksaan sesi di foreground membongkar layar; logout menghapusnya. Reload browser, proses aplikasi berhenti, atau restart menghilangkan draft. Ini belum penyuntingan offline atau penyimpanan draft permanen.

Perubahan katalog hanya menulis koleksi paket. Modul booking berikutnya wajib menyimpan snapshot pelanggan/paket/harga saat booking dibuat; pengujian memastikan penulisan paket tidak mengubah dokumen snapshot booking yang sudah ada.

## Verifikasi dan batas hasil

- `npm run lint` dan `npm run typecheck`: lulus.
- `npm test`: 19 test lulus, termasuk normalisasi/validasi, izin, contact URL, dan draft.
- Test emulator: 22 test lulus (14 autentikasi + 8 kelompok master data). Menggunakan repository aplikasi sebenarnya; mencakup isolasi studio, membership, write mentah yang dilarang, metadata, konflik/idempotensi, pagination, serta katalog aktif untuk staf.
- Browser lebar 390 px (bukti akhir 390 × 844) dan 320 × 700: tambah/edit pelanggan dan paket; duplikat nomor; perubahan versi oleh perangkat lain; pemulihan draft; filter; akses staf; dan kembali setelah save. Screenshot serta temuan ada di `design-qa.md`.
- Ekspor bundle Android, iOS, dan web berhasil. Belum dilakukan pemasangan build pada perangkat fisik, pengujian keyboard native, atau pembukaan aplikasi Telepon/WhatsApp. Pengujian contact URL tidak mengirim pesan atau melakukan panggilan.

Data uji UI yang tersisa di studio demo: dua kontak berlabel Demo dan satu Paket Portrait Demo. Akun staf UI sementara sudah dihapus. Fixture integration test berada pada namespace `master-test-a`/`master-test-b`. Backend lokal saat ini tidak mengimpor/mengekspor data otomatis; menghentikan emulator menghilangkan data tersebut. Cadangan source code tidak mencadangkan database emulator. Untuk penggunaan data studio sungguhan, selesaikan konfigurasi cloud dan deploy terlebih dahulu.

Tahap berikutnya: alur booking baru yang memilih kontak/paket ini, snapshot, validasi bentrok jadwal secara atomik, daftar/detail booking, dan kalender.
