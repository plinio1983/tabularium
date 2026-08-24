import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveExpenseAmounts, resolvePayrollPeriod} from '../lib/payroll-expense';

test('il totale della busta paga include netto e compensi extra', () => {
  assert.deepEqual(resolveExpenseAmounts({isPayroll: true, amount: 9999, payrollNetAmount: 1500, payrollExtraCompensation: 250}), {
    amount: 1750,
    payrollNetAmount: 1500,
    payrollExtraCompensation: 250,
  });
});

test('gli importi informativi non alterano una spesa ordinaria', () => {
  assert.deepEqual(resolveExpenseAmounts({isPayroll: false, amount: 120}), {
    amount: 120,
    payrollNetAmount: null,
    payrollExtraCompensation: null,
  });
});

test('una busta paga richiede un netto positivo', () => {
  assert.throws(() => resolveExpenseAmounts({isPayroll: true, amount: 0, payrollNetAmount: 0}), /netto maggiore di zero/);
});

test('il periodo lavorato accetta anche una settimana', () => {
  const result = resolvePayrollPeriod({
    isPayroll: true,
    start: '2026-07-06',
    end: '2026-07-12',
    dueDate: '2026-08-10',
  });
  assert.equal(result.payrollPeriodStart?.toISOString(), '2026-07-06T00:00:00.000Z');
  assert.equal(result.payrollPeriodEnd?.toISOString(), '2026-07-12T00:00:00.000Z');
});

test('il periodo lavorato non può essere invertito', () => {
  assert.throws(() => resolvePayrollPeriod({
    isPayroll: true,
    start: '2026-07-12',
    end: '2026-07-06',
    dueDate: '2026-08-10',
  }), /data iniziale/);
});

test('la busta paga richiede una scadenza', () => {
  assert.throws(() => resolvePayrollPeriod({
    isPayroll: true,
    start: '2026-07-01',
    end: '2026-07-31',
  }), /data di scadenza/);
});
