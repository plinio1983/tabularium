import assert from 'node:assert/strict';
import test from 'node:test';
import {employeeDisplayName, employeeInputSchema, employeePersistenceData} from '../lib/employees';

test('valida e normalizza l’anagrafica del dipendente', () => {
  const parsed = employeeInputSchema.parse({
    firstName: ' Mario ', lastName: ' Rossi ', employeeCode: '', email: '',
    hiredAt: '2026-01-10', terminatedAt: '', status: 'ACTIVE'
  });
  assert.equal(parsed.firstName, 'Mario');
  assert.equal(parsed.lastName, 'Rossi');
  assert.equal(parsed.employeeCode, null);
  assert.equal(parsed.email, null);
  assert.equal(parsed.terminatedAt, null);
  assert.equal(employeePersistenceData(parsed).hiredAt?.toISOString(), '2026-01-10T00:00:00.000Z');
});

test('rifiuta una cessazione precedente all’assunzione', () => {
  const parsed = employeeInputSchema.safeParse({firstName: 'Mario', lastName: 'Rossi', hiredAt: '2026-03-01', terminatedAt: '2026-02-28'});
  assert.equal(parsed.success, false);
});

test('costruisce il nome ordinabile del dipendente', () => {
  assert.equal(employeeDisplayName({firstName: 'Mario', lastName: 'Rossi'}), 'Rossi Mario');
});
