import assert from 'node:assert/strict';
import test from 'node:test';
import {taxAuthorityTotals} from '../lib/tax-authority-totals';

test('ente senza spese: totali a zero', () => {
  assert.deepEqual(taxAuthorityTotals([]), {paid: 0, toPay: 0, openCount: 0});
});

test('somma versamenti parziali e completi senza compensare altre spese con eccedenze', () => {
  assert.deepEqual(taxAuthorityTotals([
    {amount: '100', payments: [{amount: '20'}, {amount: '30'}]},
    {amount: '80', payments: [{amount: '80'}]},
    {amount: '40', payments: [{amount: '60'}]},
    {amount: '70', payments: []}
  ]), {paid: 190, toPay: 120, openCount: 2});
});
