import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing } from '@/theme/tokens';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
  destructive?: boolean;
}

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  loading = false,
  error,
  destructive = false,
}: ConfirmationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
    >
      <View style={styles.overlay}>
        <View
          style={[styles.dialog, shadows.modal]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {Boolean(error) && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: loading, busy: loading }}
              style={({ pressed }) => [
                styles.confirmButton,
                destructive && styles.destructiveButton,
                pressed && { opacity: 0.82 },
                loading && { opacity: 0.65 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.paper} />
              ) : (
                <Text style={styles.confirmLabel}>{confirmLabel}</Text>
              )}
            </Pressable>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              accessibilityState={{ disabled: loading }}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && { opacity: 0.82 },
                loading && { opacity: 0.65 },
              ]}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 36, 30, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.paper,
    borderRadius: radii.xxl,
    padding: spacing.xxl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 380,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 22,
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  confirmButton: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  destructiveButton: {
    backgroundColor: colors.error,
  },
  confirmLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.paper,
  },
  cancelButton: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
});
