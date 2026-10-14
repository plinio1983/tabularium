import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptLineSummary, existingReceiptLines, incomeFiscalAmount, incomeVatAmount} from '../lib/cash-register-lines';
import {exportReceiptCsv, parseReceiptCsv} from '../lib/receipt-csv';

test('multiple receipt lines sum in cents and compute tax separately per rate', () => {
  const lines = [{amount: 12.20, isFiscal: true, vatRate: 22}, {amount: 11, isFiscal: true, vatRate: 10}, {amount: 5, isFiscal: false, vatRate: 0}];
  const summary = receiptLineSummary(lines);
  assert.equal(summary.amount, 28.2);
  assert.equal(summary.receiptFiscalAmount, 23.2);
  assert.equal(summary.receiptVatAmount, 3.2);
  assert.equal(summary.net, 25);
  assert.equal(summary.hasNonFiscal, true);
  assert.equal(summary.mixed, true);
  const stored = {...summary, incomeType: 'CASH_REGISTER'};
  assert.equal(incomeFiscalAmount(stored), 23.2);
  assert.equal(incomeVatAmount(stored), 3.2);
  assert.equal(receiptLineSummary([{amount: 0.10, isFiscal: true, vatRate: 22}, {amount: 0.20, isFiscal: true, vatRate: 22}]).amount, 0.3);
});

test('zero VAT fiscal amounts differ from non-fiscal; old receipts retain their original values', () => {
  assert.equal(receiptLineSummary([{amount: 10, isFiscal: true, vatRate: 0}]).receiptFiscalAmount, 10);
  assert.equal(receiptLineSummary([{amount: 10, isFiscal: false, vatRate: 0}]).receiptFiscalAmount, 0);
  const old = {amount: '12.20', isFiscal: true, vatRate: '22'};
  assert.equal(existingReceiptLines(old).length, 1);
  assert.equal(Math.round(incomeVatAmount(old) * 100), 220);
  assert.equal(incomeFiscalAmount(old), 12.2);
  assert.equal(incomeFiscalAmount({...old, incomeType: 'STANDARD', receiptFiscalAmount: '1'}), 12.2);
});

test('invalid, overflowing and non-fiscal taxable lines are rejected', () => {
  for (const lines of [[], [{amount: 0, isFiscal: true, vatRate: 22}], [{amount: 1.001, isFiscal: true, vatRate: 22}], [{amount: 10, isFiscal: false, vatRate: 22}], [{amount: Infinity, isFiscal: true, vatRate: 22}], [{amount: 10, isFiscal: true, vatRate: 8}]]) assert.throws(() => receiptLineSummary(lines));
});

test('receipt CSV v2 round trips all lines and category and validates its total', () => {
  const lines = [{amount: 12.2, isFiscal: true, vatRate: 22}, {amount: 5, isFiscal: false, vatRate: 0}];
  const row = {origin: 'receipt-1', date: '2026-10-14T12:00:00Z', description: 'Vendita', amount: '17.20', fiscal: true, vat: '22', channelCode: 'GOODS', channel: 'Negozio', method: 'Cash', bank: 'Cassa', period: '2026-10', notes: '', lines, category: 'Vendite'};
  const csv = exportReceiptCsv([row]);
  const parsed = parseReceiptCsv(csv)[0];
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.row, {...row, date: new Date(row.date).toISOString()});
  assert.ok(parseReceiptCsv(exportReceiptCsv([{...row, amount: '18.20'}]))[0].error);
});
