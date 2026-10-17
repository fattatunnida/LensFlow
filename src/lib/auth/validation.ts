export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateLogin(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))) {
    errors.email = 'Masukkan alamat email yang valid.';
  }
  if (!password) errors.password = 'Masukkan kata sandi Anda.';
  return errors;
}

export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Email atau kata sandi tidak sesuai. Silakan coba lagi.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Koneksi terputus. Periksa internet Anda lalu coba lagi.';
    case 'auth/user-disabled':
      return 'Akun ini tidak dapat digunakan. Hubungi pemilik studio.';
    case 'auth/operation-not-allowed':
      return 'Layanan masuk belum tersedia. Hubungi admin studio.';
    default:
      return 'Belum berhasil masuk. Silakan coba lagi atau hubungi admin studio.';
  }
}
