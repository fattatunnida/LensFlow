import Feather from '@expo/vector-icons/Feather';
import { useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

interface SearchInputProps extends Omit<TextInputProps, 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  containerStyle?: ViewStyle;
}

export function SearchInput({
  value,
  onChangeText,
  onClear,
  placeholder = 'Cari...',
  containerStyle,
  ...props
}: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  function handleClear() {
    onChangeText('');
    onClear?.();
    input.current?.focus();
  }

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        containerStyle,
      ]}
    >
      <Feather
        name="search"
        size={18}
        color={isFocused ? colors.ink : colors.muted}
        style={styles.icon}
      />
      <TextInput
        {...props}
        ref={input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, props.style]}
        onFocus={(event) => { setIsFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setIsFocused(false); props.onBlur?.(event); }}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <Pressable
          onPress={handleClear}
          disabled={props.editable === false}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Hapus pencarian"
          accessibilityState={{ disabled: props.editable === false }}
          style={styles.clearButton}
        >
          <Feather name="x" size={16} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  containerFocused: {
    borderColor: colors.ink,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    outlineWidth: 0,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  clearButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
});
