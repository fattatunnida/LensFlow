# Logo LensFlow

`aperture-source.png` adalah master asli 512×512 dari berkas **Lens aperture (2).png** yang dipilih pengguna. Bentuk enam bilah, celah dan lubang transparan dipertahankan sesuai file. Warna hijau asli `#193B32` digunakan bersama oleh aplikasi. Nama LensFlow pada komponen Brand tetap dirender sebagai teks native.

`scripts/create-brand-assets.cjs` membuat ukuran dan padding sesuai platform dari PNG asli menggunakan Sharp. Versi emas dan putih hanya mengganti warna dengan tetap mempertahankan alpha/celah gambar. `mark.svg` adalah pembungkus PNG asli untuk kompatibilitas tautan lama, bukan hasil gambar ulang vektor. Generator memakai instalasi Sharp lokal atau path `LENSFLOW_SHARP_PATH` pada komputer pengembangan. PNG hasil render disertakan dalam source sehingga build aplikasi tidak memerlukan Sharp.

| Aset | Ukuran | Pemakaian |
| --- | --- | --- |
| icon.png | 1024×1024 | Ikon aplikasi, latar penuh tanpa sudut buatan |
| adaptive-icon.png | 1024×1024 | Foreground Android; simbol 600px di area tengah |
| monochrome-icon.png | 1024×1024 | Themed icon Android |
| notification-icon.png | 96×96 | Simbol putih, latar dan lubang transparan |
| notification-large-icon.png | 256×256 | Logo besar pada notifikasi Android |
| favicon.png | 64×64 | Tab browser |
| aperture.png | 512×512 | Simbol hijau; versi auth juga dipakai login/Brand |
| ../auth/aperture-gold.png | 512×512 | Splash native; versi React memakai tint emas |

Plugin expo-notifications dikonfigurasi untuk ikon kecil/besar Android. Pemberitahuan lokal login/logout dan perubahan password tersedia setelah diaktifkan melalui Pengaturan notifikasi dan memperoleh izin perangkat. Pengiriman push jarak jauh, token push dan penjadwalan latar belakang belum diimplementasikan; inbox Firestore tetap berjalan seperti sebelumnya. Remote notification entitlement iOS belum diaktifkan karena pemberitahuan akun ini bersifat lokal. Ikon native yang baru memerlukan build ulang dan pemeriksaan di perangkat, bukan sekadar reload Expo Go.

Referensi: [Expo SDK 58 notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/), [Expo app icons](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).
