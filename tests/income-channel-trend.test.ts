import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateIncomeChannelTrend} from '../lib/income-channel-trend';

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
