import assert from 'node:assert/strict';
import test from 'node:test';
import {expenseAffectsFiscalAccounting, expenseAffectsFiscalProfit} from '../lib/reports';

test('classifica correttamente le spese che incidono sull’utile fiscale', () => {
  assert.equal(expenseAffectsFiscalProfit({expenseType: 'STANDARD', isDeclared: true}), true);
  assert.equal(expenseAffectsFiscalProfit({expenseType: 'TAX_CONTRIBUTION', isDeclared: false, affectsFiscalProfit: true}), true);
  assert.equal(expenseAffectsFiscalProfit({expenseType: 'TAX_CONTRIBUTION', isDeclared: false, affectsFiscalProfit: false}), false);
  assert.equal(expenseAffectsFiscalProfit({expenseType: 'VAT_SETTLEMENT', isDeclared: true, affectsFiscalProfit: true}), false);
  assert.equal(expenseAffectsFiscalProfit({expenseType: 'PAYROLL', isDeclared: false, affectsFiscalProfit: true}), true);
});

test('classifica le spese che incidono sulla contabilità fiscale', () => {
  assert.equal(expenseAffectsFiscalAccounting({expenseType: 'STANDARD', isDeclared: true}), true);
  assert.equal(expenseAffectsFiscalAccounting({expenseType: 'STANDARD', isDeclared: false}), false);
  assert.equal(expenseAffectsFiscalAccounting({expenseType: 'TAX_CONTRIBUTION', affectsFiscalProfit: true}), true);
  assert.equal(expenseAffectsFiscalAccounting({expenseType: 'TAX_CONTRIBUTION', affectsFiscalProfit: false}), false);
  assert.equal(expenseAffectsFiscalAccounting({expenseType: 'PAYROLL', affectsFiscalProfit: true}), true);
  assert.equal(expenseAffectsFiscalAccounting({expenseType: 'VAT_SETTLEMENT', isDeclared: false, affectsFiscalProfit: false}), true);
});
