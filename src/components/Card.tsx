import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii, shadows, spacing } from '@/theme/tokens';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  highlight?: boolean;
}

export function Card({
  children,
  title,
  subtitle,
  headerRight,
  footer,
  onPress,
  style,
  highlight = false,
}: CardProps) {
  const hasHeader = Boolean(title || subtitle || headerRight);

  const content = (
    <View
      style={[
        styles.card,
        highlight && styles.highlight,
        shadows.card,
        style,
      ]}
    >
      {hasHeader && (
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            {Boolean(title) && <Text style={styles.title}>{title}</Text>}
            {Boolean(subtitle) && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
        </View>
      )}

      <View style={styles.body}>{children}</View>

      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  highlight: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  headerTextContainer: {
    flex: 1,
    gap: 3,
  },
  headerRight: {
    marginLeft: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  body: {
    gap: spacing.sm,
  },
  footer: {
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
