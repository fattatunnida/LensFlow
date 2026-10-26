# LensFlow

Aplikasi operasional studio foto dengan React Native, Expo Router, Firebase Authentication, dan Cloud Firestore. Tahap pertama mengimplementasikan **backend akun dan akses studio → Splash → Login → halaman akun studio**, termasuk logout dan permintaan email reset password.

Tahap 2 menyediakan UI kit dan lima tab **Beranda, Booking, Kalender, Pelanggan, Lainnya**. `/home` hanya dimiliki oleh `src/app/(app)/(tabs)/home.tsx`. Beranda masih memakai **data contoh berlabel pratinjau** sampai Tahap 6; angka tersebut bukan data keuangan studio.

Tahap 3 menghubungkan **Pelanggan** dan **Lainnya → Paket Foto** ke Firestore: tambah/edit, detail, pencarian awalan nama/telepon, peringatan nomor duplikat, dan status paket aktif/nonaktif. Rules membatasi data per studio dan izin pengguna. Penyimpanan memakai transaksi, pemeriksaan versi, dan ID percobaan yang tetap untuk mencegah duplikasi saat mencoba ulang. Lihat [catatan Tahap 3](docs/Implementasi_Tahap_3.md).

Tahap 4 mengganti daftar Booking dan Kalender dengan data Firestore, menambahkan form tiga langkah, detail, edit lokasi/catatan, ubah jadwal, pembatalan, selesai sesi, dan riwayat booking pelanggan. Penyimpanan lewat **Firebase Callable Functions** memeriksa akses, harga snapshot, jam operasional, versi, serta bentrok slot secara atomik. Status sesi terpisah dari pembayaran; target DP tidak mencatat kas. Lihat [catatan Tahap 4](docs/Implementasi_Tahap_4.md).

Tahap 5 menambahkan **Lainnya → Keuangan**, DP/pelunasan, pengeluaran owner, refund booking batal yang terikat pembayaran asal, riwayat ledger, dan ringkasan kas bulanan per metode. Transaksi diposting melalui server dan tidak dapat diedit/dihapus lewat aplikasi. Ledger, saldo booking, projection status, dan ringkasan kas diperbarui bersama. Lihat [catatan Tahap 5](docs/Implementasi_Tahap_5.md). Beranda dinamis/notifikasi dan laporan analitis tetap Tahap 6–7.

## Jalankan lokal

Prasyarat: Node.js 24.12 atau lebih baru, npm, serta Java 21 atau lebih baru untuk Firestore Emulator. Dependensi aplikasi dikunci di `package-lock.json`.

```powershell
npm ci
npm run backend:install
Copy-Item .env.example .env
```

Terminal pertama, jalankan Firebase Auth, Firestore, dan Functions lokal:

```powershell
npm run backend:start
```

Terminal kedua, buat akun owner demo dan jalankan Expo:

```powershell
npm run backend:seed
npm start
```

Akun **khusus emulator lokal**:

- Email: `owner@lensflow.test`
- Password: `LensFlowDemo2026!`
- Studio: Studio Cahaya

Emulator UI: <http://127.0.0.1:4000>. Menjalankan emulator tidak membutuhkan project Firebase cloud. Data emulator tidak dipertahankan setelah proses dihentikan; jalankan seed lagi saat memulai ulang. Seed yang dijalankan ulang mempertahankan password akun yang sudah ada. Bila password demo pernah diubah melalui reset, gunakan password baru atau mulai ulang emulator.

Untuk preview browser, jalankan `npm run web`. Untuk Android/iOS, gunakan Expo Go yang mendukung SDK proyek atau development build. Build native diperlukan untuk memverifikasi splash asli; Expo Go tidak mereplikasi seluruh tampilannya.

### Menyambungkan perangkat

Atur `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` di `.env`:

| Perangkat | Nilai host |
| --- | --- |
| Browser di komputer yang sama | `127.0.0.1` |
| Android Emulator bawaan Android Studio | `10.0.2.2` |
| Ponsel fisik di Wi-Fi yang sama | IPv4 LAN komputer, misalnya `192.168.1.10` |

Cari IPv4 menggunakan `ipconfig`, lalu restart Expo setelah mengubah `.env`. Untuk ponsel, pastikan jaringan privat mengizinkan akses port 8082 (Firestore), 9099 (Auth), dan 5001 (Functions). Firestore memakai 8082 agar tidak berbenturan dengan layanan lain pada 8080. Jika `.env` lama masih berisi 8080, ubah `EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT=8082`. Emulator tidak memiliki perlindungan admin seperti layanan produksi; jangan membukanya ke internet. Mode tunnel Expo hanya meneruskan Metro, bukan koneksi ke Firebase Emulator.

