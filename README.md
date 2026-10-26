# LensFlow

Aplikasi studio foto dengan React Native, Expo SDK 58, Expo Router, Firebase Authentication dan Cloud Firestore.

**Backend saat ini memakai Firestore langsung pada paket Spark.** Aplikasi tidak memanggil Cloud Functions. Tidak membutuhkan cloudflared atau komputer yang terus menyala untuk mengakses Firebase cloud.

## Fitur

Splash/login, sesi dan logout, pelanggan, paket foto, booking dan kalender, pemeriksaan bentrok jadwal, ubah jadwal, pembatalan, DP/pelunasan, refund, pengeluaran, laporan kas, Beranda, inbox, preferensi, pengaturan studio/profil/password, undangan dan izin staf.

Booking dan keuangan disimpan sebagai transaksi atomik. Security Rules memeriksa akses studio, harga paket, versi, jadwal, nominal, ledger dan dokumen pasangannya. Ledger tidak dapat diedit/dihapus dari aplikasi. Izin staf terdiri dari booking, kalender/CRM, pembayaran dan laporan; owner mengatur akses.

## Firebase Anda

Konfigurasi lokal menunjuk project `lensflow-110d3`, studio `studio-lensflow`, owner `fattatunnidaamalia@gmail.com`. Jangan menimpa `.env` yang sudah terisi. Panduan dan status deployment terbaru: [Hubungkan Firebase](docs/Hubungkan_Firebase.md).

Untuk menjalankan aplikasi dengan Firebase cloud:

```powershell
npm ci
npm start
```

Pastikan `.env` berisi `EXPO_PUBLIC_FIREBASE_USE_EMULATORS=false`. Restart Expo setelah mengganti konfigurasi. Untuk ponsel, gunakan Expo Go yang mendukung SDK proyek atau development build. Aplikasi yang sudah dibangun tetap mengakses Firebase tanpa laptop; Expo development server hanya diperlukan selama pengembangan.

## Pengembangan lokal dengan emulator

Prasyarat: Node 24.12+, npm dan Java 21+. Untuk lingkungan uji terpisah, salin `.env.example` ke `.env` dan gunakan `EXPO_PUBLIC_FIREBASE_USE_EMULATORS=true`. Jangan menimpa konfigurasi cloud tanpa menyimpannya terlebih dahulu.

Terminal pertama:

```powershell
npm run backend:start
```

Terminal kedua:

```powershell
npm run backend:seed
npm start
```

Akun demo khusus emulator: `owner@lensflow.test` / `LensFlowDemo2026!`. Emulator UI: http://127.0.0.1:4000. Data demo tidak otomatis dipindahkan ke cloud dan tidak dipertahankan setelah emulator dihentikan.

`EXPO_PUBLIC_FIREBASE_EMULATOR_HOST`: browser `127.0.0.1`, Android emulator `10.0.2.2`, ponsel IPv4 LAN komputer. Auth memakai port 9099 dan Firestore 8082. Mode tunnel Expo meneruskan Metro, bukan emulator Firebase. Firebase cloud tidak membutuhkan pengaturan host emulator.

## Undangan staf

Owner membuat undangan untuk email dan izin tertentu, lalu membagikan tautan dari Kelola Staf. Staf membuka tautan, mendaftar atau masuk, memverifikasi email melalui Firebase, lalu menekan **Saya sudah verifikasi email**. Transaksi claim membuat profil dan membership staf dengan izin persis dari undangan. Undangan berlaku hingga tujuh hari, dapat dibatalkan atau diterbitkan ulang sebelum diterima. Owner awal disiapkan melalui proses tepercaya; aplikasi tidak menyediakan pendaftaran owner atau perubahan role sendiri.

## Pemeriksaan

```powershell
npm run lint
npm run typecheck
npm test
npm run test:backend
```

`test:backend` menjalankan Auth dan Firestore emulator sementara, lalu skenario Spark. Hentikan emulator manual terlebih dahulu jika port sama. Test menolak target selain emulator loopback. File test Functions lama dipertahankan sebagai arsip dan tidak termasuk perintah test default.

E2E memerlukan emulator dan Expo web dalam mode emulator. Jangan arahkan pengujian ke Firebase cloud:

```powershell
npx playwright install chromium
npm run test:e2e
```

Base URL default `http://localhost:8081`; gunakan `E2E_BASE_URL` untuk server uji lain. Bukti dan laporan pengujian ada di `test-results/`, ringkasan terbaru di [QA Firestore Spark](docs/qa/Firestore_Spark_QA.md).

## Struktur

- `src/app/`: route Expo Router.
- `src/features/spark/`: transaksi dan pembacaan langsung Firestore.
- `src/features/auth/`: sesi, splash, login dan penerimaan undangan.
- `src/features/master-data/`, `bookings/`, `finance/`, `overview/`, `management/`: fitur aplikasi.
- `backend/firestore.rules`, `backend/firestore.indexes.json`: aturan dan indeks cloud/emulator.
- `backend/scripts/`: provisioning owner tepercaya dan seed emulator.
- `backend/functions/`: implementasi lama untuk referensi; tidak dipakai aplikasi dan tidak dideploy dari konfigurasi default.

## Batas saat ini

Spark memiliki kuota; gratis selama penggunaan berada dalam batas layanan. Laporan dibatasi 5.000 transaksi per permintaan/periode, dengan pesan untuk memperpendek periode jika terlampaui. Inbox dihitung saat dibuka: ringkasan jadwal hari ini, pengingat H-1/H-3 yang masih berlaku, dan pembayaran 30 hari terakhir. Tidak ada scheduler atau push perangkat otomatis.

Upload avatar/foto, push, pembayaran gateway, App Check produksi, pengujian perangkat fisik dan publikasi toko aplikasi belum termasuk. Bundle Android/iOS/web yang berhasil diekspor belum membuktikan pengujian native pada perangkat. Dokumen implementasi Tahap 1–8 menyimpan riwayat arsitektur lama; [Migrasi Firestore Spark](docs/Migrasi_Firestore_Spark.md) menjelaskan penggantinya.

Referensi: [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions), [Firebase pada Expo](https://docs.expo.dev/guides/using-firebase/).
