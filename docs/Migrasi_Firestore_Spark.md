# Migrasi LensFlow ke Firestore langsung (Spark)

Permintaan pengguna: tetap paket gratis, memakai Firestore langsung, tanpa Cloud Functions dan tanpa cloudflared. Migrasi aplikasi ke Firestore langsung telah diterapkan. Hasil pengujian dan status deployment tersedia pada [QA Firestore Spark](qa/Firestore_Spark_QA.md).

## Status cloud yang sudah diverifikasi

- Project lensflow-110d3, billing tidak aktif (Spark).
- Firestore (default), FIRESTORE_NATIVE, asia-southeast2.
- Email/Password aktif. Firebase CLI sudah login sebagai fattatunnidaamalia@gmail.com dan dapat mengakses project.
- `.env` menunjuk Firebase cloud ini; `.firebaserc` target default sama.
- Owner Auth sudah dibuat: QNiA1DJYN1bISSVOr1deBBVbd6T2, email fattatunnidaamalia@gmail.com.
- Profil dan membership owner aktif ada di studio-lensflow; nama awal Owner LensFlow, studio LensFlow, empat izin aktif. Password belum diset oleh pengguna. Tautan pembuatan password ada di file ignored test-results/cloud-owner-password-link.txt; jangan masukkan ke Git/backup atau log publik.
- Rules dan 24 indeks Spark sudah dideploy. Isi Rules cloud cocok dengan lokal; status indeks akhir di test-results/spark-cloud-verify.log. Tidak ada deployment Functions dan billing tetap nonaktif.
- Helper cloud pribadi berada di test-results/cloud-preflight.cjs dan cloud-owner-setup.cjs. Mereka memakai OAuth Firebase CLI di memori, tidak membutuhkan service-account key. Jangan mencetak token CLI.

## Implementasi dan invariannya