Jika backend sudah berjalan dari versi sebelum Tahap 4, hentikan dan jalankan kembali `npm run backend:start` setelah memasang dependensi Functions. Pastikan daftar emulator mencantumkan **Functions :5001**. Hindari menghentikan backend yang berisi data penting tanpa mengekspor data terlebih dahulu. Default booking: WIB, satu sesi pada satu waktu, 08.00–21.00, kelipatan 15 menit, target DP 30%. Studio dapat memiliki `openingTime`, `closingTime`, dan `defaultDpPercent` melalui konfigurasi Admin; UI pengaturan menyusul Tahap 8.

## Alur yang sudah tersedia

1. Splash React tampil minimal 3 detik sambil memulihkan sesi Firebase; pemeriksaan sesi yang lebih lama tetap diselesaikan sebelum navigasi. Di Android/iOS, persistensi akun memakai Expo SecureStore, termasuk pemecahan record sesi besar; preview web memakai sessionStorage per tab.
2. Pengguna tanpa sesi diarahkan ke Login. Input email dan kata sandi divalidasi, kesalahan kredensial memakai pesan generik, dan submit ganda dicegah.
3. Setelah autentikasi, aplikasi meminta profil, membership aktif, dan studio dari server. Akun Auth tanpa membership tidak dapat masuk ke ruang kerja.
4. Halaman akun menampilkan nama pengguna, studio, dan peran nyata dari Firestore. Ini halaman konfirmasi akses, belum dashboard booking.
5. Perubahan membership dipantau saat aplikasi berjalan dan diperiksa lagi saat aplikasi kembali aktif. Membership nonaktif mengeluarkan pengguna. Sesi tidak dibuka dari cache saat startup offline.
6. Logout meminta konfirmasi lalu menghapus sesi lokal. Route `/home` dilindungi dan tidak dapat dibuka kembali tanpa sesi serta membership sah.
7. Lupa kata sandi mengirim permintaan melalui Firebase Auth dengan respons generik. Di emulator, tautan reset muncul pada terminal atau Emulator UI. Form kata sandi baru menggunakan action handler Firebase, belum halaman custom di aplikasi.

## Backend tahap pertama

```text
users/{uid}
  displayName, email, studioId, updatedAt

studios/{studioId}
  name, ownerUid, timezone, createdAt

studios/{studioId}/members/{uid}
  role: owner | staff
  status: active | inactive
  permissions: { booking, calendarCrm, payments, reports }
  updatedAt
```

Firestore Rules mengizinkan baca profil sendiri, membership sendiri, dan studio tempat membership aktif. Perubahan role, keanggotaan, serta studio tetap tertutup bagi client. Owner/CRM mengelola pelanggan; owner mengelola paket; staf booking membaca paket aktif. Kalender membaca projection `sessions` tanpa kontak, catatan, atau nominal. Detail booking lengkap memerlukan izin booking. Owner/pembayaran/laporan membaca ledger dan ringkasan kas; hanya owner/pembayaran mencatat penerimaan, hanya owner mencatat pengeluaran/refund. Staf pembayaran mendapat konteks booking minimum melalui callable tanpa izin mengubah jadwal. Seluruh client write langsung untuk booking, uang, slot, audit, receipt dan ringkasan tetap ditolak.

Login memakai Firebase Auth langsung. Booking dan keuangan memakai command server dengan pemeriksaan izin serta idempotensi. Pembayaran juga memeriksa versi booking, saldo dan jenis; refund memeriksa booking batal, pembayaran asal serta sisa refundable. Metode Transfer/QRIS merupakan pencatatan uang yang sudah diverifikasi, bukan transfer bank otomatis. DP harus lebih kecil dari sisa; Pelunasan sama dengan seluruh sisa. Jangan membuka semua write Rules untuk melanjutkan fitur berikutnya.

## Menghubungkan Firebase cloud

1. Buat project Firebase untuk development, aktifkan **Authentication → Email/Password**, dan buat Firestore. Pilih lokasi database sebelum memakai data nyata.
2. Daftarkan Firebase **Web App** untuk memperoleh konfigurasi Firebase JS SDK.
3. Isi field `EXPO_PUBLIC_FIREBASE_*` pada `.env` dan set `EXPO_PUBLIC_FIREBASE_USE_EMULATORS=false`.
4. Deploy Rules ke project yang Anda pilih secara eksplisit:

```powershell
npx firebase login
npx firebase deploy --only firestore --project PROJECT_ID_ANDA
```

5. Provision owner menggunakan kredensial server **Application Default Credentials** pada komputer tepercaya. Contohnya, atur `GOOGLE_APPLICATION_CREDENTIALS` ke lokasi berkas service account di luar repository, kemudian isi environment sesi terminal:

