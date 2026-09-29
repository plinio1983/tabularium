import assert from 'node:assert/strict';
import test from 'node:test';
import {matchesExpenseMerchantSearch, matchesExpenseQuickSearch, matchesExpenseType} from '../lib/expense-list-filters';

const types = ['STANDARD', 'VAT_SETTLEMENT', 'COUNTER', 'TAX_CONTRIBUTION', 'PAYROLL'];

test('la ricerca trova il nome aggiornato dell’ente', () => {
  assert.equal(matchesExpenseQuickSearch({expenseType: 'TAX_CONTRIBUTION', isRecurring: false,
    merchant: 'Vecchio nome', taxAuthority: {name: 'Ente rinominato'}}, 'rinominato'), true);
});

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

test('il filtro esercente trova il dipendente aggiornato in entrambi gli ordini del nome', () => {
  const expense = {expenseType: 'PAYROLL', isRecurring: false, merchant: 'Vecchio nominativo',
    employee: {firstName: 'Mario', lastName: 'Rossi'}, description: 'Premio produzione'};
  for (const query of ['Rossi Mario', 'Mario Rossi', 'rossi', 'Vecchio nominativo', '']) {
    assert.equal(matchesExpenseMerchantSearch(expense, query), true, query);
  }
  assert.equal(matchesExpenseMerchantSearch(expense, 'Bianchi'), false);
  assert.equal(matchesExpenseMerchantSearch(expense, 'produzione'), false);
});

test('il filtro esercente mantiene la ricerca per fornitore ed ente', () => {
  assert.equal(matchesExpenseMerchantSearch({expenseType: 'STANDARD', isRecurring: false,
    supplier: {businessName: 'ACME'}, merchant: 'Storico'}, 'acme'), true);
  assert.equal(matchesExpenseMerchantSearch({expenseType: 'TAX_CONTRIBUTION', isRecurring: false,
    taxAuthority: {name: 'Agenzia entrate'}, merchant: 'Storico'}, 'entrate'), true);
});
