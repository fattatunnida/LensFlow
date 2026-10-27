import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { ApertureMark } from './ApertureMark';

export function Brand({ large = false }: { large?: boolean }) {
  return <View style={[styles.row, large && styles.column]} accessibilityLabel="LensFlow">
    <ApertureMark size={large ? 80 : 44} />
    <Text style={[styles.name, large && styles.largeName]}>LensFlow</Text>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  column: { flexDirection: 'column', gap: 20 },
  name: { fontSize: 25, fontWeight: '700', letterSpacing: -1.1, color: colors.ink },
  largeName: { fontSize: 37, letterSpacing: -1.8 },
});
