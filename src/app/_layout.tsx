import { Stack } from 'expo-router';
import * as NativeSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { SplashView } from '@/features/auth/SplashView';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/Button';
import { colors } from '@/theme/tokens';

void NativeSplashScreen.preventAutoHideAsync().catch(() => {});

function Routes() {
  const { state, retry, logout } = useAuth();
  // Hand over to the React splash immediately; a slow server must never leave
  // the unresponsive native splash covering the connection error/retry action.
  useEffect(() => { void NativeSplashScreen.hideAsync().catch(() => {}); }, []);
  if (state.status === 'loading') return <SplashView />;
  if (state.status === 'unavailable') return <AuthShell>
    <View style={styles.errorContent}>
      <Text style={styles.heading}>Koneksi belum siap</Text>
      <Text style={styles.body} accessibilityRole="alert">{state.message}</Text>
      <Button label="Coba lagi" onPress={retry} />
      <Button label="Kembali ke masuk" secondary onPress={() => { void logout().catch(retry); }} />
    </View>
  </AuthShell>;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="index" />
    <Stack.Protected guard={state.status === 'signedOut'}><Stack.Screen name="(auth)" /></Stack.Protected>
    <Stack.Protected guard={state.status === 'authenticated'}><Stack.Screen name="(app)" /></Stack.Protected>
    <Stack.Screen name="+not-found" />
  </Stack>;
}

export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><StatusBar style="dark" /><Routes /></AuthProvider></SafeAreaProvider>;
}
const styles = StyleSheet.create({
  errorContent: { gap: 20 }, heading: { fontSize: 28, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, lineHeight: 24, color: colors.muted },
});
