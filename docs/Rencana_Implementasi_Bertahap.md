# Rencana Implementasi Bertahap LensFlow

Dokumen ini memetakan seluruh isi desain Figma (~50 layar & state) dan kebutuhan spesifikasi proyek (`LensFlow_Dokumen_Proyek.md`) ke dalam rencana kerja bertahap yang konsisten, aman, dan dapat diverifikasi secara visual maupun fungsional.

## Status implementasi — 25 Oktober 2026

- Tahap 1: autentikasi dan akses studio tetap dipakai.
- Tahap 2: token, skala tipografi, UI kit, format Rupiah/tanggal/waktu, serta lima tab sudah terpasang. Route `/home` kini unik di `(app)/(tabs)/home.tsx`; detail fitur berikutnya dapat diletakkan di Stack `(app)` di luar `(tabs)`.
- Beranda dan Booking menampilkan fixture lokal yang selalu diberi penanda **Pratinjau**. Pencarian, filter status, reset pencarian dan dialog informasi bisa diuji. Angka tersebut bukan data keuangan studio.
- Kalender dan Pelanggan masih kerangka UI. Menu fitur mendatang menampilkan informasi ketersediaan, tanpa submit atau sukses semu. Profil akun dan konfirmasi logout berfungsi. Tampilan staf mengikuti izin sesi.
- Tanggal/waktu memakai zona `Asia/Jakarta` secara default dan dapat menerima zona studio lain. Nomor internasional eksplisit tidak diubah menjadi nomor Indonesia.
- Tipe route dihasilkan oleh Expo CLI saat dev server berjalan; file `.expo/types/router.d.ts` tidak diedit manual dan tidak menggunakan cast `any` untuk navigasi.
- Emulator Firestore lokal memakai `8082` karena `8080` dipakai layanan lain; Auth tetap `9099`, Emulator UI `4000`.
- Tahap 3–9 belum dinyatakan selesai. Integrasi data booking/CRM, validasi bentrok, ledger, laporan dan pengaturan tetap mengikuti tahapan di bawah.

Referensi visual saat ini adalah gambar `Slice 1 (1).png` yang diberikan pengguna. Pemeriksaan berfokus pada shell Tahap 2; belum merupakan klaim implementasi 1:1 seluruh layar pada board Figma.

---

## 1. Analisis Desain & Arsitektur Antarmuka (Figma Board)

Berdasarkan analisis visual menyeluruh terhadap board Figma dan inventaris dokumen proyek:

### 1.1 Identitas Visual & Design System (Tokens & UI Kit)
- **Palet Warna Utama**:
  - `Primary Ink`: Hijau tua studio (`#203C35`, `#283A34`) – memberikan kesan premium, profesional, dan menenangkan.
  - `Accent / Brand`: Terakota hangat (`#AF4C2D`, pressed `#933D20`, light `#FCF0E9`) – aksen untuk CTA utama, status penting, dan highlight.
  - `Background & Surface`: Latar krem hangat (`#F8F7F4`), paper putih murni (`#FFFFFF`), border halus (`#E3E7E1`), green light tone (`#EAF0E8`).
  - `Status Colors`:
    - Dikonfirmasi / Selesai / Lunas: Soft Green (`#2E7D32` / `#E8F5E9`)
    - Menunggu DP / Jadwal Dekat: Soft Amber/Yellow (`#ED6C02` / `#FFF4E5`)
    - Batal / Overdue / Error: Muted Red (`#D32F2F` / `#FFEBEE`)
- **Tipografi**:
  - Font Sans-serif sistematis dengan hierarki tegas: Display Heading (34–40px), Section Title (20–24px), Subtitle/Card Title (16–18px), Body/Input (14–15px), Caption/Badge (10–12px uppercase tracking).
