import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveReceiptPeriod, receiptPeriodParams} from '../lib/receipt-period';
import {quickPeriodTarget} from '../lib/period-selector';
import {addCalendarDays, zonedMidnightUtc} from '../lib/company-time';
import {buildDailyReceiptTrendRange, buildMonthlyReceiptTrend} from '../lib/cash-register-trend';

test('default includes exactly 90 days across the year boundary', () => {
  const period = resolveReceiptPeriod({}, '2026-01-15');
  assert.equal(period.quick, 'last_90_days');
  assert.equal(period.to, '2026-01-15');
  assert.equal(buildDailyReceiptTrendRange(period.from, period.to, []).length, 90);
  assert.equal(resolveReceiptPeriod({dateQuick: 'last_30_days', dateYear: '2020'}, '2026-01-15').from, '2025-12-17');
});

test('months support leap years and quarters span their complete calendar range', () => {
  assert.deepEqual(resolveReceiptPeriod({dateQuick: 'month_02', dateYear: '2024'}, '2026-09-10'), {
    from: '2024-02-01', to: '2024-02-29', quick: 'month_02', year: 2024, annual: false,
  });
  const target = quickPeriodTarget('previous_quarter', new Date(2026, 0, 15));
  assert.deepEqual(target, {value: 'quarter_4', year: '2025'});
  const period = resolveReceiptPeriod({dateQuick: target.value, dateYear: target.year}, '2026-01-15');
  assert.equal(period.from, '2025-10-01');
  assert.equal(period.to, '2025-12-31');
});

test('legacy month and annual URLs retain the requested period', () => {
  assert.equal(resolveReceiptPeriod({month: '2024-02'}, '2026-09-10').to, '2024-02-29');
  const period = resolveReceiptPeriod({month: '2024-02', period: 'year'}, '2026-09-10');
  assert.equal(period.from, '2024-01-01');
  assert.equal(period.to, '2024-12-31');
  assert.equal(period.annual, true);
  assert.equal(buildMonthlyReceiptTrend(period.year, []).length, 12);
});

test('custom intervals normalize inverted dates and single endpoints', () => {
  const period = resolveReceiptPeriod({dateFrom: '2026-09-10', dateTo: '2026-09-01'}, '2026-09-10');
  assert.equal(period.quick, 'custom');
  assert.equal(period.from, '2026-09-01');
  assert.equal(period.to, '2026-09-10');
  const single = resolveReceiptPeriod({dateTo: '2026-03-29'}, '2026-09-10');
  assert.equal(single.from, single.to);
  const start = zonedMidnightUtc(single.from, 'Europe/Rome');
  const end = zonedMidnightUtc(addCalendarDays(single.to, 1), 'Europe/Rome');
  assert.equal(end.getTime() - start.getTime(), 23 * 60 * 60 * 1000);
});

test('invalid dates and unknown selectors fall back without throwing', () => {
  for (const params of [{dateQuick: 'invalid'}, {dateQuick: 'custom'}, {dateFrom: '2026-02-30'}, {month: '2026-13'}]) {
    assert.equal(resolveReceiptPeriod(params, '2026-09-10').quick, 'last_90_days');
  }
});

test('changing period preserves search and receipt filters, clearing stale dates and notices', () => {
  const params = receiptPeriodParams('search=caff%C3%A8&paymentMethodId=2&salesChannelId=3&fiscal=no&month=2024-02&period=year&dateFrom=2024-01-01&dateTo=2024-12-31&saved=1&page=2&new=1', 'quarter_3', '2026');
  assert.deepEqual(Object.fromEntries(params), {
    search: 'caffè', paymentMethodId: '2', salesChannelId: '3', fiscal: 'no', dateQuick: 'quarter_3', dateYear: '2026',
  });
});
