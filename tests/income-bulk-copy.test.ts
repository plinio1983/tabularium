import assert from 'node:assert/strict';
import test from 'node:test';
import {copiedIncomeCreditDate, copiedIncomeIsCredited} from '../lib/income-bulk-copy';

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

test('ricalcola la data accredito mantenendo la distanza dalla data ordine', () => {
  const result = copiedIncomeCreditDate('RELATIVE_TO_ORDER', new Date(2026, 0, 10), new Date(2026, 6, 29), new Date(2026, 1, 4), new Date(2026, 7, 1));
  assert.equal(dateKey(result), '2026-08-23');
});

test('supporta data accredito originale e data odierna', () => {
  const original = new Date(2026, 1, 4);
  const today = new Date(2026, 7, 5);
  assert.equal(dateKey(copiedIncomeCreditDate('ORIGINAL', null, null, original, today)), '2026-02-04');
  assert.equal(dateKey(copiedIncomeCreditDate('TODAY', null, null, original, today)), '2026-08-05');
});

test('ricalcola lo stato accreditato usando soltanto gli accrediti copiati', () => {
  assert.equal(copiedIncomeIsCredited(100, []), false);
  assert.equal(copiedIncomeIsCredited(100, [40, 59]), false);
  assert.equal(copiedIncomeIsCredited(100, [40, 60]), true);
});