- **Komponen Reusable (UI Kit)**:
  - Input field dengan label atas, hint text, state focus & error, toggle mata untuk password, icon prefix/suffix.
  - Button system: Primary (Hijau tua), Secondary/Outline (Border krem/hijau), Destructive (Merah lembut), Ghost button.
  - Status Badges / Chips: Pill rounded, background pastel, text kontras jelas.
  - Cards: Sudut tumpul (*border-radius 16–22px*), border tipis 1px (`#E3E7E1`), spasi konsisten 16–20px.
  - Bottom Tab Navigation: 5 tab (Beranda, Booking, Kalender, Pelanggan, Lainnya) dengan ikon aktif bertinta gelap + dot aksen.

---

### 1.2 Pemetaan Layar & Alur Produk

```mermaid
graph TD
    A["Splash Screen (S01)"] --> B{"Pemeriksaan Sesi"}
    B -->|Belum Login| C["Login (S02) / Lupa Password (S14-S18)"]
    B -->|Sesi Aktif| D["Bottom Navigation Shell"]
    
    D --> TAB1["1. Beranda (S03)"]
    D --> TAB2["2. Booking (S04)"]
    D --> TAB3["3. Kalender (S07, S25, S26)"]
    D --> TAB4["4. Pelanggan CRM (S08)"]
    D --> TAB5["5. Lainnya (S12, S33-S40)"]
    
    TAB2 --> B_NEW["Form Booking Baru (S05, S45, S46)"]
    TAB2 --> B_DET["Detail Booking (S06)"]
    B_DET --> B_PAY["Terima Pembayaran DP/Lunas (S29)"]
    B_DET --> B_RESCHED["Ubah Jadwal (S30, S31)"]
    B_DET --> B_CANCEL["Batal Booking (S37) & Refund (S42)"]
    
    TAB4 --> C_DET["Detail Pelanggan (S21) + Riwayat"]
    TAB4 --> C_FORM["Form Pelanggan Baru/Edit (S20, S22)"]
    
    TAB5 --> P_PACK["Katalog Paket Foto (S09, S23, S24)"]
    TAB5 --> P_FIN["Keuangan & Laporan (S10, S11, S27, S28, S41)"]
    TAB5 --> P_STAFF["Kelola Staf & Izin (S39, S40)"]
    TAB5 --> P_SET["Pengaturan Studio (S34) & Profil (S12, S33)"]
```

---

## 2. Status Saat Ini vs Kebutuhan

| Area | Status Saat Ini (Tahap 1 Selesai) | Kebutuhan Target Desain Figma |
|---|---|---|
| **Autentikasi & Akun** | Login email/password, splash native+React, SecureStore, konfirmasi logout | Perlu integrasi forgot-password custom action, profil detail akun |
| **Navigasi Utama** | Hanya single stack route placeholder `(app)/home.tsx` | Perlu Expo Router Bottom Tabs: `Beranda`, `Booking`, `Kalender`, `Pelanggan`, `Lainnya` |
| **Design System** | `tokens.ts` dasar, `AuthField`, `Button`, `Brand` | Perlu komponen Badge, Card, TabBar, SearchBar, FilterChips, Modal Dialog, Stepper, Date/Time Picker |
| **CRM Pelanggan** | Belum ada | Listing, Search, Detail dengan riwayat sesi, Form tambah/edit, Deep-link WA/Call |
| **Katalog Paket** | Belum ada | Listing paket aktif/nonaktif, snapshot harga & durasi, Form tambah/edit paket |
| **Booking & Kalender** | Belum ada | Form booking 3 langkah (Pelanggan, Paket, Waktu), Deteksi bentrok, Kalender (Day/Week/Month), Detail booking |
| **Keuangan & Ledger** | Belum ada | Pencatatan DP, Pelunasan, Pengeluaran, Refund atomik, Laporan omset & grafik |
| **Pengaturan & Staf** | Provisioning admin script | UI kelola staf, toggle 4 hak akses, pengaturan jam studio & default DP |

---

## 3. Rencana Kerja Bertahap (Step-by-Step Roadmap)

Untuk menjaga kualitas kode, kepatuhan arsitektur Expo/React Native, kebersihan typecheck TypeScript, dan kemiripan piksel desain:

### Tahap 2: Pondasi Design System & Shell Navigasi Utama (Tab Bar)
> **Tujuan**: Menghadirkan kerangka navigasi bawah (5 tabs) yang identik dengan Figma, melengkapi token UI kit, dan membuat fondasi komponen umum yang dapat dipakai ulang di semua modul.

