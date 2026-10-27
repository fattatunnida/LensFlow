import type { Notice } from './store';

/** Web keeps the same app feedback without requesting browser permissions. */
export const deviceAlerts = {
  available: false,
  async readEnabled() { return false; },
  async setEnabled(_enabled: boolean) { return { enabled: false, message: 'Notifikasi HP tersedia pada aplikasi Android/iOS.' }; },
  async deliver(_notice: Notice, _isCurrent: () => boolean) {},
  async clear() {},
};
