export type Permissions = { booking: boolean; calendarCrm: boolean; payments: boolean; reports: boolean };
export type StudioSession = {
  uid: string;
  email: string;
  displayName: string;
  studioId: string;
  studioName: string;
  role: 'owner' | 'staff';
  permissions: Permissions;
};

export class AccessDeniedError extends Error {
  constructor() { super('Akun belum memiliki akses aktif ke studio. Hubungi pemilik studio.'); }
}

type RecordData = Record<string, unknown> | undefined;

export function parseSession(uid: string, profile: RecordData, member: RecordData, studio: RecordData): StudioSession {
  const permissions = member?.permissions as RecordData;
  if (!profile || !member || !studio
    || typeof profile.studioId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(profile.studioId)
    || typeof profile.displayName !== 'string' || !profile.displayName.trim()
    || typeof profile.email !== 'string'
    || typeof studio.name !== 'string' || !studio.name.trim()
    || member.status !== 'active' || (member.role !== 'owner' && member.role !== 'staff')
    || !permissions || ['booking', 'calendarCrm', 'payments', 'reports'].some((key) => typeof permissions[key] !== 'boolean')) {
    throw new AccessDeniedError();
  }
  return {
    uid, email: profile.email, displayName: profile.displayName,
    studioId: profile.studioId, studioName: studio.name, role: member.role,
    permissions: {
      booking: permissions.booking as boolean,
      calendarCrm: permissions.calendarCrm as boolean,
      payments: permissions.payments as boolean,
      reports: permissions.reports as boolean,
    },
  };
}
