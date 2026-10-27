import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Switch, Text, View } from 'react-native';
import { deviceAlerts } from '../../lib/feedback/device-alerts';
import { feedback } from '../../lib/feedback/store';
import { masterStyles as s } from '../master-data/ui';

export function DeviceAlertSettings() {
  const [enabled, setEnabled] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const generation = useRef(0), lock = useRef(false);
  useFocusEffect(useCallback(() => {
    const request = ++generation.current;
    lock.current = false; setBusy(false);
    void deviceAlerts.readEnabled().then(value => { if (request === generation.current) setEnabled(value); });
    return () => { ++generation.current; };
  }, []));
  async function toggle(value: boolean) {
    if (lock.current) return;
    const request = generation.current, announce = feedback.capture();
    lock.current = true; setBusy(true); setMessage('');
    try {
      const result = await deviceAlerts.setEnabled(value);
      if (request === generation.current) {
        setEnabled(result.enabled); setMessage(result.message);
        announce({ title: result.enabled ? 'Notifikasi HP aktif' : 'Pengaturan notifikasi HP', message: result.message, tone: 'info', device: result.enabled });
      }
    } catch { if (request === generation.current) setMessage('Pengaturan belum berhasil diubah. Coba lagi melalui aplikasi atau pengaturan HP.'); }
    finally { lock.current = false; if (request === generation.current) setBusy(false); }
  }
  if (!deviceAlerts.available) return <Text style={s.muted}>Pesan login, logout, dan penyimpanan tampil di aplikasi. Pengaturan notifikasi HP tersedia pada aplikasi Android/iOS.</Text>;
  return <View style={s.card}>
    <View style={s.spread}><View style={s.grow}><Text style={s.title}>Notifikasi login/logout di HP</Text><Text style={s.muted}>Berlaku di perangkat ini setelah Anda memberikan izin. Pesan di aplikasi tetap tersedia.</Text></View><Switch accessibilityLabel="Notifikasi login/logout di HP" value={enabled} disabled={busy} onValueChange={value => { void toggle(value); }} /></View>
    {!!message && <Text accessibilityRole="alert" style={s.muted}>{message}</Text>}
  </View>;
}
