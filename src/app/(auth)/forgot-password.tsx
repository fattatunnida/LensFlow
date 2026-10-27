import Feather from '@expo/vector-icons/Feather';
import { Link } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthShell } from '@/components/AuthShell';
import { AuthField } from '@/components/AuthField';
import { Button } from '@/components/Button';
import { getFirebaseClient } from '@/lib/firebase/client';
import { authErrorMessage, normalizeEmail, validateLogin } from '@/lib/auth/validation';
import { colors } from '@/theme/tokens';
import { feedback } from '@/lib/feedback/store';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const submitting = useRef(false);
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit() {
    if (submitting.current || cooldown) return;
    const validation = validateLogin(email, 'unused');
    if (validation.email) { setError(validation.email); return; }
    submitting.current = true; setBusy(true); setError('');
    const announce = feedback.capture();
    const completed = () => {
      if (!alive.current) return;
      setSent(true); setCooldown(60);
      announce({ title: 'Permintaan reset diterima', message: 'Jika email terdaftar, instruksi penggantian kata sandi akan dikirim.' });
    };
    try {
      await sendPasswordResetEmail(getFirebaseClient().auth, normalizeEmail(email));
      completed();
    } catch (cause) {
      if (typeof cause === 'object' && cause && 'code' in cause && cause.code === 'auth/user-not-found') {
        completed();
      } else if (alive.current) setError(authErrorMessage(cause));
    } finally { submitting.current = false; if (alive.current) setBusy(false); }
  }
  return <AuthShell><View style={styles.content}>
    <View style={styles.icon}><Feather name={sent ? 'check' : 'key'} color={colors.ink} size={28} /></View>
    <Text style={styles.heading}>{sent ? 'Periksa email Anda' : 'Lupa kata sandi?'}</Text>
    <Text style={styles.description}>{sent ? 'Jika email terdaftar sebagai akun studio, instruksi untuk mengganti kata sandi akan dikirim ke alamat tersebut.' : 'Masukkan email akun studio Anda. Kami akan mengirimkan instruksi untuk mengganti kata sandi.'}</Text>
    <AuthField label="Email" placeholder="nama@studio.com" value={email} keyboardType="email-address" autoComplete="email"
      editable={!busy && !cooldown} onChangeText={(value) => { setEmail(value); setError(''); }} error={error} />
    <Button label={cooldown ? `Kirim ulang dalam ${cooldown} detik` : sent ? 'Kirim ulang email' : 'Kirim instruksi'} loading={busy} disabled={cooldown > 0} onPress={() => { void submit(); }} />
    <Link href="/login" replace style={styles.back}>Kembali ke masuk</Link>
  </View></AuthShell>;
}
const styles = StyleSheet.create({
  content: { gap: 24 }, icon: { width: 62, height: 62, borderRadius: 20, backgroundColor: colors.greenLight, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 30, lineHeight: 38, letterSpacing: -0.9, color: colors.ink, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 25, color: colors.muted },
  back: { textAlign: 'center', paddingVertical: 14, minHeight: 48, fontWeight: '600', fontSize: 14, color: colors.ink },
});
