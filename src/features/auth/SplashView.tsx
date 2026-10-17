import { useEffect, useState } from 'react';
import { Animated, ImageBackground, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ApertureMark } from '@/components/ApertureMark';

export function SplashView() {
  const [progress] = useState(() => new Animated.Value(0));
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 1700, useNativeDriver: Platform.OS !== 'web' }));
    animation.start();
    return () => { animation.stop(); };
  }, [progress]);
  return <ImageBackground source={require('../../../assets/auth/studio-background.jpg')} style={styles.page} imageStyle={styles.photo} resizeMode="cover">
    <View pointerEvents="none" style={styles.shade} />
    <StatusBar style="light" />
    <SafeAreaView style={styles.safe}>
      <View style={[styles.intro, { paddingTop: Math.max(36, height * 0.137 - insets.top) }]}>
        <ApertureMark gold />
        <Text style={styles.name}>LensFlow</Text>
        <Text style={styles.subtitle}>Photography Studio{'\n'}Management App</Text>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(24, height * 0.063 - insets.bottom) }]}>
        <Text style={styles.tagline}>Kelola setiap momen,{'\n'}dengan lebih baik.</Text>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel="Memeriksa sesi" accessibilityValue={{ text: 'Sedang memuat' }}>
          <Animated.View style={[styles.progress, { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-70, 180] }) }] }]} />
        </View>
      </View>
    </SafeAreaView>
  </ImageBackground>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#152F25', overflow: 'hidden' }, safe: { flex: 1, justifyContent: 'space-between' },
  photo: { width: '110%', height: '110%', left: '-5%', top: 0 },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(13, 42, 29, 0.18)' },
  intro: { alignItems: 'center', paddingHorizontal: 26 },
  name: { marginTop: 18, fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'Arial', fontSize: 40, lineHeight: 48, fontWeight: '700', color: '#D9CCA4' },
  subtitle: { marginTop: 14, fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'Arial', fontSize: 18, lineHeight: 24, textAlign: 'center', color: '#FFFFFF' },
  footer: { alignItems: 'center', paddingHorizontal: 26, paddingTop: 24 },
  tagline: { fontSize: 18, lineHeight: 24, textAlign: 'center', color: '#FFFFFF' },
  track: { marginTop: 48, height: 4, width: 180, backgroundColor: '#527E6F', overflow: 'hidden' },
  progress: { height: 4, width: 70, backgroundColor: '#D9CCA4' },
});
