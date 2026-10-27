import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Notice } from './store';

const preference = 'lensflow.device-alerts.enabled.v1', channelId = 'lensflow-account-status';
let queue: Promise<unknown> = Promise.resolve();
let modulePromise: Promise<typeof import('expo-notifications')> | undefined;
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}
async function load() {
  modulePromise ??= import('expo-notifications').then(notifications => {
    notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
    return notifications;
  }).catch(error => { modulePromise = undefined; throw error; });
  return modulePromise;
}
async function allowed() {
  const notifications = await load(), permission = await notifications.getPermissionsAsync();
  return permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
}
async function enabled() {
  try { return await SecureStore.getItemAsync(preference) === 'true' && await allowed(); }
  catch { return false; }
}
export const deviceAlerts = {
  available: true,
  readEnabled() { return serial(enabled); },
  setEnabled(enabled: boolean) {
    return serial(async () => {
      const notifications = await load();
      if (!enabled) {
        await SecureStore.setItemAsync(preference, 'false');
        await notifications.cancelAllScheduledNotificationsAsync();
        await notifications.dismissAllNotificationsAsync();
        return { enabled: false, message: 'Notifikasi HP dinonaktifkan. Pesan di aplikasi tetap tampil.' };
      }
      if (Platform.OS === 'android') await notifications.setNotificationChannelAsync(channelId, { name: 'Status akun LensFlow', importance: notifications.AndroidImportance.DEFAULT, sound: null, lockscreenVisibility: notifications.AndroidNotificationVisibility.PRIVATE });
      let permission = await notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) permission = await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: false } });
      const granted = permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
      await SecureStore.setItemAsync(preference, granted ? 'true' : 'false');
      return { enabled: granted, message: granted ? 'Notifikasi login dan logout di HP sudah aktif.' : 'Izin notifikasi belum diberikan. Anda dapat mengizinkannya melalui pengaturan HP.' };
    });
  },
  deliver(notice: Notice, isCurrent: () => boolean) {
    return serial(async () => {
      if (!isCurrent() || !await enabled() || !isCurrent()) return;
      const notifications = await load();
      const id = await notifications.scheduleNotificationAsync({ identifier: `lensflow-status-${notice.epoch}-${notice.id}`, content: { title: notice.title, body: notice.message ?? '', sound: false, data: { kind: 'account-status' } }, trigger: Platform.OS === 'android' ? { channelId } : null });
      if (!isCurrent()) {
        await notifications.cancelScheduledNotificationAsync(id);
        await notifications.dismissNotificationAsync(id);
      }
    });
  },
  clear() {
    return serial(async () => {
      const notifications = await load();
      await notifications.cancelAllScheduledNotificationsAsync();
      await notifications.dismissAllNotificationsAsync();
    });
  },
};
