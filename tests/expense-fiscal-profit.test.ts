import assert from 'node:assert/strict';
import test from 'node:test';
import {expenseAffectsFiscalProfit} from '../lib/reports';

test('classifica correttamente le spese che incidono sull’utile fiscale', () => {
  assert.equal(expenseAffectsFiscalProfit({expenseType: 'STANDARD', isDeclared: true}), true);
  assert.equal(expenseAffectsFiscalProfit({expenseType: 'TAX_CONTRIBUTION', isDeclared: false, affectsFiscalProfit: true}), true);
  assert.equal(expenseAffectsFiscalProfit({expenseType: 'TAX_CONTRIBUTION', isDeclared: false, affectsFiscalProfit: false}), false);
  assert.equal(expenseAffectsFiscalProfit({expenseType: 'VAT_SETTLEMENT', isDeclared: true, affectsFiscalProfit: true}), false);
});
