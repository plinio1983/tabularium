import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateExpenseCategoryTrend} from '../lib/expense-category-trend';

test('aggregates expenses by category and preserves special expense groups', () => {
  const data = aggregateExpenseCategoryTrend([
    {amount: 100, receivedDate: new Date('2026-01-10T12:00:00Z'), categoryId: 1, category: {name: 'Materiali'}},
    {amount: 50, receivedDate: new Date('2026-01-12T12:00:00Z'), expenseType: 'VAT_SETTLEMENT'},
    {amount: 200, receivedDate: new Date('2026-04-01T12:00:00Z'), expenseType: 'PAYROLL'},
  ], 2026, 'Europe/Rome');
  assert.equal(data.total, 350);
  assert.equal(data.months[0].total, 150);
  assert.ok(data.channels.some(category => category.name === 'Saldo IVA'));
  assert.ok(data.channels.some(category => category.name === 'Buste paga'));
  assert.equal(data.quarters[1].weeks.reduce((sum, week) => sum + week.total, 0), 200);
});
