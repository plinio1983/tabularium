import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDailyReceiptTrend, buildMonthlyReceiptTrend, trimReceiptTrendAfterLastMovement} from '../lib/cash-register-trend';

test('fills every day of the selected month without inventing movements', () => {
  const points = buildDailyReceiptTrend(2026, 7, [
    {day: '2026-07-02', count: 2, total: 30},
    {day: '2026-07-05', count: 1, total: 12.5},
  ]);

  assert.equal(points.length, 31);
  assert.deepEqual(points[0], {day: '2026-07-01', count: 0, total: 0, average: 0});
  assert.deepEqual(points[1], {day: '2026-07-02', count: 2, total: 30, average: 15});
  assert.deepEqual(points[4], {day: '2026-07-05', count: 1, total: 12.5, average: 12.5});
});

test('uses the correct number of days for leap-year February', () => {
  assert.equal(buildDailyReceiptTrend(2028, 2, []).length, 29);
  assert.equal(buildDailyReceiptTrend(2027, 2, []).length, 28);
});

test('ends the daily chart at the last receipt, preserving internal gaps and zero-amount receipts', () => {
  const points = buildDailyReceiptTrend(2026, 7, [
    {day: '2026-07-02', count: 2, total: 30},
    {day: '2026-07-05', count: 1, total: 0},
  ]);
  const visible = trimReceiptTrendAfterLastMovement(points);
  assert.equal(visible.length, 5);
  assert.equal(visible[2].count, 0);
  assert.equal(visible[4].count, 1);
  assert.equal(points.length, 31);
});

test('ends the annual chart at the last month with receipts and handles empty periods', () => {
  const points = buildMonthlyReceiptTrend(2026, [{day: '2026-03-15', count: 1, total: 20}]);
  const visible = trimReceiptTrendAfterLastMovement(points);
  assert.equal(visible.length, 3);
  assert.equal(visible[2].day, '2026-03-01');
  assert.deepEqual(trimReceiptTrendAfterLastMovement(buildDailyReceiptTrend(2026, 7, [])), []);
  assert.deepEqual(trimReceiptTrendAfterLastMovement(buildMonthlyReceiptTrend(2026, [])), []);
});