- **2.1 Token & Utilities**:
  - Ekspansi `src/theme/tokens.ts` (variasi warna status, border-radius, shadows/elevations, typography scales).
  - Format helper: Rupiah formatter (`Intl.NumberFormat`), format tanggal & jam Indonesia (WIB/studio time).
- **2.2 Komponen Dasar UI Kit**:
  - `Card`: Kontainer standar dengan header, body, footer.
  - `Badge` / `StatusPill`: Komponen status (Confirmed, Pending DP, Paid, Cancelled, Done).
  - `SearchInput` & `FilterChipGroup`: Input pencarian dengan tombol clear dan baris chip horizontal.
  - `HeaderBar`: Header halaman dengan avatar profil, sapaan/judul, dan action icon (notifikasi).
  - `ConfirmationModal`: Modal dialog dengan backdrop blur/gelap untuk konfirmasi aksi penting.
- **2.3 Expo Router Tab Shell**:
  - Stack berada di `src/app/(app)/_layout.tsx`, sedangkan `Tabs` berada di `src/app/(app)/(tabs)/_layout.tsx`.
  - Implementasi Custom Tab Bar sesuai desain (ikon Feather, badge dot, warna ink saat aktif).
  - Daftarkan 5 rute: `home` (Beranda), `bookings`, `calendar`, `clients`, `more`.
- **Hasil Uji**: Lint bersih, Typecheck lulus, tab dapat ditekan dengan transisi halus tanpa flicker.

---

### Tahap 3: Master Data — CRM Pelanggan & Katalog Paket Foto
> **Tujuan**: Membangun entitas fondasi (Pelanggan & Paket) yang menjadi prasyarat pembuatan booking, lengkap dengan validasi dan schema Firestore.

- **3.1 Backend & Firestore Rules**:
  - Collection `studios/{studioId}/clients` (nama, phone normalized, email, notes, totalBookings).
  - Collection `studios/{studioId}/packages` (name, price, durationMinutes, editedPhotosCount, isActive, defaultLocation).
  - Security rules Firestore untuk owner & staf dengan izin CRM/Master data.
- **3.2 Modul CRM Pelanggan (`src/features/clients/` & `src/app/(app)/clients/`)**:
  - `index.tsx`: Daftar pelanggan dengan baris avatar, nama, nomor telepon, dan badge booking count. Fitur search real-time.
  - `[id].tsx`: Detail pelanggan, tab riwayat booking, tombol aksi cepat Telepon & WhatsApp via deep linking (`Linking.openURL`).
  - `new.tsx` / `edit.tsx`: Form input dengan normalisasi nomor WhatsApp Indonesia (`08...` -> `+62...`) dan deteksi duplikat.
  - State kosong (*Empty state*) & error retry.
- **3.3 Modul Paket Foto (`src/features/packages/` & `src/app/(app)/packages/`)**:
  - Listing paket foto dengan kartu informasi (harga, durasi, jumlah foto editan, status aktif).
  - Form tambah/edit paket foto (hanya dapat diakses owner studio).
- **Hasil Uji**: CRUD pelanggan dan paket foto berjalan lancar, input divalidasi, layout konsisten dengan Figma.

---

### Tahap 4: Operasional Booking & Kalender (P0 Core)
> **Tujuan**: Menghadirkan alur utama bisnis studio: pembuatan booking baru, pencegahan bentrok jadwal (slot collision), tampilan kalender, dan manajemen status sesi.

- **4.1 Skema & Backend Booking**:
  - Collection `studios/{studioId}/bookings` dengan snapshot data pelanggan & paket (agar perubahan harga katalog di masa depan tidak mengubah histori).
  - Aturan Firestore & Firestore Transaction untuk validasi jadwal overlap secara atomik (mencegah *double booking*).
