import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateIncomeChannelTrend, buildIncomeChannelComparisonSeries, incomeChannelComparisonDomain, leadingIncomeChannelIds} from '../lib/income-channel-trend';

test('aggregates monthly income totals and sales channels', () => {
  const data = aggregateIncomeChannelTrend([
    {amount: 100, creditDate: new Date('2026-01-10T12:00:00Z'), salesChannelId: 1, salesChannelRef: {name: 'Online'}},
    {amount: 50, creditDate: new Date('2026-01-11T12:00:00Z'), salesChannelId: 2, salesChannelRef: {name: 'Negozio'}},
    {amount: 200, creditDate: new Date('2026-04-01T12:00:00Z'), salesChannelId: 1, salesChannelRef: {name: 'Online'}},
  ], 2026, 'Europe/Rome');
  assert.equal(data.total, 350);
  assert.equal(data.count, 3);
  assert.equal(data.months[0].total, 150);
  assert.equal(data.months[0].channels.length, 2);
  assert.equal(data.months[3].total, 200);
  assert.equal(data.channels[0].name, 'Online');
  assert.equal(data.channels[0].total, 300);
  assert.equal(data.quarters[0].weeks.reduce((sum, week) => sum + week.total, 0), 150);
  assert.equal(data.quarters[1].weeks.reduce((sum, week) => sum + week.total, 0), 200);
  assert.ok(data.quarters.every(quarter => quarter.weeks.length >= 13));
});

test('fills empty months and excludes records outside the selected year', () => {
  const data = aggregateIncomeChannelTrend([
    {amount: 99, creditDate: new Date('2025-12-31T12:00:00Z'), salesChannelId: 1, salesChannelRef: {name: 'Online'}},
  ], 2026, 'Europe/Rome');
  assert.equal(data.months.length, 12);
  assert.equal(data.total, 0);
  assert.ok(data.months.every(month => month.total === 0));
});

test('builds index-100 channel comparison series from the first positive bucket', () => {
  const data = aggregateIncomeChannelTrend([
    {amount: 100, creditDate: new Date('2026-02-10T12:00:00Z'), salesChannelId: 1, salesChannelRef: {name: 'Online'}},
    {amount: 150, creditDate: new Date('2026-03-10T12:00:00Z'), salesChannelId: 1, salesChannelRef: {name: 'Online'}},
    {amount: 200, creditDate: new Date('2026-01-10T12:00:00Z'), salesChannelId: 2, salesChannelRef: {name: 'Negozio'}},
  ], 2026, 'Europe/Rome');
  const series = buildIncomeChannelComparisonSeries(data.months, data.channels);
  const online = series.find(channel => channel.name === 'Online');
  assert.equal(online?.points[0].indexValue, null);
  assert.equal(online?.points[1].indexValue, 100);
  assert.equal(online?.points[2].indexValue, 150);
  assert.equal(online?.points[2].previousChange, 50);
  assert.equal(online?.points[3].indexValue, 0);
  assert.deepEqual(leadingIncomeChannelIds(series, 1), [1]);
});

test('creates a stable comparison domain for empty and constant values', () => {
  assert.deepEqual(incomeChannelComparisonDomain([]), {min: 0, max: 1});
  const domain = incomeChannelComparisonDomain([100, 100], 100);
  assert.ok(domain.min < 100);
  assert.ok(domain.max > 100);
});
