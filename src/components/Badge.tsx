import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral' | 'accent' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  withDot?: boolean;
  style?: ViewStyle;
}

export function Badge({
  label,
  variant = 'neutral',
  withDot = true,
  style,
}: BadgeProps) {
  const variantStyles = styles[variant] ?? styles.neutral;

  return (
    <View style={[styles.badge, variantStyles.container, style]}>
      {withDot && <View style={[styles.dot, variantStyles.dot]} />}
      <Text style={[styles.label, variantStyles.label]}>{label}</Text>
    </View>
  );
}

const styles = {
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
    gap: 6,
  } as ViewStyle,
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  success: StyleSheet.create({
    container: { backgroundColor: colors.successLight },
    dot: { backgroundColor: colors.success },
    label: { color: colors.success },
  }),
  warning: StyleSheet.create({
    container: { backgroundColor: colors.warningLight },
    dot: { backgroundColor: colors.warning },
    label: { color: colors.warning },
  }),
  error: StyleSheet.create({
    container: { backgroundColor: colors.errorLight },
    dot: { backgroundColor: colors.error },
    label: { color: colors.error },
  }),
  neutral: StyleSheet.create({
    container: { backgroundColor: colors.greenLight },
    dot: { backgroundColor: colors.ink },
    label: { color: colors.ink },
  }),
  accent: StyleSheet.create({
    container: { backgroundColor: colors.accentLight },
    dot: { backgroundColor: colors.accent },
    label: { color: colors.accent },
  }),
  info: StyleSheet.create({
    container: { backgroundColor: colors.infoLight },
    dot: { backgroundColor: colors.info },
    label: { color: colors.info },
  }),
};
