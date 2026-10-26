import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { FeatureNotice, type FeatureMessage } from '@/components/FeatureNotice';
import { PreviewNotice } from '@/components/PreviewNotice';
import { useAuth } from '@/features/auth/AuthProvider';
import { previewBookings } from '@/features/preview/bookings';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { colors, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { state } = useAuth();
  const [feature, setFeature] = useState<FeatureMessage | null>(null);
  if (state.status !== 'authenticated') return null;
  const { session } = state;
  const canBook = session.role === 'owner' || session.permissions.booking;
  const canSeeMoney = session.role === 'owner' || session.permissions.payments;
  const canSeeCalendar = session.role === 'owner' || session.permissions.calendarCrm;

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <View style={styles.heroRow}>
            <Text style={styles.greeting} numberOfLines={1}>Halo, {session.displayName.trim().split(/\s+/)[0]}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Notifikasi" style={styles.bell}
              onPress={() => setFeature({ title: 'Notifikasi', message: 'Pusat notifikasi studio segera tersedia.' })}>
              <Feather name="bell" size={23} color={colors.paper} />
            </Pressable>
          </View>
          <Text style={styles.encouragement}>Semangat hari ini!</Text>
          <Text style={styles.date}>{formatDate(new Date(), { showDayName: true, monthStyle: 'long' })}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <PreviewNotice />
        <View style={styles.kpis}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Booking Hari Ini</Text>
            <View style={styles.valueRow}><Text style={styles.value}>{canSeeCalendar ? previewBookings.length : '—'}</Text><Feather name="calendar" size={19} color={colors.ink} /></View>
            <Text style={styles.kpiHint}>{canSeeCalendar ? '3 sesi terjadwal' : 'Akses kalender terbatas'}</Text>
          </View>
          {canSeeMoney && <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Pendapatan Hari Ini</Text>
            <View style={styles.valueRow}><Text style={styles.money}>{formatCurrency(750000)}</Text><Feather name="credit-card" size={17} color={colors.warning} /></View>
            <Text style={styles.kpiHint}>Penerimaan hari ini</Text>
          </View>}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Booking Mendatang</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Lihat semua booking" style={styles.textButton} onPress={() => router.navigate('/bookings')}>
              <Text style={styles.seeAll}>Lihat Semua</Text>
            </Pressable>
          </View>
          {canSeeCalendar ? previewBookings.map((booking) => <Pressable key={booking.id}
            accessibilityRole="button" accessibilityLabel={`Lihat booking ${booking.clientName}`} onPress={() => router.navigate('/bookings')}
            style={({ pressed }) => [styles.booking, pressed && { opacity: 0.75 }]}>
            <Text style={styles.time}>{booking.time}</Text>
            <View style={styles.bookingInfo}>
              <Text style={styles.bookingTitle}>{booking.sessionName} ({booking.packageName})</Text>
              <Text style={styles.client}>{booking.clientName}</Text>
            </View>
            <Badge label={booking.status === 'confirmed' ? 'Dikonfirmasi' : 'Menunggu'} variant={booking.status === 'confirmed' ? 'success' : 'warning'} withDot={false} />
          </Pressable>) : <View style={styles.restricted}><Text style={styles.client}>Anda belum memiliki izin untuk melihat jadwal studio.</Text></View>}
        </View>

        {canBook && <Button label="+ Booking Baru" tone="brand" onPress={() => router.navigate('/bookings')} />}
        <Pressable accessibilityRole="button" accessibilityLabel="Lihat akun studio" style={styles.account} onPress={() => router.navigate('/more')}>
          <Text style={styles.accountText}>{session.studioName}</Text><Feather name="chevron-right" size={16} color={colors.muted} />
        </Pressable>
      </View>
    </ScrollView>
    <FeatureNotice feature={feature} onClose={() => setFeature(null)} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  scroll: { flex: 1, backgroundColor: colors.background }, scrollContent: { flexGrow: 1 },
  hero: { backgroundColor: colors.ink, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 25 },
  heroContent: { width: '100%', maxWidth: 464, alignSelf: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  greeting: { flex: 1, fontSize: 25, lineHeight: 32, color: colors.paper, fontWeight: '600' },
  bell: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  encouragement: { color: colors.paper, fontSize: 16, lineHeight: 23, marginTop: 2 },
  date: { color: '#DCE7E1', fontSize: 13, lineHeight: 20, marginTop: 3 },
  body: { width: '100%', maxWidth: 500, alignSelf: 'center', padding: 18, gap: 18 },
  kpis: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  kpi: { flex: 1, minWidth: 0, backgroundColor: colors.paper, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 10 },
  kpiLabel: { fontSize: 12, lineHeight: 17, color: colors.muted },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' },
  value: { fontSize: 27, lineHeight: 34, fontWeight: '600', color: colors.ink },
  money: { fontSize: 17, lineHeight: 28, fontWeight: '700', color: colors.ink },
  kpiHint: { fontSize: 10, lineHeight: 15, color: colors.success },
  section: { gap: 6, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text, flexShrink: 1 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingLeft: 8 },
  seeAll: { fontSize: 12, color: colors.success },
  booking: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, minHeight: 76, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  time: { color: colors.text, fontSize: 13, fontWeight: '600' },
  bookingInfo: { flex: 1, minWidth: 0, gap: 6 },
  bookingTitle: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.text },
  client: { fontSize: 12, lineHeight: 18, color: colors.muted },
  restricted: { padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.paper },
  account: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  accountText: { fontSize: 12, lineHeight: 18, color: colors.muted },
});
