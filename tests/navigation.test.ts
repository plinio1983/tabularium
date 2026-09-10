import assert from 'node:assert/strict';
import test from 'node:test';
import {isDocumentNavigationActive} from '../lib/navigation';

test('navigation highlights lists and document pages, not independent sidebar destinations', () => {
  for (const list of ['/expenses', '/incomes', '/suppliers']) {
    for (const suffix of ['', '/', '/new', '/123', '/123/edit']) {
      assert.equal(isDocumentNavigationActive(list + suffix, list), true, list + suffix);
    }
    for (const destination of ['/expenses/payments', '/expenses/import', '/expenses/counter', '/incomes/credits', '/incomes/cash-register', '/incomes/cash-register/receipts', '/clients', '/employees', '/recurring-expenses', '/recurring-incomes', '/', '/months/2026/8']) {
      assert.equal(isDocumentNavigationActive(destination, list), false, `${list}: ${destination}`);
    }
  }
});