- **4.2 Form Booking Baru (`src/app/(app)/bookings/new.tsx`)**:
  - Stepper 3 tahap sesuai desain Figma:
    1. *Pilih Pelanggan*: Pilih pelanggan lama dengan pencarian atau shortcut tambah pelanggan baru tanpa keluar alur.
    2. *Pilih Paket Foto*: Pemilihan paket aktif otomatis mengisi estimasi durasi dan perhitungan target DP (30%).
    3. *Jadwal & Rincian*: Pemilih tanggal, jam mulai & jam selesai, lokasi sesi, catatan khusus, dan kalkulasi total biaya.
  - Validasi bentrok jadwal real-time dengan modal peringatan `S31`.
- **4.3 Daftar Booking (`src/app/(app)/bookings/index.tsx`)**:
  - Filter tab status: *Semua*, *Menunggu DP*, *DP Lunas*, *Lunas*, *Selesai*, *Batal*.
  - Kartu booking dengan tanggal, nama klien, paket, jam sesi, status badge, dan nominal saldo.
- **4.4 Detail Booking (`src/app/(app)/bookings/[id].tsx`)**:
  - Informasi lengkap: Banner status, kartu kontak klien, rincian paket, ringkasan pembayaran (total, terbayar, sisa).
  - Aksi operasional: *Ubah Jadwal (Reschedule)*, *Tandai Selesai*, *Batalkan Booking* (dengan modal konfirmasi).
- **4.5 Tampilan Kalender (`src/app/(app)/calendar/index.tsx`)**:
  - Toggle view: Tampilan Minggu (*Week*) dan Tampilan Hari (*Day* timeline).
  - Visualisasi slot waktu studio dan penanda sesi foto.
- **Hasil Uji**: Booking tersimpan dengan snapshot akurat, deteksi bentrok terverifikasi, kalender membaca data yang sama dengan list booking.

---

### Tahap 5: Modul Keuangan & Ledger Transaksi (DP, Pelunasan, Kas Masuk/Keluar)
> **Tujuan**: Memastikan pencatatan kas studio akurat, immutable (append-only ledger), dan mendukung alur pembayaran studio foto (DP -> Pelunasan -> Refund).

- **5.1 Arsitektur Finansial & Firestore Rules**:
  - Collection `studios/{studioId}/transactions` (type: `dp`, `full_payment`, `refund`, `expense`).
  - Aturan bisnis: Nilai tidak boleh negatif/melebihi sisa tagihan, transaksi uang bersifat *append-only*.
- **5.2 Penerimaan Pembayaran (`Terima Pembayaran`)**:
  - Bottom sheet / modal dari Detail Booking untuk mencatat DP atau Pelunasan.
  - Pilihan metode: *Transfer*, *Tunai*, *QRIS*.
  - Update otomatis sisa tagihan dan status badge booking (`pending_dp` -> `dp_paid` -> `paid`).
- **5.3 Catat Pengeluaran Studio**:
  - Form pencatatan pengeluaran operasional (sewa alat, cetak foto, utilitas, konsumsi).
- **5.4 Pembatalan & Refund**:
  - Alur refund terkontrol oleh owner yang merujuk pada transaksi penerimaan asal.
- **Hasil Uji**: Idempotensi transaksi, saldo booking terhitung tepat, tidak ada uang tercatat ganda.

---

### Tahap 6: Beranda Dinamis & Notifikasi Inbox
> **Tujuan**: Menghubungkan layar Beranda (*Dashboard*) dengan data aktual studio dan menyediakan pusat notifikasi pengingat operasional.

- **6.1 Beranda Terintegrasi (`src/app/(app)/home.tsx`)**:
  - Sapaan nama pengguna dan avatar header.
  - KPI Cards: *Sesi Hari Ini* (jumlah sesi aktif), *Kas Masuk Hari Ini* (Rp).
  - Section *Jadwal Terdekat*: Kartu booking terdekat hari ini dengan shortcut ke Detail Booking.
  - Quick Actions: Tombol cepat *+ Booking Baru*, *Tambah Pelanggan*.
- **6.2 Pusat Notifikasi (`src/app/(app)/notifications/index.tsx`)**:
  - Daftar notifikasi operasional: Pengingat pelunasan H-3/H-1, jadwal hari ini, konfirmasi pembayaran masuk.
