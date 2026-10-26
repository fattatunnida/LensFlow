import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme/tokens';

export function EmptyState({ icon, title, description }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; description: string }) {
  return <View style={styles.container}>
    <View style={styles.icon}><Feather name={icon} size={27} color={colors.ink} /></View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.description}>{description}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 48 },
  icon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.section, color: colors.ink, textAlign: 'center' },
  description: { ...typography.body, color: colors.muted, textAlign: 'center', maxWidth: 300 },
});
