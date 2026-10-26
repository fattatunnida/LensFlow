import { type PropsWithChildren } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { HeaderBar } from '../../components/HeaderBar';
import { colors, typography } from '../../theme/tokens';

export const masterStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  page: { width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 24, gap: 18 },
  footer: { width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  title: { ...typography.section, color: colors.ink },
  text: { ...typography.body, color: colors.text },
  muted: { ...typography.caption, color: colors.muted },
  error: { ...typography.body, color: colors.error },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 12 },
});

export function goBack(fallback: '/clients' | '/packages' | '/more' | '/bookings' | '/calendar' | '/finance') {
  if (router.canDismiss()) router.dismiss(); else router.replace(fallback);
}

export function MasterScreen({ title, children, fallback = '/clients', busy = false }: PropsWithChildren<{ title: string; fallback?: '/clients' | '/packages' | '/more' | '/bookings' | '/calendar' | '/finance'; busy?: boolean }>) {
  return <SafeAreaView style={masterStyles.safe}>
    <KeyboardAvoidingView style={masterStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={masterStyles.page}>
        <HeaderBar title={title} onBack={() => { if (!busy) goBack(fallback); }} />
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function FormField({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.muted}
      style={[styles.input, props.multiline && styles.multiline, !!error && styles.invalid, props.style]} />
    {!!hint && <Text style={masterStyles.muted}>{hint}</Text>}
    {!!error && <Text accessibilityRole="alert" style={masterStyles.error}>{error}</Text>}
  </View>;
}

export function LoadingData() {
  return <View style={styles.status}><ActivityIndicator color={colors.ink} accessibilityLabel="Memuat data studio" /><Text style={masterStyles.muted}>Memuat data…</Text></View>;
}
export function DataError({ message, retry }: { message: string; retry(): void }) {
  return <View style={styles.status}><Text accessibilityRole="alert" style={[masterStyles.error, styles.center]}>{message}</Text><Button label="Coba lagi" secondary onPress={retry} /></View>;
}

const styles = StyleSheet.create({
  field: { gap: 8 }, label: { ...typography.body, color: colors.text, fontWeight: '600' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.paper, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, outlineWidth: 0 },
  multiline: { minHeight: 100, textAlignVertical: 'top' }, invalid: { borderColor: colors.error },
  status: { alignItems: 'center', gap: 16, paddingVertical: 32, paddingHorizontal: 12 }, center: { textAlign: 'center' },
});
