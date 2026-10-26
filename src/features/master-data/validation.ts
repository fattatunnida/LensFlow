import { normalizePhoneNumber } from '../../lib/formatters';
import { LEAD_SOURCES, type ClientInput, type ClientPayload, type PackageInput, type PackagePayload } from './models';

export type ValidationResult<T> = { value: T; errors: Record<string, string> };
export function nameKey(name: string): string { return name.trim().toLowerCase(); }
export function validPhone(phone: string): boolean { return /^\+[1-9]\d{7,14}$/.test(phone); }
export function contactUrls(phone: string): { phone: string; whatsapp: string } | null {
  return validPhone(phone) ? { phone: `tel:${phone}`, whatsapp: `https://wa.me/${phone.slice(1)}` } : null;
}

export function validateClient(input: ClientInput): ValidationResult<ClientPayload> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const value: ClientPayload = { name, nameKey: nameKey(name), phone: normalizePhoneNumber(input.phone), email: input.email.trim().toLowerCase(), address: input.address.trim(), notes: input.notes.trim(), leadSource: input.leadSource };
  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 100) errors.name = 'Nama harus terdiri dari 2–100 karakter.';
  if (!/^\+?[\d\s().-]+$/.test(input.phone.trim()) || !validPhone(value.phone)) errors.phone = 'Masukkan nomor telepon yang sah, contoh 081234567890 atau +6281234567890.';
  if (value.email.length > 254 || (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) errors.email = 'Alamat email belum valid.';
  if (value.address.length > 500) errors.address = 'Alamat maksimal 500 karakter.';
  if (value.notes.length > 2000) errors.notes = 'Catatan maksimal 2.000 karakter.';
  if (!(LEAD_SOURCES as readonly string[]).includes(value.leadSource)) errors.leadSource = 'Pilih sumber pelanggan yang tersedia.';
  return { value, errors };
}

export function validatePackage(input: PackageInput): ValidationResult<PackagePayload> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const priceText = input.price.trim();
  const price = /^(\d+|\d{1,3}(\.\d{3})+)$/.test(priceText) ? Number(priceText.replaceAll('.', '')) : NaN;
  const durationMinutes = /^\d+$/.test(input.durationMinutes.trim()) ? Number(input.durationMinutes) : NaN;
  const editedPhotosCount = /^\d+$/.test(input.editedPhotosCount.trim()) ? Number(input.editedPhotosCount) : NaN;
  const value: PackagePayload = { name, nameKey: nameKey(name), price, durationMinutes, editedPhotosCount, defaultLocation: input.defaultLocation.trim(), description: input.description.trim(), isActive: input.isActive };
  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 100) errors.name = 'Nama paket harus terdiri dari 2–100 karakter.';
  if (!Number.isInteger(price) || price < 1 || price > 1_000_000_000) errors.price = 'Harga harus Rupiah bulat antara 1 dan 1.000.000.000.';
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 1440) errors.durationMinutes = 'Durasi harus 15–1.440 menit.';
  if (!Number.isInteger(editedPhotosCount) || editedPhotosCount < 0 || editedPhotosCount > 1000) errors.editedPhotosCount = 'Jumlah foto edit harus 0–1.000.';
  if (!value.defaultLocation || value.defaultLocation.length > 200) errors.defaultLocation = 'Isi lokasi pemotretan, maksimal 200 karakter.';
  if (value.description.length > 1000) errors.description = 'Deskripsi maksimal 1.000 karakter.';
  if (typeof value.isActive !== 'boolean') errors.isActive = 'Status paket belum valid.';
  return { value, errors };
}

export function clientSearch(query: string): { field: 'nameKey' | 'phone'; prefix: string } {
  const text = query.trim().toLowerCase();
  if (!text || !/^\+?[\d\s().-]+$/.test(text)) return { field: 'nameKey', prefix: text };
  const digits = text.replace(/\D/g, '');
  const prefix = text.startsWith('+') ? `+${digits}` : digits.startsWith('00') ? `+${digits.slice(2)}` : digits.startsWith('62') ? `+${digits}` : `+62${digits.startsWith('0') ? digits.slice(1) : digits}`;
  return { field: 'phone', prefix };
}
