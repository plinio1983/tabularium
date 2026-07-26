import assert from 'node:assert/strict';
import test from 'node:test';
import { preferredCashRegisterBankId } from '../lib/cash-register-bank';

test('la regola metodo-canale prevale sulla banca di fallback', () => {
  assert.equal(preferredCashRegisterBankId(null, 22, 11), 22);
});

test('senza regola viene usata la banca di fallback del metodo', () => {
  assert.equal(preferredCashRegisterBankId(null, null, 11), 11);
});

test('Cash ignora le regole per canale e resta associato a Cassa', () => {
  assert.equal(preferredCashRegisterBankId('CASH', 22, 11), 11);
});
