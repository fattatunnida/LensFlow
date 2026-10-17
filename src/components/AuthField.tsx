import Feather from '@expo/vector-icons/Feather';
import { useState, useRef, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '@/theme/tokens';

type Props = TextInputProps & { label: string; error?: string; password?: boolean; appearance?: 'default' | 'login' };
export function AuthField({ label, error, password = false, editable = true, appearance = 'default', ...props }: Props) {
  const reference = appearance === 'login';
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  return <View style={styles.field}>
    <Text style={[styles.label, reference && styles.referenceLabel]}>{label}</Text>
    <View style={[styles.inputWrap, reference && styles.referenceWrap, focused && styles.focused, !!error && styles.invalid]}>
      {!reference && <Feather name={password ? 'lock' : 'mail'} color={focused ? colors.ink : colors.muted} size={18} />}
      <TextInput ref={input} {...props} editable={editable} accessibilityLabel={label}
        placeholderTextColor={reference ? '#7A8C98' : colors.muted} secureTextEntry={password && !visible}
        autoCapitalize="none" autoCorrect={false} style={[styles.input, reference && styles.referenceInput]}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      {password && <Pressable accessibilityRole="button" disabled={!editable}
        accessibilityLabel={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        onPress={() => { setVisible((value) => !value); input.current?.focus(); }} style={styles.eye}>
        <Feather name={visible ? 'eye-off' : 'eye'} size={18} color={reference ? '#7A8C98' : colors.muted} />
      </Pressable>}
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  field: { gap: 9 }, label: { fontSize: 14, fontWeight: '600', color: colors.text },
  inputWrap: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 5, gap: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, borderRadius: 14 },
  input: { flex: 1, minWidth: 0, minHeight: 54, paddingVertical: 14, fontSize: 15, color: colors.text, outlineWidth: 0 },
  focused: { borderColor: colors.ink }, invalid: { borderColor: colors.error },
  eye: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 12, color: colors.error, lineHeight: 18 },
  referenceLabel: { color: '#1D3035', fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'Arial', fontSize: 14, lineHeight: 17, fontWeight: '500' },
  referenceWrap: { minHeight: 48, paddingLeft: 13, paddingRight: 0, borderRadius: 12, borderColor: '#DDDEDE', gap: 0 },
  referenceInput: { minHeight: 46, paddingVertical: 12, fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'Arial', fontSize: 14, color: '#1D3035' },
});