```powershell
$env:FIREBASE_PROJECT_ID = 'PROJECT_ID_ANDA'
$env:CONFIRM_FIREBASE_PROJECT = $env:FIREBASE_PROJECT_ID
$env:OWNER_EMAIL = 'owner@studio-anda.com'
$env:OWNER_NAME = 'Nama Owner'
$env:STUDIO_ID = 'studio-anda'
$env:STUDIO_NAME = 'Nama Studio Anda'
$ownerSecret = Read-Host 'Password awal owner minimal 12 karakter' -AsSecureString
$env:OWNER_INITIAL_PASSWORD = [System.Net.NetworkCredential]::new('', $ownerSecret).Password
try { npm run backend:owner }
finally { Remove-Item Env:\OWNER_INITIAL_PASSWORD -ErrorAction SilentlyContinue }
```

Public Firebase config bukan kredensial Admin. Service account, password owner, dan private key **tidak boleh** dimasukkan ke `EXPO_PUBLIC_*`, aplikasi mobile, atau Git. Tidak ada project cloud yang otomatis dibuat, diubah, atau dideploy oleh implementasi ini.

Booking/keuangan cloud memerlukan deploy keenam Functions dari project yang telah disiapkan: `npx firebase deploy --only functions --project PROJECT_ID_ANDA`. Region command adalah `asia-southeast2` dan harus sama dengan `EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION`. Deploy juga Rules dan seluruh indeks Firestore. Ini petunjuk deployment, bukan deployment yang sudah dilakukan. Lengkapi penyiapan layanan, kebijakan akses dan validasi perangkat sebelum memakai data produksi.

Pada produksi, tidak ada fallback otomatis ke emulator. Konfigurasi yang belum lengkap menampilkan state pengaturan/koneksi, bukan sukses login palsu. Aktifkan perlindungan enumerasi email dan kebijakan password pada Firebase Auth sebelum produksi. Batas reset khusus 30 menit dalam PRD belum diterapkan; tahap ini menggunakan masa berlaku action code yang dikelola Firebase. Alur reset custom, undangan staf, App Check, serta hardening rilis adalah tahap selanjutnya.

## Pemeriksaan

```powershell
npm run typecheck
npm run lint
npm test
npm run test:backend
npx expo-doctor
npx expo export --platform all
```

`test:backend` menyalakan emulator sementara. Hentikan emulator manual terlebih dahulu bila menggunakan port yang sama. Test menguji login nyata, password salah, akun tanpa membership, akun nonaktif, lintas studio, perubahan role ilegal, logout, revokasi akses, dan email reset. Semua test backend menolak berjalan tanpa variabel emulator.

## Struktur

```text
src/app/                    Route Expo Router
src/components/             Komponen antarmuka
src/features/auth/          Provider sesi dan Splash
src/features/master-data/   Pelanggan, paket, validasi, query dan transaksi Firestore
src/features/bookings/      Form booking, daftar/detail, kalender, repository SDK
src/features/finance/       Ledger, form uang, refund, ringkasan kas dan konteks booking
src/lib/auth/               Validasi, parsing sesi, adapter penyimpanan
src/lib/firebase/           Konfigurasi Firebase dan persistensi platform
src/theme/                  Token antarmuka sementara
backend/                    Firestore Rules, provisioning, test integrasi
backend/functions/          Callable commands, transaksi slot, picker minimum
tests/                      Pengujian logika aplikasi
docs/                       PRD dan catatan implementasi
```

## Status validasi dan batas rilis

Validasi Tahap 5: lint dan TypeScript lulus, 28 test aplikasi dan 52 test integrasi emulator lulus (80 total), termasuk repository SDK aplikasi. Uji mencakup regresi Booking/Kalender, pembayaran/refund bersamaan, replay, versi, izin, saldo, pagination dan rekonsiliasi setiap ledger terhadap booking/projection/counter refund/ringkasan bulan. Bundle Android/iOS/web berhasil diekspor. Alat kontrol browser masih gagal diinisialisasi: pengujian interaksi/screenshot Tahap 4–5 tetap terbuka dan tidak diklaim lulus. Tidak ada pemasangan build perangkat fisik atau deploy cloud. Detail di `design-qa.md`; QA Tahap 4 di `docs/qa/Tahap_4_QA.md`.

Audit npm saat setup masih melaporkan 36 temuan pada rantai dependensi setelah pembaruan kompatibel. Temuan ini belum merupakan hasil penilaian eksploitabilitas aplikasi. Review pembaruan upstream dan dampaknya sebelum produksi; jangan menjalankan `npm audit fix --force` tanpa review karena rekomendasinya mencakup perubahan besar ke versi framework yang berbeda. Aplikasi tahap ini disiapkan untuk pengembangan lokal, belum rilis produksi.

Detail visual belum dipastikan sama dengan Figma karena akses MCP desain sedang dibatasi. Antarmuka saat ini adalah implementasi awal berdasarkan brief; setelah akses tersedia, cocokkan token, logo, copy, dan geometri layar dengan frame desain.

Referensi: [Firebase pada Expo](https://docs.expo.dev/guides/using-firebase/), [Expo Router authentication](https://docs.expo.dev/router/advanced/authentication/), [SecureStore SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [Firebase Authentication Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth).
