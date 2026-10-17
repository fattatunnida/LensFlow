import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '@/components/Brand';
import { Button } from '@/components/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme/tokens';

export default function HomeScreen() {
  const { state, logout } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (state.status !== 'authenticated') return null;
  const { session } = state;
  async function exit() {
    setBusy(true); setError('');
    try { await logout(); }
    catch { setError('Belum berhasil keluar. Coba kembali.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><Brand /><View style={styles.avatar}><Text style={styles.initial}>{session.displayName.charAt(0).toUpperCase()}</Text></View></View>
    <View style={styles.intro}><Text style={styles.eyebrow}>SELAMAT DATANG DI LENSFLOW</Text>
      <Text style={styles.heading}>Halo, {session.displayName.split(' ')[0]}.</Text>
      <Text style={styles.description}>Ruang kerja studio Anda sudah siap.</Text>
    </View>
    <View style={styles.studio}><View style={styles.studioIcon}><Feather name="home" size={28} color={colors.ink} /></View>
      <Text style={styles.studioName}>{session.studioName}</Text>
      <Text style={styles.role}>{session.role === 'owner' ? 'Pemilik studio' : 'Staf studio'}</Text>
      <View style={styles.active}><View style={styles.activeDot} /><Text style={styles.activeText}>Akses studio aktif</Text></View>
    </View>
    <View style={styles.details}><Text style={styles.detailsLabel}>AKUN TERHUBUNG</Text><Text style={styles.email}>{session.email}</Text></View>
    <View style={styles.next}><Feather name="layers" size={19} color={colors.muted} /><Text style={styles.nextText}>Booking, kalender, dan pelanggan akan tersedia pada tahap pengembangan berikutnya.</Text></View>
    <Button label="Keluar dari akun" secondary onPress={() => setConfirm(true)} />
    <Text style={styles.footer}>LensFlow · Studio tertata, momen terjaga.</Text>
    <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirm(false); }}>
      <View style={styles.overlay}><View style={styles.dialog} accessibilityViewIsModal>
        <Text style={styles.dialogTitle}>Keluar dari LensFlow?</Text>
        <Text style={styles.description}>Data studio tetap tersimpan. Anda dapat masuk kembali kapan saja.</Text>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Button label="Ya, keluar" loading={busy} onPress={() => { void exit(); }} />
        <Button label="Tetap di sini" secondary disabled={busy} onPress={() => setConfirm(false)} />
      </View></View>
    </Modal>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, page: { flexGrow: 1, gap: 28, padding: 26, width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 22 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 16, fontWeight: '600', color: colors.ink }, intro: { gap: 13 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.7, color: colors.accent },
  heading: { fontSize: 34, fontWeight: '700', color: colors.ink, letterSpacing: -1 },
  description: { fontSize: 15, color: colors.muted, lineHeight: 24 },
  studio: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 28, alignItems: 'center', gap: 10 },
  studioIcon: { width: 64, height: 64, borderRadius: 21, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  studioName: { fontSize: 23, fontWeight: '700', color: colors.ink }, role: { fontSize: 14, color: colors.muted },
  active: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.greenLight },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink }, activeText: { fontSize: 12, color: colors.ink },
  details: { gap: 9 }, detailsLabel: { fontSize: 10, letterSpacing: 1.5, color: colors.muted, fontWeight: '600' }, email: { color: colors.text, fontSize: 15 },
  next: { flexDirection: 'row', gap: 10 }, nextText: { flex: 1, fontSize: 13, lineHeight: 21, color: colors.muted },
  footer: { textAlign: 'center', fontSize: 11, lineHeight: 18, color: colors.muted, marginTop: 'auto', paddingVertical: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(20,36,30,0.35)', justifyContent: 'center', alignItems: 'center', padding: 26 },
  dialog: { backgroundColor: colors.paper, borderRadius: 24, padding: 26, gap: 20, width: '100%', maxWidth: 400 },
  dialogTitle: { fontSize: 23, fontWeight: '700', color: colors.ink }, error: { color: colors.error, fontSize: 13 },
});
