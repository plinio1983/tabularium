import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateIncomeTrend} from '../lib/income-trend';

test('aggregates credited income records by month and fills empty periods', () => {
  const result = aggregateIncomeTrend([
    {amount: 100, creditDate: new Date(2026, 0, 10)},
    {amount: 250, creditDate: new Date(2026, 0, 20)},
    {amount: 50, creditDate: new Date(2026, 2, 1)}
  ], 2026, 'month');
  assert.equal(result.points.length, 12);
  assert.deepEqual(result.points.slice(0, 3).map(point => point.value), [350, 0, 50]);
  assert.equal(result.total, 400);
  assert.equal(result.count, 3);
  assert.equal(result.points[2].cumulative, 400);
});

test('uses Monday to Sunday buckets and clips the first week to the year', () => {
  const result = aggregateIncomeTrend([
    {amount: 100, creditDate: new Date(2026, 0, 1)},
    {amount: 200, creditDate: new Date(2026, 0, 4)},
    {amount: 300, creditDate: new Date(2026, 0, 5)}
  ], 2026, 'week');
  assert.equal(result.points[0].from, '2026-01-01');
  assert.equal(result.points[0].to, '2026-01-04');
  assert.equal(result.points[0].value, 300);
  assert.equal(result.points[1].from, '2026-01-05');
  assert.equal(result.points[1].value, 300);
});

test('creates one point for every day of a leap year', () => {
  const result = aggregateIncomeTrend([], 2028, 'day');
  assert.equal(result.points.length, 366);
  assert.equal(result.points[59].from, '2028-02-29');
});

test('limits the series to completed months when a month cutoff is provided', () => {
  const result = aggregateIncomeTrend([
    {amount: 100, creditDate: new Date(2026, 5, 10)},
    {amount: 200, creditDate: new Date(2026, 6, 10)},
    {amount: 300, creditDate: new Date(2026, 7, 10)}
  ], 2026, 'month', 7);
  assert.equal(result.points.length, 7);
  assert.equal(result.total, 300);
  assert.equal(result.points.at(-1)?.label, 'Lug');
});
