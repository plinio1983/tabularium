import assert from 'node:assert/strict';
import test from 'node:test';
import {recurrenceDates, recurrenceDateInput} from '../lib/recurrence-schedule';
import {calculateRecurringExpenseDueDates} from '../lib/recurring-expenses-job';
import {parseRecurringExpenseBulkEdit} from '../lib/recurring-expense-bulk-edit';
import {parseRecurringIncomeBulkEdit} from '../lib/recurring-income-bulk-edit';
import {bulkScheduleChanges} from '../lib/recurring-schedule-change';
import {isRecurringDateSuspended} from '../lib/recurring-suspensions';
import {weekdayLabel} from '../lib/recurring-cadence';

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const local = (day: string) => new Date(`${day}T00:00:00`);

test('il giorno scelto parte dalla prima data utile e include la fine, anche tra anni', () => {
  for (const [day, expected] of [[1, ['2026-12-28', '2027-01-04', '2027-01-11']],
    [7, ['2026-12-27', '2027-01-03', '2027-01-10']]] as const) {
    assert.deepEqual(recurrenceDates({cadence: 'WEEKLY', day, startDate: '2026-12-27', endDate: '2027-01-11'}, local('2027-02-01')).map(recurrenceDateInput), expected);
    assert.deepEqual(calculateRecurringExpenseDueDates({cadence: 'WEEKLY', dueDay: day, startDate: utc('2026-12-27'), endDate: utc('2027-01-11'), generationTiming: 'ON_DUE_DATE'}, utc('2027-02-01')).map(date => date.toISOString().slice(0, 10)), expected);
  }
});

test('tutte le settimane del mese sono generate, inclusi cambi ora e sospensioni', () => {
  const dates = recurrenceDates({cadence: 'WEEKLY', day: 7, startDate: '2026-03-01'}, local('2026-04-05')).map(recurrenceDateInput);
  assert.deepEqual(dates, ['2026-03-01', '2026-03-08', '2026-03-15', '2026-03-22', '2026-03-29', '2026-04-05']);
  assert.deepEqual(dates.filter(date => !isRecurringDateSuspended(date, [{from: '2026-03-08', to: '2026-03-29'}])), ['2026-03-01', '2026-03-29', '2026-04-05']);
  assert.equal(weekdayLabel(7), 'Domenica');
});

test('anticipo settimanale: primo del mese e sette giorni prima mantengono scadenze distinte', () => {
  const definition = {cadence: 'WEEKLY', dueDay: 1, startDate: utc('2026-06-01')};
  const dates = (timing: string) => calculateRecurringExpenseDueDates({...definition, generationTiming: timing}, utc('2026-06-01')).map(date => date.toISOString().slice(0, 10));
  assert.deepEqual(dates('ON_DUE_DATE'), ['2026-06-01']);
  assert.deepEqual(dates('DAYS_7_BEFORE'), ['2026-06-01', '2026-06-08']);
  assert.deepEqual(dates('FIRST_OF_MONTH'), ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29']);
});

test('modifica multipla richiede un giorno settimanale valido e pulisce il mese', () => {
  const form = (day: string) => {
    const data = new FormData();
    Object.entries({field: 'schedule', updateCadence: 'on', cadence: 'WEEKLY', weeklyDay: day}).forEach(([key, value]) => data.set(key, value));
    return data;
  };
  assert.deepEqual(parseRecurringExpenseBulkEdit(form('7')), {cadence: 'WEEKLY', dueDay: 7, dueMonth: null});
  assert.deepEqual(parseRecurringIncomeBulkEdit(form('1')), {cadence: 'WEEKLY', creditDay: 1, creditMonth: null});
  for (const day of ['', '0', '8', '1.5']) {
    assert.throws(() => parseRecurringExpenseBulkEdit(form(day)));
    assert.throws(() => parseRecurringIncomeBulkEdit(form(day)));
  }
});

test('cambio cadenza settimanale non recupera lo storico e non interpreta un giorno del mese come weekday', () => {
  const existing = {cadence: 'MONTHLY', dueDay: 28, startDate: utc('2026-01-01')};
  assert.throws(() => bulkScheduleChanges(existing, {cadence: 'WEEKLY', dueDay: 1}, 'expense', '2026-09-28'));
  assert.deepEqual(bulkScheduleChanges(existing, {cadence: 'WEEKLY', dueDay: 1, startDate: utc('2026-09-28')}, 'expense', '2026-09-28'),
    {cadence: 'WEEKLY', dueDay: 1, startDate: utc('2026-09-28'), dueMonth: null});
  assert.throws(() => bulkScheduleChanges({...existing, cadence: 'WEEKLY', dueDay: 1}, {dueDay: 20}, 'expense', '2026-09-28'));
  assert.deepEqual(bulkScheduleChanges({...existing, cadence: 'WEEKLY', dueDay: 7}, {cadence: 'MONTHLY', startDate: utc('2026-09-28')}, 'expense', '2026-09-28'),
    {cadence: 'MONTHLY', startDate: utc('2026-09-28'), dueDay: 1, dueMonth: null});
});
