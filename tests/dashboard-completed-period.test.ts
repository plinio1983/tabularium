import test from 'node:test';
import assert from 'node:assert/strict';
import {completedMonthCountForYear} from '../lib/reports';

const august = new Date('2026-08-09T10:00:00Z');

test('dashboard consolidates the current year through the last completed month', () => {
  assert.equal(completedMonthCountForYear(2026, august, 'Europe/Rome'), 7);
});

test('dashboard includes all months for past years and none for future years', () => {
  assert.equal(completedMonthCountForYear(2025, august, 'Europe/Rome'), 12);
  assert.equal(completedMonthCountForYear(2027, august, 'Europe/Rome'), 0);
});

test('dashboard has no completed month in January of the current year', () => {
  assert.equal(completedMonthCountForYear(2026, new Date('2026-01-15T10:00:00Z'), 'Europe/Rome'), 0);
});
