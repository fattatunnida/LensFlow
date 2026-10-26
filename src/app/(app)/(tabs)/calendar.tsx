import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { FilterChips } from '@/components/FilterChips';
import { TabScreen } from '@/components/TabScreen';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDate } from '@/lib/formatters';
import { colors } from '@/theme/tokens';

type CalendarView = 'day' | 'week';
export default function CalendarScreen() {
  const { state } = useAuth();
  const [view, setView] = useState<CalendarView>('day');
  if (state.status !== 'authenticated') return null;
  const allowed = state.session.role === 'owner' || state.session.permissions.calendarCrm;
  return <TabScreen title="Kalender" subtitle="Jadwal pemotretan studio">
    {allowed ? <>
      <FilterChips<CalendarView> options={[{ key: 'day', label: 'Hari' }, { key: 'week', label: 'Minggu' }]} selectedKey={view} onSelect={setView} />
      <View style={styles.date}><Text style={styles.dateText}>{formatDate(new Date(), { monthStyle: 'long' })}</Text></View>
      <EmptyState icon="calendar" title={view === 'day' ? 'Jadwal harian studio' : 'Jadwal mingguan studio'}
        description="Jadwal pemotretan dan ketersediaan waktu studio segera tersedia di sini." />
    </> : <EmptyState icon="lock" title="Akses kalender terbatas" description="Hubungi pemilik studio untuk mendapatkan izin kalender dan CRM." />}
  </TabScreen>;
}
const styles = StyleSheet.create({
  date: { paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.border },
  dateText: { color: colors.ink, fontSize: 16, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
});
