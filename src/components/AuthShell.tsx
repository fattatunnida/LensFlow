import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type PropsWithChildren } from 'react';
import { Brand } from './Brand';
import { colors } from '@/theme/tokens';

export function AuthShell({ children }: PropsWithChildren) {
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={styles.container}>
          <View style={styles.header}><Brand /><Text style={styles.tagline}>Untuk setiap momen yang berarti.</Text></View>
          {children}
          <View style={styles.footer}><View style={styles.line} /><Text style={styles.footerText}>Dibuat untuk ritme studio Anda.</Text></View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 36 },
  container: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 36 },
  header: { gap: 14, paddingBottom: 12 }, tagline: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  footer: { alignItems: 'center', gap: 18, paddingTop: 8 }, line: { width: 34, height: 2, backgroundColor: colors.border },
  footerText: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
