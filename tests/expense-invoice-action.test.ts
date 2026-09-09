import assert from 'node:assert/strict';
import test from 'node:test';
import {canMarkExpenseInvoiceEmitted} from '../lib/expense-invoice';

test('la fattura può essere completata da attesa, parziale e contestazione', () => {
  for (const invoiceStatus of ['IN_ATTESA', 'PARZIALE', 'CONTESTAZIONE']) {
    assert.equal(canMarkExpenseInvoiceEmitted({expenseType: 'STANDARD', isDeclared: true, invoiceStatus}), true);
  }
});

test('non offre la modifica per fatture già emesse, non previste o stati sconosciuti', () => {
  for (const invoiceStatus of ['RICEVUTA', 'INVIATA_SDI', 'NON_PREVISTA', 'UNKNOWN']) {
    assert.equal(canMarkExpenseInvoiceEmitted({expenseType: 'STANDARD', isDeclared: true, invoiceStatus}), false);
  }
});

test('esclude spese non dichiarate e tipologie senza fattura anche con stato incoerente', () => {
  assert.equal(canMarkExpenseInvoiceEmitted({expenseType: 'STANDARD', isDeclared: false, invoiceStatus: 'IN_ATTESA'}), false);
  for (const expenseType of ['VAT_SETTLEMENT', 'TAX_CONTRIBUTION', 'PAYROLL', 'COUNTER']) {
    assert.equal(canMarkExpenseInvoiceEmitted({expenseType, isDeclared: true, invoiceStatus: 'IN_ATTESA'}), false);
  }
});
