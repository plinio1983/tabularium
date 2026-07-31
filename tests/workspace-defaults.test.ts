import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultBanks,
  defaultCategories,
  defaultIncomeSalesChannels,
  defaultPaymentMethods,
  orderPaymentMethods
} from '../lib/workspace-defaults';

test('the new workspace catalog contains the requested values', () => {
  assert.deepEqual(defaultCategories.map(([, name]) => name), [
    'Tasse/Imposte',
    'Merce/Forniture',
    'Spedizioni',
    'Assicurazioni',
    'Servizi Bancari',
    'Servizi Web/Networking',
    'Articoli di supporto',
    'Altri Servizi'
  ]);
  assert.deepEqual(defaultBanks.map(([name]) => name), ['Hype', 'Revolut', 'Cassa']);
  assert.deepEqual(defaultIncomeSalesChannels.map(([, name]) => name), [
    'Vendita Beni',
    'Vendita Servizi',
    'Vendita B2B',
    'Predefinito'
  ]);
  assert.deepEqual(defaultPaymentMethods.map(([name]) => name), [
    'Cash',
    'Bonifico',
    'Carta',
    'Modello F24',
    'Addebito RID',
    'PayPal',
    'Cripto',
    'Altro metodo'
  ]);
});

test('Cash is the initial default for expenses and incomes', () => {
  const cash = defaultPaymentMethods.find(([name]) => name === 'Cash');
  assert.equal(cash?.[3], true);
  assert.equal(cash?.[4], true);
});

test('a configured method is ordered first for its movement kind', () => {
  const methods = [
    {id: 1, name: 'Cash', kind: 'BOTH', isExpenseDefault: false, isIncomeDefault: false},
    {id: 2, name: 'Bonifico', kind: 'BOTH', isExpenseDefault: true, isIncomeDefault: false}
  ];
  assert.equal(orderPaymentMethods(methods, 'EXPENSE')[0]?.id, 2);
  assert.equal(orderPaymentMethods(methods, 'INCOME')[0]?.id, 1);
});
