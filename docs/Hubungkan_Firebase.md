# Menghubungkan LensFlow ke Firebase

LensFlow menggunakan **Firebase Authentication dan Firestore langsung**, tanpa Cloud Functions. Paket Spark dapat digunakan selama pemakaian dalam kuota. Tidak perlu cloudflared atau server aplikasi terpisah.

## Project yang sudah disiapkan

- Project: `lensflow-110d3` (LensFlow).
- Firestore `(default)`: `asia-southeast2`.
- Authentication Email/Password: aktif.
- Owner: `fattatunnidaamalia@gmail.com`, studio `studio-lensflow`.
- `.env` lokal sudah berisi konfigurasi Web App Anda dan mode cloud.
- Billing tidak diaktifkan. Lihat status deployment dan verifikasi terakhir pada `docs/qa/Firestore_Spark_QA.md`.

Owner sudah memiliki profil dan membership. Untuk menentukan password sendiri, gunakan **Lupa kata sandi** pada aplikasi, lalu buka email dari Firebase dan tentukan password. Jangan mengirim password melalui chat. Akun yang hanya ada di Authentication tanpa profil dan membership tidak otomatis memperoleh akses studio.

## Menjalankan aplikasi

Dari folder LensFlow:

```powershell
npm ci
npm start
```

Login dengan email owner dan password yang Anda tentukan. Saat memakai Firebase cloud, tidak perlu menjalankan `backend:start` atau `backend:seed`. Keduanya khusus emulator lokal.

Untuk preview browser gunakan `npm run web`. Untuk ponsel gunakan Expo Go yang kompatibel dengan SDK 58 atau development build. Sesudah aplikasi dibangun menjadi aplikasi terpasang, koneksi Firebase tidak bergantung pada laptop.

## Konfigurasi jika menyiapkan ulang

Ambil nilai dari Firebase Console → Project settings → Your apps → Web app:

```dotenv
EXPO_PUBLIC_FIREBASE_USE_EMULATORS=false
EXPO_PUBLIC_FIREBASE_API_KEY=ISI_DARI_FIREBASE
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=ISI_DARI_FIREBASE
EXPO_PUBLIC_FIREBASE_PROJECT_ID=lensflow-110d3
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=ISI_DARI_FIREBASE
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=ISI_DARI_FIREBASE
EXPO_PUBLIC_FIREBASE_APP_ID=ISI_DARI_FIREBASE
```

Jangan menambahkan `getAnalytics()` pada konfigurasi native. Auth dan Firestore diinisialisasi oleh `src/lib/firebase/client.ts`. Konfigurasi `EXPO_PUBLIC_*` masuk ke aplikasi; isinya hanya identitas publik Firebase. Private key Admin, service account dan password tidak boleh dimasukkan ke sana. Restart Expo setelah mengubah `.env`. Isi konfigurasi publik yang sama pada environment EAS untuk build; preview/production sudah mematikan emulator.

## Deploy aturan dan indeks

```powershell
npx firebase login
npx firebase deploy --only firestore --project lensflow-110d3
```

Perintah hanya menerbitkan Security Rules dan indeks. Tunggu indeks berstatus READY sebelum memakai semua pencarian/laporan. Jangan membuka Rules menjadi public untuk mengatasi error izin. Firebase CLI harus login sebagai akun yang mempunyai akses ke project.

Studio baru diberi `clientBackendVersion=1` oleh provisioning tepercaya. Database yang sudah berisi booking/ledger versi Functions memerlukan migrasi data dan lock lebih dahulu; jangan mengubah flag secara manual pada database lama. Data emulator tidak otomatis berpindah ke cloud.

## Penggunaan awal

1. Tentukan password owner melalui Lupa kata sandi dan login.
2. Atur nama, jam operasional dan target DP studio.
3. Tambahkan pelanggan serta paket, lalu buat booking.
4. Catat DP/pelunasan hanya setelah uang diterima; laporan mengikuti ledger transaksi.
5. Undang staf melalui Kelola Staf. Staf mendaftar/masuk dan memverifikasi email sebelum menerima izin. Tautan dibagikan manual oleh owner.

Inbox diperbarui ketika dibuka, tanpa push/scheduler latar belakang. Pantau Usage di Firebase Console. Foto/avatar upload, push, gateway pembayaran dan publikasi toko aplikasi memerlukan pengerjaan terpisah.

Referensi: [Firebase pricing](https://firebase.google.com/pricing), [Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions), [Expo environment variables](https://docs.expo.dev/guides/environment-variables/).
