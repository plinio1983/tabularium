import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allocateBulkPayment, bulkPaymentRows} from '../lib/expense-bulk-payment';
const expense = (id: number, amount: number, paid = 0, extra = {}) => ({id, amount, expenseType: 'STANDARD', payments: [{amount: paid}], ...extra});
test('allocates residuals sequentially, preserving later unpaid expenses', () => {
  const rows = bulkPaymentRows([expense(1, 150, 50), expense(2, 200), expense(3, 80)]);
  assert.deepEqual(allocateBulkPayment(rows, 25000).map(r => r.allocatedCents), [10000, 15000, 0]);
});
test('skips settled expenses and covers exact total in cents', () => {
  const rows = bulkPaymentRows([expense(1, 10, 10), expense(2, 0.3, 0.1), expense(3, 10, 20)]);
  assert.deepEqual(allocateBulkPayment(rows, 20).map(r => r.allocatedCents), [0, 20, 0]);
  assert.throws(() => allocateBulkPayment(rows, 21));
  for (const value of [0, -1, NaN, 1.5]) assert.throws(() => allocateBulkPayment(rows, value));
});
test('orders by due date, received date, then id with missing dates last', () => {
  const rows = bulkPaymentRows([
    expense(1, 10), expense(4, 10, 0, {dueDate: '2026-01-01', receivedDate: '2025-12-01'}),
    expense(3, 10, 0, {dueDate: '2026-01-01', receivedDate: '2025-12-01'}),
    expense(2, 10, 0, {dueDate: '2025-01-01'}),
  ]);
  assert.deepEqual(rows.map(r => r.id), [2, 3, 4, 1]);
});
test('rejects mixed VAT settlements and expenses but allows homogeneous selections', () => {
  assert.throws(() => bulkPaymentRows([expense(1, 10), expense(2, 10, 0, {expenseType: 'VAT_SETTLEMENT'})]), /solo spese oppure solo saldi IVA/);
  assert.equal(bulkPaymentRows([expense(1, 10, 0, {expenseType: 'VAT_SETTLEMENT'}), expense(2, 10, 0, {expenseType: 'VAT_SETTLEMENT'})]).length, 2);
  assert.equal(bulkPaymentRows([expense(1, 10), expense(2, 10, 0, {expenseType: 'PAYROLL'})]).length, 2);
});
