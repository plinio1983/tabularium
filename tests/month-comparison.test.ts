import assert from 'node:assert/strict';
import test from 'node:test';
import {
  comparisonPeriod,
  parseMonthValue,
  percentageChange,
  previousMonth
} from '../lib/month-comparison';

test('previous month crosses the year boundary', () => {
  assert.deepEqual(previousMonth({year: 2026, month: 1}), {year: 2025, month: 12});
  assert.deepEqual(previousMonth({year: 2026, month: 7}), {year: 2026, month: 6});
});

test('comparison periods support previous year and a validated custom month', () => {
  assert.deepEqual(comparisonPeriod({year: 2026, month: 7}, 'year'), {year: 2025, month: 7});
  assert.deepEqual(comparisonPeriod({year: 2026, month: 7}, 'custom', '2024-02'), {year: 2024, month: 2});
  assert.deepEqual(parseMonthValue('2024-13'), null);
});

test('percentage change is unavailable with a zero comparison value', () => {
  assert.equal(percentageChange(100, 0), null);
  assert.equal(percentageChange(120, 100), 20);
  assert.equal(percentageChange(80, 100), -20);
});
