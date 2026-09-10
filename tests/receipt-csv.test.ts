import assert from 'node:assert/strict';
import test from 'node:test';
import {exportReceiptCsv, parseReceiptCsv, receiptImportKey, receiptOrigin, type ReceiptCsvRow} from '../lib/receipt-csv';

export const sample: ReceiptCsvRow = {origin: 'shop-1', date: '2026-10-25T01:30:00.000Z', description: 'Vendita; "speciale"\nSeconda riga', amount: '12.50', fiscal: true, vat: '0', channelCode: 'SHOP', channel: 'Negozio', method: 'Contanti', bank: 'Cassa', period: '2026-10', notes: "'=nota letterale"};

test('receipt CSV round-trip preserves text, cents, zero VAT, timestamp and origin', () => {
  for (const description of [sample.description, '=SUM(1;2)', "'=test", "''test", '+test', '@test', '\ttext']) {
    const row = {...sample, description};
    const exported = exportReceiptCsv([row]);
    const parsed = parseReceiptCsv(exported);
    assert.deepEqual(parsed[0].row, row);
    assert.ok(exported.startsWith('\uFEFF'));
  }
});

test('receipt CSV preserves both instants during the repeated DST hour', () => {
  const rows = parseReceiptCsv(exportReceiptCsv([{...sample, date: '2026-10-25T02:30:00+02:00'}, {...sample, origin: 'shop-2', date: '2026-10-25T02:30:00+01:00'}]));
  assert.equal(rows[0].row?.date, '2026-10-25T00:30:00.000Z');
  assert.equal(rows[1].row?.date, '2026-10-25T01:30:00.000Z');
});

test('receipt CSV refuses ambiguous dates, precision loss and invalid fiscal values', () => {
  for (const change of [{date: '2026-09-10'}, {date: '2026-02-30T12:00:00Z'}, {date: '2026-09-10T24:00:00Z'}, {amount: '1.234'}, {amount: '-1'}, {vat: '3'}, {fiscal: false, vat: '22'}, {origin: ''}, {bank: ''}]) {
    assert.ok(parseReceiptCsv(exportReceiptCsv([{...sample, ...change}]))[0].error, JSON.stringify(change));
  }
  assert.throws(() => parseReceiptCsv('ID;Importo\n1;12'), /Colonne/);
  assert.throws(() => parseReceiptCsv(exportReceiptCsv([sample]) + '"unterminated'), /non chiuso/);
});

test('import identity is company scoped and does not change on re-export', () => {
  const key = receiptImportKey(3, sample.origin);
  assert.notEqual(key, receiptImportKey(4, sample.origin));
  assert.equal(receiptOrigin({id: 123, workspaceId: 1, companyId: 3, cashRegisterRequestId: key}), sample.origin);
  assert.equal(receiptOrigin({id: 123, workspaceId: 1, companyId: 3, cashRegisterRequestId: 'abc'}), 'request:abc');
});
