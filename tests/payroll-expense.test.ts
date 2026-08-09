import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveExpenseAmounts} from '../lib/payroll-expense';

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
