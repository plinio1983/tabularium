import assert from 'node:assert/strict';
import test from 'node:test';
import {pageTransitionDirection, shouldTransitionPage} from '../lib/page-transition';

test('page slides reverse when returning to an ancestor', () => {
  assert.equal(pageTransitionDirection('/expenses', '/expenses/42'), 'forward');
  assert.equal(pageTransitionDirection('/expenses/42/edit', '/expenses/42'), 'backward');
  assert.equal(pageTransitionDirection('/expenses/42', '/expenses'), 'backward');
  assert.equal(pageTransitionDirection('/settings', '/'), 'backward');
  assert.equal(pageTransitionDirection('/expenses', '/incomes'), 'forward');
  assert.equal(pageTransitionDirection('/expenses-extra', '/expenses'), 'forward');
});

test('local views, filters and download endpoints are not page transitions', () => {
  assert.equal(shouldTransitionPage('/expenses', '/expenses'), false);
  assert.equal(shouldTransitionPage('/expenses', '/api/exports/expenses'), false);
  assert.equal(shouldTransitionPage('/expenses', '/logout'), false);
  assert.equal(shouldTransitionPage('/expenses', '/incomes'), true);
});
