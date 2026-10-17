import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';

export function Brand({ large = false }: { large?: boolean }) {
  return <View style={[styles.row, large && styles.column]} accessibilityLabel="LensFlow">
    <View style={[styles.mark, large && styles.largeMark]}>
      <Feather name="camera" size={large ? 36 : 23} color={colors.paper} />
      <View style={styles.dot} />
    </View>
    <Text style={[styles.name, large && styles.largeName]}>Lens<Text style={styles.flow}>Flow</Text></Text>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  column: { flexDirection: 'column', gap: 20 },
  mark: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  largeMark: { width: 80, height: 80, borderRadius: 25 },
  dot: { position: 'absolute', width: 8, height: 8, backgroundColor: colors.accent, borderRadius: 4, right: -2, top: -2, borderWidth: 2, borderColor: colors.background },
  name: { fontSize: 25, fontWeight: '700', letterSpacing: -1.1, color: colors.ink },
  largeName: { fontSize: 37, letterSpacing: -1.8 },
  flow: { fontWeight: '400' },
});
