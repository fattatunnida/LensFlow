import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export type FeatureMessage = { title: string; message: string };

export function FeatureNotice({ feature, onClose }: { feature: FeatureMessage | null; onClose(): void }) {
  if (!feature) return null;
  return <Modal visible={feature !== null} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.dialog} accessibilityViewIsModal>
        <Text style={styles.title} accessibilityRole="header">{feature.title}</Text>
        <Text style={styles.message}>{feature.message}</Text>
        <Button label="Mengerti" tone="brand" onPress={onClose} />
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: spacing.xl, backgroundColor: 'rgba(20,36,30,0.45)', justifyContent: 'center', alignItems: 'center' },
  dialog: { width: '100%', maxWidth: 380, padding: spacing.xxl, gap: spacing.lg, borderRadius: radii.xl, backgroundColor: colors.paper },
  title: { ...typography.section, fontSize: 20, lineHeight: 26, color: colors.ink },
  message: { ...typography.body, color: colors.muted },
});
