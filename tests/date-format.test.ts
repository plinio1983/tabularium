import assert from 'node:assert/strict';
import test from 'node:test';
import {formatItalianCompactDate} from '../lib/date-format';

test('formats an ISO calendar date with the application display format', () => {
  assert.equal(formatItalianCompactDate('2026-08-08'), '08 Ago 2026');
});

test('preserves invalid and empty values', () => {
  assert.equal(formatItalianCompactDate(''), '');
  assert.equal(formatItalianCompactDate('not-a-date'), 'not-a-date');
});
