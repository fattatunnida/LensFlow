import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
export default function NotFound() {
  return <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 20, backgroundColor: colors.background }}>
    <Text style={{ fontSize: 26, fontWeight: '700', color: colors.ink }}>Halaman tidak tersedia</Text>
    <Link href="/" replace style={{ paddingVertical: 16, color: colors.accent }}>Kembali ke LensFlow</Link>
  </View>;
}
