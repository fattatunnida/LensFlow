import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

export interface FilterOption<T extends string = string> {
  key: T;
  label: string;
  count?: number;
}

interface FilterChipsProps<T extends string = string> {
  options: FilterOption<T>[];
  selectedKey: T;
  onSelect: (key: T) => void;
  containerStyle?: ViewStyle;
}

export function FilterChips<T extends string = string>({
  options,
  selectedKey,
  onSelect,
  containerStyle,
}: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      style={styles.scroll}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, containerStyle]}
    >
      {options.map((option) => {
        const isSelected = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={({ pressed }) => [
              styles.chip,
              isSelected ? styles.chipSelected : styles.chipUnselected,
              pressed && styles.chipPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${option.label}${option.count !== undefined ? `, ${option.count} item` : ''}`}
          >
            <Text
              style={[
                styles.label,
                isSelected ? styles.labelSelected : styles.labelUnselected,
              ]}
            >
              {option.label}
            </Text>
            {option.count !== undefined && (
              <View
                style={[
                  styles.countBadge,
                  isSelected
                    ? styles.countBadgeSelected
                    : styles.countBadgeUnselected,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    isSelected
                      ? styles.countTextSelected
                      : styles.countTextUnselected,
                  ]}
                >
                  {option.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  scrollContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    gap: 6,
  },
  chipUnselected: {
    backgroundColor: colors.paper,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipPressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelUnselected: {
    color: colors.muted,
  },
  labelSelected: {
    color: colors.paper,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeUnselected: {
    backgroundColor: colors.greenLight,
  },
  countBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
  countTextUnselected: {
    color: colors.ink,
  },
  countTextSelected: {
    color: colors.paper,
  },
});
