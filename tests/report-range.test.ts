import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportRange } from '../src/features/management/report-range';
test('report presets handle year rollover, leap year and current partial periods',()=>{
  assert.deepEqual(reportRange('lastMonth','2026-01-15'),{from:'2025-12-01',to:'2025-12-31'});
  assert.deepEqual(reportRange('lastMonth','2028-03-01'),{from:'2028-02-01',to:'2028-02-29'});
  assert.deepEqual(reportRange('thisMonth','2026-10-26'),{from:'2026-10-01',to:'2026-10-26'});
  assert.deepEqual(reportRange('thisYear','2026-01-01'),{from:'2026-01-01',to:'2026-01-01'});
});
