import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRecurringExpenseDueDates,
  recurringExpenseGenerationDate
} from '../lib/recurring-expenses-job';

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

test('calcola tutte le date di generazione rispetto alla scadenza', () => {
  const dueDate = new Date('2026-03-05T00:00:00.000Z');
  assert.equal(isoDate(recurringExpenseGenerationDate(dueDate, 'FIRST_OF_MONTH')), '2026-03-01');
  assert.equal(isoDate(recurringExpenseGenerationDate(dueDate, 'DAYS_7_BEFORE')), '2026-02-26');
  assert.equal(isoDate(recurringExpenseGenerationDate(dueDate, 'DAYS_10_BEFORE')), '2026-02-23');
  assert.equal(isoDate(recurringExpenseGenerationDate(dueDate, 'DAYS_15_BEFORE')), '2026-02-18');
  assert.equal(isoDate(recurringExpenseGenerationDate(dueDate, 'DAYS_30_BEFORE')), '2026-02-03');
  assert.equal(isoDate(recurringExpenseGenerationDate(dueDate, 'ON_DUE_DATE')), '2026-03-05');
  assert.equal(isoDate(recurringExpenseGenerationDate(new Date('2027-01-05T00:00:00.000Z'), 'DAYS_30_BEFORE')), '2026-12-06');
  assert.equal(isoDate(recurringExpenseGenerationDate(new Date('2028-03-01T00:00:00.000Z'), 'DAYS_7_BEFORE')), '2028-02-23');
});

test('il primo del mese rende generabile una scadenza futura dello stesso mese', () => {
  const dueDates = calculateRecurringExpenseDueDates({
    startDate: new Date('2026-03-20T00:00:00.000Z'),
    endDate: null,
    cadence: 'MONTHLY',
    dueDay: 20,
    dueMonth: null,
    generationTiming: 'FIRST_OF_MONTH'
  }, new Date('2026-03-01T00:00:00.000Z'));

  assert.deepEqual(dueDates.map(isoDate), ['2026-03-20']);
});

test('non genera prima dell’anticipo configurato e genera al raggiungimento della soglia', () => {
  const recurringExpense = {
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: null,
    cadence: 'MONTHLY',
    dueDay: 5,
    dueMonth: null,
    generationTiming: 'DAYS_30_BEFORE'
  };

  assert.deepEqual(calculateRecurringExpenseDueDates(recurringExpense, new Date('2026-01-05T00:00:00.000Z')).map(isoDate), ['2026-01-05']);
  assert.deepEqual(calculateRecurringExpenseDueDates(recurringExpense, new Date('2026-01-06T00:00:00.000Z')).map(isoDate), ['2026-01-05', '2026-02-05']);
});

test('data iniziale e data finale limitano le scadenze, non la data di generazione', () => {
  const dueDates = calculateRecurringExpenseDueDates({
    startDate: new Date('2026-02-15T00:00:00.000Z'),
    endDate: new Date('2026-03-20T00:00:00.000Z'),
    cadence: 'MONTHLY',
    dueDay: 20,
    dueMonth: null,
    generationTiming: 'DAYS_30_BEFORE'
  }, new Date('2026-02-18T00:00:00.000Z'));

  assert.deepEqual(dueDates.map(isoDate), ['2026-02-20', '2026-03-20']);
});
