/** Studio dates default to Jakarta, independently of the device's timezone. */
export const DEFAULT_TIME_ZONE = 'Asia/Jakarta';
type DateInput = string | number | Date;
const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatCurrency(amount: number): string {
  return Number.isFinite(amount) ? `Rp ${rupiah.format(Math.round(amount))}` : '—';
}

function dateParts(input: DateInput, timeZone: string) {
  const date = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    let formatter = dateFormatters.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      dateFormatters.set(timeZone, formatter);
    }
    return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  } catch { return null; }
}

export function formatDate(input: DateInput, options?: { showDayName?: boolean; monthStyle?: 'short' | 'long'; timeZone?: string }): string {
  const parts = dateParts(input, options?.timeZone ?? DEFAULT_TIME_ZONE);
  if (!parts) return '—';
  const long = options?.monthStyle === 'long';
  const months = long
    ? ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const days = long ? ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] : ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const dayOfWeek = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))).getUTCDay();
  const prefix = options?.showDayName === false ? '' : `${days[dayOfWeek]}, `;
  return `${prefix}${Number(parts.day)} ${months[Number(parts.month) - 1]} ${parts.year}`;
}

export function formatTime(input: DateInput, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = dateParts(input, timeZone);
  return parts ? `${parts.hour}:${parts.minute}` : '--:--';
}

export function formatTimeRange(start: DateInput, end: DateInput, timeZone = DEFAULT_TIME_ZONE): string {
  return `${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}`;
}

/** Normalization only; subscriber-number validation belongs in customer forms. */
export function normalizePhoneNumber(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return digits.length > 2 ? `+${digits.slice(2)}` : '';
  if (digits.startsWith('62')) return `+${digits}`;
  if (digits.startsWith('0')) return digits.length > 1 ? `+62${digits.slice(1)}` : '';
  return `+62${digits}`;
}

export function formatDisplayPhone(raw: string): string {
  const normalized = normalizePhoneNumber(raw);
  if (!normalized.startsWith('+62')) return raw.trim();
  const local = normalized.slice(3);
  if (local.length <= 3) return `0${local}`;
  if (local.length <= 7) return `0${local.slice(0, 3)}-${local.slice(3)}`;
  return `0${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
}
