import assert from 'node:assert/strict';
import test from 'node:test';
import {matchesExpenseQuickSearch, matchesExpenseType} from '../lib/expense-list-filters';

const types = ['STANDARD', 'VAT_SETTLEMENT', 'COUNTER', 'TAX_CONTRIBUTION', 'PAYROLL'];

test('senza filtro tipo tutte le tipologie sono visibili', () => {
  for (const expenseType of types) {
    assert.equal(matchesExpenseType({expenseType, isRecurring: false}, ''), true, expenseType);
  }
});

test('il filtro ricorrenti include buste paga e imposte ricorrenti', () => {
  for (const expenseType of ['STANDARD', 'TAX_CONTRIBUTION', 'PAYROLL']) {
    assert.equal(matchesExpenseType({expenseType, isRecurring: true}, 'recurring'), true, expenseType);
    assert.equal(matchesExpenseType({expenseType, isRecurring: false}, 'recurring'), false, expenseType);
  }
});

test('ogni filtro specifico seleziona solo il tipo richiesto', () => {
  for (const [filter, expected] of Object.entries({single: 'STANDARD', vat_settlement: 'VAT_SETTLEMENT', counter: 'COUNTER', tax_contribution: 'TAX_CONTRIBUTION', payroll: 'PAYROLL'})) {
    for (const expenseType of types) {
      assert.equal(matchesExpenseType({expenseType, isRecurring: false}, filter), expenseType === expected);
    }
  }
  assert.equal(matchesExpenseType({expenseType: 'STANDARD', isRecurring: true}, 'single'), false);
});

test('la ricerca trova dipendente, ente ed esercente anche senza fornitore', () => {
  for (const expenseType of ['PAYROLL', 'TAX_CONTRIBUTION', 'COUNTER']) {
    const expense = {expenseType, isRecurring: false, supplier: null, merchant: 'Mario Rossi', description: 'Agosto'};
    assert.equal(matchesExpenseQuickSearch(expense, 'rossi'), true, expenseType);
    assert.equal(matchesExpenseQuickSearch(expense, 'agosto'), true, expenseType);
    assert.equal(matchesExpenseQuickSearch(expense, 'inesistente'), false, expenseType);
    assert.equal(matchesExpenseQuickSearch(expense, ''), true, expenseType);
  }
});

test('la ricerca continua a trovare il fornitore delle spese standard', () => {
  assert.equal(matchesExpenseQuickSearch({expenseType: 'STANDARD', isRecurring: false, supplier: {businessName: 'ACME'}, merchant: null}, 'acme'), true);
});
