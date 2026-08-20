import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarDayNumber,
  dateInputInTimeZone,
  isValidTimeZone,
  lastCompletedMonthInTimeZone,
  normalizeTimeZone,
  zonedMidnightUtc,
} from '../lib/company-time';
import {incomeCreditState} from '../lib/income-status';

test('Europe/Rome is the fallback and invalid time zones are rejected', () => {
  assert.equal(normalizeTimeZone(), 'Europe/Rome');
  assert.equal(normalizeTimeZone('Not/AZone'), 'Europe/Rome');
  assert.equal(isValidTimeZone('America/New_York'), true);
  assert.equal(isValidTimeZone('Not/AZone'), false);
});

test('the same instant uses the company calendar day', () => {
  const instant = new Date('2026-08-02T22:30:00.000Z');
  assert.equal(dateInputInTimeZone('Europe/Rome', instant), '2026-08-03');
  assert.equal(dateInputInTimeZone('America/New_York', instant), '2026-08-02');
});

test('the report defaults to the last fully completed company month', () => {
  assert.deepEqual(lastCompletedMonthInTimeZone('Europe/Rome', new Date('2026-08-20T10:00:00Z')), {year: 2026, month: 7});
  assert.deepEqual(lastCompletedMonthInTimeZone('Europe/Rome', new Date('2026-01-15T10:00:00Z')), {year: 2025, month: 12});
  assert.deepEqual(lastCompletedMonthInTimeZone('Pacific/Kiritimati', new Date('2026-08-31T10:30:00Z')), {year: 2026, month: 8});
});

test('company midnight respects both Rome daylight-saving transitions', () => {
  assert.equal(zonedMidnightUtc('2026-03-29', 'Europe/Rome').toISOString(), '2026-03-28T23:00:00.000Z');
  assert.equal(zonedMidnightUtc('2026-10-25', 'Europe/Rome').toISOString(), '2026-10-24T22:00:00.000Z');
});

test('overdue status changes at midnight in the company time zone', () => {
  const instant = new Date('2026-08-02T22:30:00.000Z');
  const income = {amount: 100, credits: [], dueDate: '2026-08-02'};
  assert.equal(incomeCreditState(income, instant, 'Europe/Rome'), 'SCADUTO');
  assert.equal(incomeCreditState(income, instant, 'America/New_York'), 'DA_ACCREDITARE');
  assert.equal(calendarDayNumber('2026-08-02', 'Europe/Rome', true), Date.UTC(2026, 7, 2) / 86_400_000);
});
