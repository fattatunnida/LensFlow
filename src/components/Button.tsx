import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';

type Props = { label: string; onPress(): void; loading?: boolean; disabled?: boolean; secondary?: boolean; arrow?: boolean; tone?: 'accent' | 'brand' };
export function Button({ label, onPress, loading, disabled, secondary, arrow = false, tone = 'accent' }: Props) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || loading, busy: loading }}
    disabled={disabled || loading} onPress={onPress}
    style={({ pressed }) => [styles.button, tone === 'brand' && styles.brand, secondary && styles.secondary, pressed && { opacity: 0.8 }, (disabled || loading) && { opacity: 0.65 }]}>
    {loading ? <ActivityIndicator color={secondary ? colors.ink : colors.paper} /> : <View style={styles.content}>
      <Text style={[styles.label, secondary && { color: colors.ink }]}>{label}</Text>
      {arrow && <Feather name="arrow-right" size={19} color={colors.paper} />}
    </View>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 54, borderRadius: 15, backgroundColor: colors.accent, paddingHorizontal: 22, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.greenLight },
  brand: { backgroundColor: colors.ink, borderRadius: 12 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  label: { fontSize: 16, fontWeight: '600', color: colors.paper },
});
