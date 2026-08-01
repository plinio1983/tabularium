import test from 'node:test';
import assert from 'node:assert/strict';
import {incomeCreditSummary, parseIncomeCredits, validateIncomeCredits} from '../lib/income-credits';

test('parses multiple credits from form rows', () => {
  const form = new FormData();
  for (const value of ['1', '']) form.append('creditId[]', value);
  for (const value of ['2026-07-10', '2026-07-20']) form.append('creditDate[]', value);
  for (const value of ['600', '400']) form.append('creditAmount[]', value);
  for (const value of ['2', '3']) form.append('creditPaymentMethodId[]', value);
  for (const value of ['4', '5']) form.append('creditBankId[]', value);

  assert.deepEqual(parseIncomeCredits(form, null), [
    {id: 1, creditDate: '2026-07-10', amount: 600, paymentMethodId: 2, bankId: 4},
    {id: undefined, creditDate: '2026-07-20', amount: 400, paymentMethodId: 3, bankId: 5},
  ]);
});

test('derives partial and completed credit states from totals', () => {
  const partial = incomeCreditSummary({amount: 1000, credits: [{amount: 250}, {amount: 350}]});
  assert.deepEqual(partial, {amount: 1000, credited: 600, residual: 400, isCredited: false, isPartiallyCredited: true});

  const completed = validateIncomeCredits([
    {creditDate: '2026-07-10', amount: 600, paymentMethodId: 2, bankId: 4},
    {creditDate: '2026-07-20', amount: 400, paymentMethodId: 3, bankId: 5},
  ], 1000);
  assert.deepEqual(completed, {total: 1000, residual: 0, isCredited: true});
});

test('rejects incomplete or excessive credits', () => {
  assert.throws(() => validateIncomeCredits([
    {creditDate: '', amount: 100, paymentMethodId: 2, bankId: 4},
  ], 1000), /Completa tutti i campi/);
  assert.throws(() => validateIncomeCredits([
    {creditDate: '2026-07-10', amount: 1001, paymentMethodId: 2, bankId: 4},
  ], 1000), /non può superare/);
});
