import assert from 'node:assert/strict';
import test from 'node:test';
import {incomeCreditState} from '../lib/income-status';

const today = new Date(2026, 7, 10, 12);

test('an open income becomes overdue only after its due date', () => {
  assert.equal(incomeCreditState({amount: 100, credits: [], dueDate: '2026-08-10'}, today), 'DA_ACCREDITARE');
  assert.equal(incomeCreditState({amount: 100, credits: [], dueDate: '2026-08-09'}, today), 'SCADUTO');
});

test('overdue takes precedence over partial credit while residual remains', () => {
  assert.equal(incomeCreditState({amount: 100, credits: [{amount: 40}], dueDate: '2026-08-09'}, today), 'SCADUTO');
  assert.equal(incomeCreditState({amount: 100, credits: [{amount: 40}], dueDate: '2026-08-11'}, today), 'PARZIALE');
});

test('a fully credited income is never overdue', () => {
  assert.equal(incomeCreditState({amount: 100, credits: [{amount: 100}], dueDate: '2026-08-01'}, today), 'ACCREDITATO');
});