1. Tambah `src/lib/firestore-api.ts` + fitur `src/features/spark/` sebagai pengganti semua pemanggilan httpsCallable di aplikasi. DTO UI lama sebisa mungkin dipertahankan. Error domain tetap memiliki details.reason untuk konflik/draft.
2. Booking, session projection, financial context dan mutation receipt ditulis atomik. Rules memvalidasi harga snapshot terhadap package aktif, clientChoices, versi, metadata request.time, peran dan studio. Counter nomor booking atomik, kode BK dengan padding.
3. Jadwal menggunakan koleksi baru scheduleLocks/{date}: entries map bookingId->{startMs,endMs}, order list terurut, index posisi perubahan, changedBooking, lastMutation, revision, updatedAt/By. Rules hanya mengizinkan perubahan satu entry, memastikan order.removeAll([bookingId]) sama dengan order sebelumnya.removeAll([bookingId]), entries.diff hanya booking tersebut, dan interval berada di antara predecessor/successor. Induksi ini menjaga nonoverlap tanpa memeriksa puluhan slot dalam Rules. Reschedule lintas hari mengubah kedua lock secara atomik; pembatalan melepas entry. Binding ke getAfter booking + receipt mencegah penulisan lock palsu.
4. Canonical booking tetap menyimpan nilai/snapshot. Audit booking berasal dari bookingMutations; audit uang dari immutable ledger yang menyimpan snapshot jadwal/status/expectedVersion. Tidak ada duplikat write events projection agar transaksi tetap dalam batas evaluasi Rules. Koleksi financeContexts/{bookingId} memberi projection minimum pembayaran tanpa membuka alamat/catatan pelanggan. Finance-only client membaca context lalu blind tx.update field finansial booking/session (tidak perlu get private booking); Rules mengikat semua field ke ledger dan projection setelah transaksi.
5. Ledger immutable `transactions`, receipt `financeMutations`, refundBalances per source, financeCounters/main (sequence/head count authoritative). Rules memvalidasi positive integer amount, DP < remaining, settlement == remaining, refund owner/cancelled/source cap, expense owner, metode, tanggal WIB dan batas backdate, hanya satu increment versi/sequence. Semua pasangan dokumen harus ada sesudah write; tidak cukup validasi UI.
6. Report/summary/dash membaca ledger berurutan dengan batas sequence <= head.count yang dibaca dari server agar pagination mendapat immutable prefix konsisten. Maksimal 5.000 transaksi dengan error eksplisit. Bruto, refund, expense dipisah; pending booking bukan kas. Tambahkan indeks yang diperlukan.
7. Client CRUD tetap membatasi CRM. `clientChoices/{id}` projection minimum harus ditulis bersama clients oleh saveMaster dan divalidasi getAfter; booking-only dapat membaca projection, tidak notes/address asli. Packages tetap sesuai role/aktif.
8. Profil dan pengaturan studio menjadi transaction + version dengan Rules, ownerUid/timezone/role/studioId immutable. Profile name update menyinkronkan displayName pada own member supaya owner list tidak perlu membaca users milik orang lain.
9. Undangan Spark baru: invitations/{emailLower} (email sederhana tanpa slash), owner mencatat nama/empat izin/status pending/cancelled/accepted, version, expiresAt <= request.time+7d. Daftar staf mem-paginate members dahulu lalu pending/cancelled invitations; pending DTO memakai UID sintetis invite:email. Tidak membuat Auth user atas nama staf di client.
10. Route publik accept-invite: secondary Firebase Auth (in-memory) untuk daftar/masuk staf, kirim verifikasi email atas aksi pengguna, reload + token refresh sesudah verifikasi, lalu transaksi claim membuat own users + member(role staff, izin persis invitation) dan consumes invitation. Rules mensyaratkan token.email_verified, email sesuai, belum ada profil di studio lain, invitation belum dipakai/kedaluwarsa. Main Auth baru login sesudah claim. Owner terkunci. Invite dapat dibatalkan/diterbitkan ulang; active user bukan pending.
11. Inbox dihitung ketika membuka aplikasi dari sumber session/booking/ledger, read receipts dan preferensi per UID. Pengingat H-1/H-3 diperiksa ulang; tidak ada jadwal/push background otomatis dalam mode ini.
12. `studios.clientBackendVersion=1` gate semua write domain baru. Cloud studio telah ditandai setelah memastikan koleksi bisnis/lock lama kosong. Jangan mencampur scheduleDays v1 dan scheduleLocks baru tanpa migrasi. Studio tidak boleh mengubah version gate lewat client.
13. Default firebase.json/backend:start hanya Auth+Firestore emulator dan deploy Rules/index. Backend Functions lama boleh dipertahankan sebagai historis, tidak dipakai aplikasi/default commands. Semua import/call httpsCallable di src harus hilang. Perbarui panduan agar tidak lagi menyuruh Blaze.

## Verifikasi wajib sebelum deploy Rules baru

Lint/typecheck, unit domain, pengujian Rules adversarial + transaksi SDK pada emulator, raw forged booking/ledger/slot/context/counter/role ditolak. Uji concurrent booking/reschedule/payment/refund, retry idempotent, role withdrawal, studio isolation, immutable ledger, current package snapshot, invite verification/claim/expiry/replay, report prefix reconciliation. Uji E2E mobile web untuk semua alur yang diubah. Baru deploy Rules/index ke lensflow-110d3 (bukan Functions), lakukan verifikasi cloud tanpa transaksi bisnis palsu, dan buat backup source di luar workspace tanpa kredensial/database.

Referensi resmi: https://firebase.google.com/docs/firestore/security/rules-conditions dan https://firebase.google.com/docs/firestore/manage-data/transactions. Expo SDK 58; AGENTS.md mewajibkan versi docs, lint dan typecheck, routes di src/app, tidak menyunting native generated folders. Jangan memakai subagent (belum diminta pengguna).
