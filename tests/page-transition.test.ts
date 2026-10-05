import assert from 'node:assert/strict';
import test from 'node:test';
import {pageTransitionKey, pageTransitionDirection, shouldTransitionPage} from '../lib/page-transition';

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
  assert.equal(shouldTransitionPage('/months/2026/9', '/months/2026/1'), false);
  assert.equal(shouldTransitionPage('/months/2026/9', '/months/2025/9'), false);
  assert.equal(shouldTransitionPage('/', '/months/2026/9'), true);
  assert.equal(shouldTransitionPage('/months/2026/9', '/expenses'), true);
});

test('only valid payment settings sections become distinct transition destinations', () => {
  for (const section of ['banks', 'methods', 'routing']) {
    const destination = pageTransitionKey('/settings/payment-credit', new URLSearchParams({section}));
    assert.equal(destination, `/settings/payment-credit?section=${section}`);
    assert.equal(shouldTransitionPage('/settings/payment-credit', destination), true);
    assert.equal(pageTransitionDirection(destination, '/settings/payment-credit'), 'backward');
  }
  assert.equal(pageTransitionKey('/settings/payment-credit', new URLSearchParams('section=invalid&saved=1')), '/settings/payment-credit');
  assert.equal(pageTransitionKey('/expenses', new URLSearchParams('section=banks')), '/expenses');
  assert.equal(pageTransitionKey('/months/2026/9', new URLSearchParams('mode=year')), '/months/2026/9');
});
