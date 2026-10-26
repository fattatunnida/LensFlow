import { type PropsWithChildren, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from './HeaderBar';
import { colors } from '@/theme/tokens';

export function TabScreen({ title, subtitle, right, children }: PropsWithChildren<{ title: string; subtitle?: string; right?: ReactNode }>) {
  return <SafeAreaView edges={['top']} style={styles.safe}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View style={styles.page}>
        <HeaderBar title={title} subtitle={subtitle} right={right} />
        {children}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  page: { flexGrow: 1, width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 24, gap: 16 },
});
