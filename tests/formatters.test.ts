import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCurrency, formatDate, formatTime, formatTimeRange, normalizePhoneNumber, formatDisplayPhone } from '../src/lib/formatters';

test('Rupiah distinguishes zero and invalid amounts', () => {
  assert.equal(formatCurrency(0), 'Rp 0');
  assert.equal(formatCurrency(2500000), 'Rp 2.500.000');
  assert.equal(formatCurrency(1500.6), 'Rp 1.501');
  assert.equal(formatCurrency(NaN), '—');
  assert.equal(formatCurrency(Infinity), '—');
});

test('dates cross midnight in the studio timezone, with the correct weekday', () => {
  const input = '2026-10-24T18:05:00Z';
  assert.equal(formatDate(input, { monthStyle: 'long' }), 'Minggu, 25 Oktober 2026');
  assert.equal(formatDate(input, { showDayName: false }), '25 Okt 2026');
  assert.equal(formatDate(input, { timeZone: 'UTC', monthStyle: 'long' }), 'Sabtu, 24 Oktober 2026');
  assert.equal(formatTime(input), '01:05');
  assert.equal(formatTime(input, 'UTC'), '18:05');
  assert.equal(formatTimeRange(input, '2026-10-24T19:30:00Z'), '01:05 – 02:30');
});

test('invalid dates fail visibly without throwing or mutating inputs', () => {
  assert.equal(formatDate('invalid'), '—');
  assert.equal(formatTime(NaN), '--:--');
  assert.equal(formatDate(0, { timeZone: 'invalid-zone' }), '—');
  const input = new Date('2026-10-24T18:05:00Z');
  formatDate(input);
  assert.equal(input.toISOString(), '2026-10-24T18:05:00.000Z');
});

test('phone normalization preserves explicit international country codes', () => {
  for (const input of ['0812 3456 7890', '6281234567890', '+62 812-3456-7890', '006281234567890']) {
    assert.equal(normalizePhoneNumber(input), '+6281234567890');
  }
  assert.equal(normalizePhoneNumber('+44 20 1234 5678'), '+442012345678');
  assert.equal(formatDisplayPhone('+6281234567890'), '0812-3456-7890');
  assert.equal(formatDisplayPhone(''), '');
  assert.equal(normalizePhoneNumber('abc'), '');
  assert.equal(normalizePhoneNumber('0'), '');
});
