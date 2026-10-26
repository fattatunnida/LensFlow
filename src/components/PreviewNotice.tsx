import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme/tokens';

export function PreviewNotice() {
  return <View style={styles.notice}>
    <Feather name="info" size={15} color={colors.ink} />
    <Text style={styles.text}>Pratinjau · Data contoh, bukan transaksi studio.</Text>
  </View>;
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 10, backgroundColor: colors.greenLight },
  text: { flex: 1, fontSize: 11, lineHeight: 16, color: colors.ink },
});