- **Hasil Uji**: Beranda menampilkan ringkasan tepat sesuai izin pengguna (staf tanpa izin finansial tidak melihat nominal kas).

---

### Tahap 7: Laporan Keuangan, Grafik Omzet & Analisis Bisnis
> **Tujuan**: Menyediakan visualisasi kesehatan finansial studio foto untuk owner.

- **7.1 Halaman Laporan (`src/app/(app)/reports/index.tsx`)**:
  - Filter periode (Bulan ini, Bulan lalu, Tahun ini, Custom range).
  - Ringkasan Metrik: Total Pemasukan Bruto, Total Refund, Pemasukan Bersih, Pengeluaran, Kas Bersih Studio.
  - Grafik Batang/Tren visual pendapatan mingguan/bulanan berbasis SVG / React Native Canvas.
  - Rincian breakdown transaksi kas masuk & keluar.
- **Hasil Uji**: Rekonsiliasi kas Rp 0 selisih, grafik responsif di berbagai resolusi layar.

---

### Tahap 8: Pengaturan Studio, Kelola Staf & Hak Akses
> **Tujuan**: Melengkapi menu tab "Lainnya" untuk tata kelola studio dan akun.

- **8.1 Menu Tab "Lainnya" (`src/app/(app)/more/index.tsx`)**:
  - Menu list bersih dengan ikon Feather: Profil Saya, Paket Foto, Keuangan & Laporan, Kelola Staf, Pengaturan Studio, Bantuan & FAQ, Tentang LensFlow, Tombol Logout.
- **8.2 Kelola Staf & Otorisasi**:
  - Daftar staf studio dan status keanggotaan (Aktif/Nonaktif).
  - Form undang staf dengan 4 toggle hak akses:
    1. Operasional Booking
    2. Kalender & CRM
    3. Pembayaran & Kas Masuk
    4. Laporan & Keuangan
- **8.3 Pengaturan Studio**:
  - Informasi studio (Nama, Alamat, Nomor Kontak WhatsApp, Jam Operasional, Persentase Default DP).
- **8.4 Profil Pengguna & Edit Akun**:
  - Edit nama, nomor telepon pribadi, dan ganti kata sandi.
- **8.5 Bantuan, FAQ, & Tentang Aplikasi**.

---

### Tahap 9: Edge States, QA Visual & Polish Aksesibilitas
> **Tujuan**: Pemeriksaan visual komparatif menyeluruh terhadap desain Figma, pengujian ukuran layar ekstrim, dan penanganan kegagalan jaringan.

- Pemeriksaan 1:1 terhadap Figma (spasi, font-size, line-height, corner radius).
- Verifikasi state: Loading skeletons, Empty states (Booking kosong, Pelanggan kosong), Offline/Network failure retry.
- Uji kompatibilitas layar: Resolusi compact (320px) hingga layar lebar/tablet kecil.
- Eksekusi `npm run lint` dan `npm run typecheck` untuk jaminan zero-error.

---

## 4. Matriks Ringkasan Eksekusi

| Tahap | Modul Utama | Prioritas PRD | Estimasi Kompleksitas |
|---|---|---|---|
| **Tahap 2** | Design System Tokens & Bottom Tabs Shell | P0 | Menengah |
| **Tahap 3** | CRM Pelanggan & Paket Foto | P0 | Menengah |
| **Tahap 4** | Form Booking Stepper, Deteksi Bentrok, & Kalender | P0 | Tinggi |
| **Tahap 5** | Finansial, DP, Pelunasan, & Ledger Kas | P0 | Tinggi |
| **Tahap 6** | Beranda Dinamis & Inbox Notifikasi | P1 | Menengah |
| **Tahap 7** | Laporan Keuangan & Grafik Omzet | P1 | Menengah |
| **Tahap 8** | Tab Lainnya, Kelola Staf (4 Izin), Pengaturan Studio | P1 | Menengah |
| **Tahap 9** | Polish Visual 1:1 Figma & Edge States QA | P0/P1 | Menengah |
