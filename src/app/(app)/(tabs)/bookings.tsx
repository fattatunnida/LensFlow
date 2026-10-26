import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FeatureNotice, type FeatureMessage } from '@/components/FeatureNotice';
import { FilterChips } from '@/components/FilterChips';
import { PreviewNotice } from '@/components/PreviewNotice';
import { SearchInput } from '@/components/SearchInput';
import { TabScreen } from '@/components/TabScreen';
import { useAuth } from '@/features/auth/AuthProvider';
import { previewBookings } from '@/features/preview/bookings';
import { colors } from '@/theme/tokens';

type Status = 'all' | 'confirmed' | 'pending';
const filters = [{ key: 'all', label: 'Semua' }, { key: 'confirmed', label: 'Dikonfirmasi' }, { key: 'pending', label: 'Menunggu' }] as const;

export default function BookingsScreen() {
  const { state } = useAuth();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [feature, setFeature] = useState<FeatureMessage | null>(null);
  if (state.status !== 'authenticated') return null;
  const canAccess = state.session.role === 'owner' || state.session.permissions.booking;
  const filtered = previewBookings.filter((booking) => (status === 'all' || booking.status === status)
    && `${booking.id} ${booking.clientName} ${booking.packageName}`.toLocaleLowerCase('id-ID').includes(query.trim().toLocaleLowerCase('id-ID')));

  return <TabScreen title="Booking" subtitle="Kelola daftar booking studio" right={canAccess ? <Badge label={`${filtered.length} booking`} withDot={false} /> : undefined}>
    {canAccess ? <>
      <PreviewNotice />
      <SearchInput value={query} onChangeText={setQuery} placeholder="Cari nama pelanggan atau nomor booking..." />
      <View style={styles.toolbar}><View style={styles.filters}><FilterChips<Status> options={[...filters]} selectedKey={status} onSelect={setStatus} /></View>
        <Pressable style={styles.add} accessibilityRole="button" accessibilityLabel="Booking baru"
          onPress={() => setFeature({ title: 'Booking baru', message: 'Pembuatan dan penyimpanan booking segera tersedia. Data pratinjau tidak mencatat transaksi.' })}>
          <Feather name="plus" size={20} color={colors.paper} />
        </Pressable>
      </View>
      {filtered.map((booking) => <Card key={booking.id} onPress={() => setFeature({ title: `#${booking.id}`, message: `${booking.clientName} · ${booking.packageName}. Ini contoh tampilan booking; detail operasional segera tersedia.` })}>
        <View style={styles.row}><Text style={styles.id}>#{booking.id}</Text><Feather name="chevron-right" size={18} color={colors.ink} /></View>
        <Text style={styles.name}>{booking.clientName}</Text>
        <Text style={styles.meta}>{booking.packageName} · {booking.time}</Text>
        <View style={styles.statuses}>
          <Badge label={booking.status === 'confirmed' ? 'Dikonfirmasi' : 'Menunggu'} variant={booking.status === 'confirmed' ? 'success' : 'warning'} withDot={false} />
          <Badge label={booking.paid > 0 ? 'DP Dibayar' : 'Belum Dibayar'} variant={booking.paid > 0 ? 'neutral' : 'error'} withDot={false} />
        </View>
      </Card>)}
      {!filtered.length && <>
        <EmptyState icon="search" title="Booking tidak ditemukan" description="Coba nama lain atau ubah filter status booking." />
        <Button label="Reset pencarian" secondary onPress={() => { setQuery(''); setStatus('all'); }} />
      </>}
    </> : <EmptyState icon="lock" title="Akses booking terbatas" description="Hubungi pemilik studio untuk mendapatkan izin operasional booking." />}
    <FeatureNotice feature={feature} onClose={() => setFeature(null)} />
  </TabScreen>;
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 }, filters: { flex: 1, minWidth: 0 },
  add: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, id: { fontSize: 13, fontWeight: '600', color: colors.text },
  name: { fontSize: 16, lineHeight: 23, color: colors.text, fontWeight: '600' },
  meta: { fontSize: 12, lineHeight: 18, color: colors.muted }, statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
