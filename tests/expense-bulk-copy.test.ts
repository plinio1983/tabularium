import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addExpenseDays,
  expenseDateDayOffset,
  expenseDateInRelativeMonth,
} from '../lib/expense-bulk-copy';

function localDate(value: Date | null | undefined) {
  return value
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : null;
}

test('ricalcola ogni pagamento mantenendo la distanza dalla data ordine', () => {
  const originalOrder = new Date(2026, 0, 10);
  const originalPayment = new Date(2026, 1, 4);
  const copiedOrder = new Date(2026, 6, 29);
  const offset = expenseDateDayOffset(originalOrder, originalPayment);

  assert.equal(offset, 25);
  assert.equal(localDate(addExpenseDays(copiedOrder, offset!)), '2026-08-23');
});

test('mantiene giorno e distanza in mesi, limitando il giorno alla fine del mese', () => {
  const originalOrder = new Date(2025, 0, 31);
  const originalDueDate = new Date(2025, 1, 28);
  const now = new Date(2026, 3, 12);

  assert.equal(
    localDate(expenseDateInRelativeMonth(originalOrder, originalOrder, now)),
    '2026-04-30',
  );
  assert.equal(
    localDate(expenseDateInRelativeMonth(originalDueDate, originalOrder, now)),
    '2026-05-28',
  );
});
