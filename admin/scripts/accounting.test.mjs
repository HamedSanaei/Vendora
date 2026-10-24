import assert from 'node:assert/strict';
import test from 'node:test';
import { reportDate, number } from '../src/features/admin/accounting/format.ts';
import { partyName } from '../src/features/admin/accounting/model.ts';

test('report boundaries are explicit UTC and reject malformed, impossible and injection-like dates', () => {
  assert.equal(reportDate('2026-10-24'), '2026-10-24T00:00:00.000Z');
  assert.equal(reportDate('2026-10-24', true), '2026-10-24T23:59:59.999Z');
  assert.equal(reportDate('2024-02-29'), '2024-02-29T00:00:00.000Z');
  for (const value of [null, '', '2026-02-29', '2026-02-31', '2026-99-01', '<script>', '2026-10-24T00:00:00Z']) assert.equal(reportDate(value), null);
});

test('party display uses the persisted snapshot, with safe handling of invalid legacy snapshots', () => {
  assert.equal(partyName('{"Name":"فروشگاه نمونه"}'), 'فروشگاه نمونه');
  for (const json of ['null', '{}', '{"Name":123}', '{', '[]']) assert.equal(partyName(json), '—');
});

test('large Toman amounts and USD fractions stay readable without rounding accounting amounts upward', () => {
  assert.equal(number(128400000, 'fa'), '۱۲۸٬۴۰۰٬۰۰۰');
  assert.equal(number(8.5, 'en'), '8.5');
  assert.equal(number(0, 'fa'), '۰');
  assert.equal(number(-1234.25, 'en'), '-1,234.25');
});
