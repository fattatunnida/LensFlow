import Feather from '@expo/vector-icons/Feather';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApertureMark } from '@/components/ApertureMark';
import { AuthField } from '@/components/AuthField';

import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorMessage, validateLogin } from '@/lib/auth/validation';
import { colors } from '@/theme/tokens';
import { readRememberedEmail, saveRememberedEmail } from '@/features/auth/remembered-email';

export default function LoginScreen() {
  const { login, state } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(false);
  const insets = useSafeAreaInsets();
  const editedEmail = useRef(false);
  const submitting = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    let active = true;
    void readRememberedEmail().then((saved) => {
      if (active && saved && !editedEmail.current) { setEmail(saved); setRemember(true); }
    });
    return () => { active = false; alive.current = false; };
  }, []);
  const message = error || (state.status === 'signedOut' ? state.message : undefined);
  async function submit() {
    if (submitting.current) return;
    const validation = validateLogin(email, password);
    setErrors(validation); setError('');
    if (Object.keys(validation).length) return;
    submitting.current = true; setBusy(true);
    try {
      await login(email, password);
      // Remember only the email. Existing Firebase session persistence is unchanged.
      void saveRememberedEmail(remember ? email.trim().toLowerCase() : null).catch(() => {});
    }
    catch (cause) { if (alive.current) setError(authErrorMessage(cause)); }
    finally { submitting.current = false; if (alive.current) setBusy(false); }
  }
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(36, 118 - insets.top) }]}>
        <View style={styles.container}>
          <View style={styles.intro}>
            <ApertureMark />
            <Text style={styles.heading}>LensFlow</Text>
            <Text style={styles.description}>Masuk ke akun Anda</Text>
          </View>
          <View style={styles.form}>
      {!!message && <View style={styles.error}><Feather name="alert-circle" size={18} color={colors.error} /><Text accessibilityRole="alert" style={styles.errorText}>{message}</Text></View>}
      <AuthField appearance="login" label="Email" placeholder="admin@studio.com" keyboardType="email-address" autoComplete="email" textContentType="username"
        value={email} onChangeText={(value) => { editedEmail.current = true; setEmail(value); setErrors((old) => ({ ...old, email: undefined })); setError(''); }} error={errors.email} editable={!busy} />
      <View style={styles.passwordField}><AuthField appearance="login" label="Kata sandi" placeholder="Masukkan kata sandi" password autoComplete="current-password" textContentType="password"
        value={password} onChangeText={(value) => { setPassword(value); setErrors((old) => ({ ...old, password: undefined })); setError(''); }}
        error={errors.password} editable={!busy} returnKeyType="go" onSubmitEditing={() => { void submit(); }} /></View>
      <View style={styles.options}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel="Ingat saya" accessibilityHint="Mengingat email di perangkat ini"
          accessibilityState={{ checked: remember, disabled: busy }} disabled={busy}
          onPress={() => { setRemember((value) => !value); }} style={styles.remember}>
          <View style={[styles.checkbox, remember && styles.checked]}>
            {remember && <Feather name="check" size={12} color="#FFFFFF" />}
          </View>
          <Text style={styles.rememberText}>Ingat saya</Text>
        </Pressable>
        <Link href="/forgot-password" style={styles.forgot} accessibilityRole="link">Lupa kata sandi?</Link>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Masuk" accessibilityState={{ disabled: busy, busy }}
        disabled={busy} onPress={() => { void submit(); }}
        style={({ pressed }) => [styles.submit, (pressed || busy) && { opacity: 0.75 }]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Masuk</Text>}
      </Pressable>
          </View>
          <Text style={styles.note}>Belum punya akun? Hubungi admin</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8F7F4' }, flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 26, paddingBottom: 40 },
  container: { width: '100%', maxWidth: 338, alignSelf: 'center' },
  intro: { alignItems: 'center' },
  heading: { marginTop: 16, fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'Arial', fontSize: 40, lineHeight: 48, fontWeight: '700', color: '#1D3035' },
  description: { marginTop: 14, fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'Arial', fontSize: 20, lineHeight: 26, color: '#1D3035', textAlign: 'center' },
  form: { marginTop: 38 }, passwordField: { marginTop: 30 },
  options: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  remember: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 14, height: 14, borderWidth: 1, borderColor: '#7A8C98', alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: '#193D32', borderColor: '#193D32' },
  rememberText: { fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'Arial', fontSize: 14, color: '#1D3035' },
  forgot: { minHeight: 44, paddingVertical: 14, fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'Arial', fontSize: 14, lineHeight: 16, color: '#193D32', fontWeight: '600', flexShrink: 1 },
  submit: { marginTop: 40, minHeight: 50, borderRadius: 12, backgroundColor: '#193D32', alignItems: 'center', justifyContent: 'center', padding: 14 },
  submitText: { color: '#FFFFFF', fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'Arial', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  error: { flexDirection: 'row', padding: 14, gap: 10, backgroundColor: colors.errorLight, borderRadius: 12, alignItems: 'flex-start' },
  errorText: { color: colors.error, flex: 1, fontSize: 13, lineHeight: 20 },
  note: { marginTop: 40, fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'Arial', fontSize: 14, lineHeight: 20, color: '#7A8C98', textAlign: 'center' },
});
