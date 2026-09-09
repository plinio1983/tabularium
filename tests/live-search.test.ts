import test from 'node:test';
import assert from 'node:assert/strict';
import {liveSearchParams, employeeNameSearch, filteredListHref} from '../lib/live-search';
import {matchesExpenseQuickSearch} from '../lib/expense-list-filters';

test('live search preserves combined filters and sorting and removes transient parameters', () => {
  const params = liveSearchParams('category=1&category=2&mobileSort=amount_desc&month=2026-09&saved=updated&error=x&usage=1&new=1&page=3', 'search', '  Rossi & figli  ');
  assert.deepEqual(params.getAll('category'), ['1', '2']);
  assert.equal(params.get('mobileSort'), 'amount_desc');
  assert.equal(params.get('month'), '2026-09');
  assert.equal(params.get('search'), 'Rossi & figli');
  for (const name of ['saved', 'error', 'usage', 'new', 'page']) assert.equal(params.has(name), false);
  const cleared = liveSearchParams(params.toString(), 'search', '  ');
  assert.equal(cleared.has('search'), false);
  assert.equal(cleared.get('month'), '2026-09');
});

test('employee search matches complete names in either order and requires every word', () => {
  const employee = {firstName: 'Mario', lastName: 'De Rossi', employeeCode: 'DIP-123', taxCode: 'RSSMRA'};
  const matches = (query: string) => employeeNameSearch(query).every(group => group.OR.some(condition =>
    Object.entries(condition).some(([key, filter]) => employee[key as keyof typeof employee].toLowerCase().includes(filter.contains.toLowerCase()))));
  assert.equal(matches('Mario De Rossi'), true);
  assert.equal(matches('rossi mario'), true);
  assert.equal(matches('DIP-123'), true);
  assert.equal(matches('Mario Bianchi'), false);
});

test('payroll search uses the current employee name even when stored merchant text is outdated', () => {
  const expense = {expenseType: 'PAYROLL', isRecurring: false, merchant: 'Vecchio nome', employee: {firstName: 'Mario', lastName: 'Rossi'}};
  assert.equal(matchesExpenseQuickSearch(expense, 'Mario Rossi'), true);
  assert.equal(matchesExpenseQuickSearch(expense, 'Rossi Mario'), true);
  assert.equal(matchesExpenseQuickSearch(expense, 'Bianchi'), false);
});

test('return URLs preserve search and repeated filters without action feedback', () => {
  const href = filteredListHref('/recurring-expenses', {search: 'Rossi & figli', categoryId: ['1', '2'], saved: 'updated', new: '1'});
  const url = new URL(href, 'http://localhost');
  assert.equal(url.pathname, '/recurring-expenses');
  assert.equal(url.searchParams.get('search'), 'Rossi & figli');
  assert.deepEqual(url.searchParams.getAll('categoryId'), ['1', '2']);
  assert.equal(url.searchParams.has('saved'), false);
  assert.equal(url.searchParams.has('new'), false);
});
