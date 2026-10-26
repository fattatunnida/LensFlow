import { useState } from 'react';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FeatureNotice, type FeatureMessage } from '@/components/FeatureNotice';
import { SearchInput } from '@/components/SearchInput';
import { TabScreen } from '@/components/TabScreen';
import { useAuth } from '@/features/auth/AuthProvider';

export default function ClientsScreen() {
  const { state } = useAuth();
  const [query, setQuery] = useState('');
  const [feature, setFeature] = useState<FeatureMessage | null>(null);
  if (state.status !== 'authenticated') return null;
  const allowed = state.session.role === 'owner' || state.session.permissions.calendarCrm;
  return <TabScreen title="Pelanggan" subtitle="Kontak dan riwayat pemotretan">
    {allowed ? <>
      <SearchInput value={query} onChangeText={setQuery} placeholder="Cari nama atau nomor telepon..." />
      <EmptyState icon={query.trim() ? 'search' : 'users'} title={query.trim() ? 'Pelanggan tidak ditemukan' : 'Semua pelanggan dalam satu tempat'}
        description={query.trim() ? 'Coba nama lain atau hapus pencarian.' : 'Kontak pelanggan dan riwayat sesi foto segera tersedia di sini.'} />
      {query ? <Button label="Reset pencarian" secondary onPress={() => setQuery('')} />
        : <Button label="+ Tambah Pelanggan" tone="brand" onPress={() => setFeature({ title: 'Tambah pelanggan', message: 'Penyimpanan kontak pelanggan dan riwayat sesi segera tersedia.' })} />}
    </> : <EmptyState icon="lock" title="Akses pelanggan terbatas" description="Hubungi pemilik studio untuk mendapatkan izin kalender dan CRM." />}
    <FeatureNotice feature={feature} onClose={() => setFeature(null)} />
  </TabScreen>;
}
