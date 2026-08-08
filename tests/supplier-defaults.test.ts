import assert from 'node:assert/strict';
import test from 'node:test';
import {isSupplierDefaultVatRate, resolveSupplierDefaultVatRate} from '../lib/supplier-defaults';

test('accetta soltanto le aliquote configurabili per il fornitore', () => {
  assert.equal(isSupplierDefaultVatRate(0), true);
  assert.equal(isSupplierDefaultVatRate(4), true);
  assert.equal(isSupplierDefaultVatRate(10), true);
  assert.equal(isSupplierDefaultVatRate(22), true);
  assert.equal(isSupplierDefaultVatRate(5), false);
});

test('applica anche lo zero come aliquota predefinita', () => {
  assert.equal(resolveSupplierDefaultVatRate({
    currentVatRate: '22', supplierDefaultVatRate: 0, vatRateTouched: false, isFiscal: true,
  }), '0');
});

test('non sovrascrive aliquote modificate manualmente o spese senza IVA', () => {
  assert.equal(resolveSupplierDefaultVatRate({
    currentVatRate: '4', supplierDefaultVatRate: 22, vatRateTouched: true, isFiscal: true,
  }), '4');
  assert.equal(resolveSupplierDefaultVatRate({
    currentVatRate: '0', supplierDefaultVatRate: 22, vatRateTouched: false, isFiscal: false,
  }), '0');
  assert.equal(resolveSupplierDefaultVatRate({
    currentVatRate: '0', supplierDefaultVatRate: 22, vatRateTouched: false, isFiscal: true, supportsVat: false,
  }), '0');
});
