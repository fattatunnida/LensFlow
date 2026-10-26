export type MasterKind = 'clients' | 'packages';
export type MasterActor = { uid: string; studioId: string; role: 'owner' | 'staff'; crm: boolean; booking: boolean; payments?:boolean; reports?:boolean };
export type PackageFilter = 'all' | 'active' | 'inactive';
export const LEAD_SOURCES = ['', 'instagram', 'whatsapp', 'referral', 'google', 'other'] as const;
export type LeadSource = typeof LEAD_SOURCES[number];
export const leadSourceLabels: Record<LeadSource, string> = { '': 'Belum dipilih', instagram: 'Instagram', whatsapp: 'WhatsApp', referral: 'Referensi', google: 'Google', other: 'Lainnya' };

export type ClientInput = { name: string; phone: string; email: string; address: string; notes: string; leadSource: LeadSource };
export type ClientPayload = ClientInput & { nameKey: string };
export type PackageInput = { name: string; price: string; durationMinutes: string; editedPhotosCount: string; defaultLocation: string; description: string; isActive: boolean };
export type PackagePayload = { name: string; nameKey: string; price: number; durationMinutes: number; editedPhotosCount: number; defaultLocation: string; description: string; isActive: boolean };
export type RecordMeta = { id: string; version: number; mutationId: string; createdAt: number; updatedAt: number; createdBy: string; updatedBy: string };
export type ClientRecord = ClientPayload & RecordMeta;
export type PhotoPackage = PackagePayload & RecordMeta;
export type MasterRecords = { clients: ClientRecord; packages: PhotoPackage };
export type MasterPayloads = { clients: ClientPayload; packages: PackagePayload };

export function canRead(actor: MasterActor | null, kind: MasterKind): boolean {
  return !!actor && (actor.role === 'owner' || (kind === 'clients' ? actor.crm : actor.booking));
}
export function canWrite(actor: MasterActor | null, kind: MasterKind): boolean {
  return !!actor && (actor.role === 'owner' || (kind === 'clients' && actor.crm));
}

export class MasterDataError extends Error {
  constructor(public readonly reason: 'validation' | 'permission' | 'conflict' | 'missing' | 'network' | 'schema') { super(reason); }
}
export function masterErrorMessage(error: unknown): string {
  if (error instanceof MasterDataError) {
    if (error.reason === 'conflict') return 'Data sudah berubah di perangkat lain. Muat data terbaru sebelum menyimpan kembali. Input Anda masih dipertahankan.';
    if (error.reason === 'missing') return 'Data tidak ditemukan. Kembali ke daftar dan muat ulang.';
    if (error.reason === 'validation') return 'Periksa kembali isian yang belum sesuai.';
    if (error.reason === 'schema') return 'Data belum dapat ditampilkan karena formatnya tidak sesuai. Hubungi pemilik studio.';
    if (error.reason === 'permission') return 'Anda tidak memiliki izin untuk tindakan ini. Hubungi pemilik studio.';
  }
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code.includes('permission-denied') || code.includes('unauthenticated')) return 'Akses tidak diizinkan. Periksa izin akun Anda dengan pemilik studio.';
  return 'Belum dapat terhubung ke studio. Periksa koneksi Anda, lalu coba lagi. Input Anda tetap tersimpan di layar ini.';
}
