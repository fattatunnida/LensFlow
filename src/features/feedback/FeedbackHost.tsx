import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApertureMark } from '../../components/ApertureMark';
import { feedback } from '../../lib/feedback/store';
import { deviceAlerts } from '../../lib/feedback/device-alerts';
import { colors } from '../../theme/tokens';

/** Lives above navigation so confirmations survive login/logout and redirects. */
export function FeedbackHost() {
  const items = useSyncExternalStore(feedback.subscribe, feedback.getSnapshot, feedback.getSnapshot);
  const current = items[0], insets = useSafeAreaInsets();
  const epoch = feedback.getEpoch(), handled = useRef(0), lastEpoch = useRef(-1);
  useEffect(() => {
    if (!deviceAlerts.available) return;
    if (lastEpoch.current !== epoch) { lastEpoch.current = epoch; void deviceAlerts.clear().catch(() => {}); }
    for (const item of items) {
      if (item.id <= handled.current) continue;
      handled.current = item.id;
      if (item.device) void deviceAlerts.deliver(item, () => feedback.isCurrent(item.epoch) && item.expiresAt > Date.now()).catch(() => {});
    }
  }, [items, epoch]);
  useEffect(() => {
    if (!current) return;
    const dismiss = () => feedback.dismiss(current.id);
    const timer = setTimeout(dismiss, Math.max(0, current.expiresAt - Date.now()));
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && current.expiresAt <= Date.now()) dismiss(); });
    return () => { clearTimeout(timer); listener.remove(); };
  }, [current]);
  if (!current) return null;
  const tone = current.tone === 'error' ? colors.error : current.tone === 'info' ? colors.info : colors.success;
  return <View pointerEvents="box-none" style={[styles.overlay, { top: insets.top + 10 }]}>
    <View pointerEvents="box-none" style={[styles.notice, { borderLeftColor: tone }]} testID="app-notification">
      <View pointerEvents="none"><ApertureMark size={28} /></View>
      <View pointerEvents="none" style={styles.content} accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={[current.title, current.message].filter(Boolean).join('. ')}>
        <Text style={styles.title}>{current.title}</Text>
        {!!current.message && <Text style={styles.message}>{current.message}</Text>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Tutup pemberitahuan" hitSlop={8} onPress={() => feedback.dismiss(current.id)} style={styles.close}>
        <Feather name="x" size={18} color={colors.muted} />
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 10000 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, width: '100%', maxWidth: 480, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderRadius: 14, backgroundColor: colors.paper, elevation: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' },
  content: { flex: 1, gap: 3 }, title: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  message: { color: colors.muted, fontSize: 12, lineHeight: 18 }, close: { padding: 6, alignSelf: 'flex-start' },
});
