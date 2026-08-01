import test from 'node:test';
import assert from 'node:assert/strict';
import { recurrenceBillingPeriod, recurrenceDates, recurrencePeriodKey } from '../lib/recurrence-schedule';

test('genera le scadenze mensili senza superare la data corrente', () => {
  const dates = recurrenceDates({ startDate: new Date(2026, 0, 31), cadence: 'MONTHLY', day: 31 }, new Date(2026, 2, 15));
  assert.deepEqual(dates.map(date => [date.getFullYear(), date.getMonth() + 1, date.getDate()]), [[2026,1,31],[2026,2,28]]);
});

test('rispetta cadenza e mese delle entrate annuali', () => {
  const dates = recurrenceDates({ startDate: new Date(2025, 6, 1), cadence: 'YEARLY', day: 15, month: 7 }, new Date(2027, 7, 1));
  assert.deepEqual(dates.map(date => [date.getFullYear(), date.getMonth() + 1, date.getDate()]), [[2025,7,15],[2026,7,15],[2027,7,15]]);
});

test('una ricorrenza annuale parte dall\'anno successivo se il mese è già trascorso', () => {
  const dates = recurrenceDates({ startDate: new Date(2026, 7, 20), cadence: 'YEARLY', day: 15, month: 7 }, new Date(2028, 7, 1));
  assert.deepEqual(dates.map(date => [date.getFullYear(), date.getMonth() + 1, date.getDate()]), [[2027,7,15],[2028,7,15]]);
});

test('calcola periodo successivo e chiave idempotente', () => {
  const period = recurrenceBillingPeriod({ startDate: new Date(), cadence: 'MONTHLY', billingPeriodMode: 'NEXT_MONTH' }, new Date(2026, 11, 10));
  assert.deepEqual(period, { year: 2027, month: 1 });
  assert.equal(recurrencePeriodKey(period.year, period.month), '2027-01');
});

test('include la ricorrenza nella data finale ed esclude quelle successive', () => {
  const dates = recurrenceDates({
    startDate: new Date(2026, 0, 15),
    endDate: new Date(2026, 2, 15),
    cadence: 'MONTHLY',
    day: 15
  }, new Date(2026, 5, 30));
  assert.deepEqual(dates.map(date => [date.getFullYear(), date.getMonth() + 1, date.getDate()]), [[2026,1,15],[2026,2,15],[2026,3,15]]);
});
