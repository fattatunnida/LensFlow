import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips } from '../../components/FilterChips';
import { HeaderBar } from '../../components/HeaderBar';
import { SearchInput } from '../../components/SearchInput';
import { formatCurrency, formatDisplayPhone } from '../../lib/formatters';
import { colors } from '../../theme/tokens';
import { useMasterList } from './hooks';
import { canWrite, type MasterKind, type MasterRecords, type PackageFilter } from './models';
import { DataError, goBack, LoadingData, masterStyles as s } from './ui';

export function ClientsListScreen() { return <MasterListScreen kind="clients" />; }
export function PackagesListScreen() { return <MasterListScreen kind="packages" />; }

function MasterListScreen({ kind }: { kind: MasterKind }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PackageFilter>('all');
  const resource = useMasterList(kind, search, filter);
  const clients = kind === 'clients';
  const editable = canWrite(resource.actor, kind);
  const openNew = () => router.push(clients ? '/clients/new' : '/packages/new');
  const header = <View style={{ gap: 14, paddingBottom: 18 }}>
    <HeaderBar title={clients ? 'Pelanggan' : 'Paket Foto'} subtitle={clients ? 'Kontak pelanggan studio' : 'Katalog layanan studio'}
      onBack={clients ? undefined : () => goBack('/more')}
      right={resource.status === 'ready' && resource.allowed ? <Badge label={`${resource.items.length}${resource.hasMore ? '+' : ''} ${clients ? 'pelanggan' : 'paket'}`} withDot={false} /> : undefined} />
    {resource.allowed && <>
      <SearchInput value={search} onChangeText={setSearch} maxLength={100} autoCapitalize="none" autoCorrect={false}
        placeholder={clients ? 'Cari nama atau nomor telepon...' : 'Cari nama paket...'} />
      <Text style={s.muted}>{clients ? 'Ketik awal nama atau nomor telepon. Nomor 08 dan +62 dikenali.' : 'Cari berdasarkan awal nama paket.'}</Text>
      {!clients && resource.actor?.role === 'owner' && <FilterChips<PackageFilter>
        options={[{ key: 'all', label: 'Semua' }, { key: 'active', label: 'Aktif' }, { key: 'inactive', label: 'Nonaktif' }]}
        selectedKey={filter} onSelect={setFilter} />}
      {!clients && resource.actor?.role !== 'owner' && <Text style={s.muted}>Hanya paket aktif yang tersedia untuk booking baru.</Text>}
    </>}
  </View>;

  function row(item: MasterRecords[MasterKind]) {
    return <Pressable accessibilityRole="button" accessibilityLabel={`Detail ${clients ? 'pelanggan' : 'paket'} ${item.name}`}
      onPress={() => router.push(clients ? { pathname: '/clients/[id]', params: { id: item.id } } : { pathname: '/packages/[id]', params: { id: item.id } })}
      style={({ pressed }) => [s.card, { opacity: pressed ? 0.75 : 1 }]}>
      <View style={s.row}>
        <View style={s.avatar}>{'phone' in item ? <Text style={s.initial}>{item.name.split(' ').slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase()}</Text> : <Feather name="package" size={21} color={colors.ink} />}</View>
        <View style={s.grow}><Text style={s.title}>{item.name}</Text>
          <Text style={[s.muted, { marginTop: 4 }]}>{'phone' in item ? formatDisplayPhone(item.phone) : `${item.durationMinutes} menit · ${item.editedPhotosCount} foto edit`}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.ink} />
      </View>
      {'price' in item && <View style={s.spread}><Text style={s.title}>{formatCurrency(item.price)}</Text><Badge label={item.isActive ? 'Aktif' : 'Nonaktif'} variant={item.isActive ? 'success' : 'neutral'} withDot={false} /></View>}
    </Pressable>;
  }

  const empty = !resource.allowed
    ? <EmptyState icon="lock" title="Akses terbatas" description={`Hubungi pemilik studio untuk mendapatkan izin ${clients ? 'kalender dan CRM' : 'operasional booking'}.`} />
    : resource.status === 'loading' || resource.searching ? <LoadingData />
      : resource.status === 'error' ? <DataError message={resource.error} retry={resource.reload} />
        : <EmptyState icon={search ? 'search' : clients ? 'users' : 'package'}
          title={search || (!clients && filter !== 'all') ? 'Tidak ada hasil yang sesuai' : clients ? 'Tambahkan pelanggan pertama' : 'Belum ada paket foto'}
          description={search ? 'Coba awalan nama atau nomor lain, lalu muat ulang.' : clients ? 'Simpan kontak pelanggan agar mudah dihubungi untuk sesi berikutnya.' : 'Paket aktif akan tersedia saat membuat booking baru.'} />;

  return <SafeAreaView style={s.safe} edges={clients ? ['top'] : ['top', 'bottom']}>
    <FlatList style={s.flex} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
      data={resource.allowed ? resource.items : []} renderItem={({ item }) => row(item)} keyExtractor={(item) => item.id}
      ListHeaderComponent={header} ListEmptyComponent={empty}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshing={resource.status === 'loading' && resource.items.length > 0} onRefresh={resource.allowed ? resource.reload : undefined}
      ListFooterComponent={<View style={{ paddingTop: 16, gap: 12 }}>
        {!!resource.moreError ? <DataError message={resource.moreError} retry={resource.loadMore} />
          : resource.hasMore && <Button label={clients ? 'Muat pelanggan berikutnya' : 'Muat paket berikutnya'} secondary loading={resource.loadingMore} onPress={resource.loadMore} />}
      </View>} />
    {editable && <View style={s.footer}><Button tone="brand" label={clients ? '+ Tambah Pelanggan' : '+ Tambah Paket'} onPress={openNew} /></View>}
  </SafeAreaView>;
}
