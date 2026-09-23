import test from 'node:test';
import assert from 'node:assert/strict';
import {recurringStateChange, isRecurringDateSuspended, RecurringStateError} from '../lib/recurring-suspensions';
import {recurrenceDates, recurrenceDateInput} from '../lib/recurrence-schedule';
import {calculateRecurringExpenseDueDates} from '../lib/recurring-expenses-job';
import {changeRecurringStateInTransaction} from '../lib/recurring-state';
import {canGenerateRecurringOccurrence} from '../lib/recurring-generation-state';

const date = (day: string) => new Date(`${day}T00:00:00Z`);
const rule = {id: 1, isActive: true, startDate: date('2026-01-01'), endDate: null, suspensionPeriods: []};

test('On/Off ripetuti conservano gli intervalli e sono idempotenti', () => {
  const off = {...rule, ...recurringStateChange(rule, false, '2026-02-01')};
  assert.equal(recurringStateChange(off, false, '2026-03-01'), null);
  const on = {...off, ...recurringStateChange(off, true, '2026-04-01')};
  assert.equal(recurringStateChange(on, true, '2026-04-02'), null);
  const again = {...on, ...recurringStateChange(on, false, '2026-06-01')};
  assert.deepEqual(again.suspensionPeriods, [{from: '2026-02-01', to: '2026-04-01'}, {from: '2026-06-01', to: null}]);
  assert.equal(isRecurringDateSuspended(date('2026-02-01'), again.suspensionPeriods), true);
  assert.equal(isRecurringDateSuspended(date('2026-04-01'), again.suspensionPeriods), false);
  assert.equal(isRecurringDateSuspended(date('2026-07-01'), again.suspensionPeriods), true);
});

test('ricorrenze scadute richiedono una nuova fine; le inattive legacy non recuperano arretrati', () => {
  assert.throws(() => recurringStateChange({...rule, isActive: false, endDate: date('2026-02-01')}, true, '2026-03-01'), RecurringStateError);
  const resumed = recurringStateChange({...rule, isActive: false}, true, '2026-03-01')!;
  assert.equal(isRecurringDateSuspended(date('2026-02-01'), resumed.suspensionPeriods), true);
  assert.equal(isRecurringDateSuspended(date('2026-03-01'), resumed.suspensionPeriods), false);
});

test('ripresa mensile e annuale senza occorrenze sospese e senza spostare la cadenza', () => {
  for (const cadence of ['MONTHLY', 'YEARLY', 'EVERY_2_YEARS']) {
    const base = {startDate: date('2024-01-15'), cadence, day: 15};
    const periods = [{from: '2024-12-01', to: '2026-02-01'}];
    for (const dates of [
      recurrenceDates(base, date('2027-03-01')).map(recurrenceDateInput),
      calculateRecurringExpenseDueDates({...base, dueDay: 15, generationTiming: 'ON_DUE_DATE'}, date('2027-03-01')).map(day => day.toISOString().slice(0, 10))
    ]) {
      const eligible = dates.filter(day => !isRecurringDateSuspended(day, periods));
      assert.ok(eligible.every(day => day < '2024-12-01' || day >= '2026-02-01'));
      if (cadence === 'MONTHLY') assert.ok(eligible.includes('2026-02-15'));
      if (cadence === 'YEARLY') assert.ok(eligible.includes('2027-01-15'));
      assert.ok(eligible.every(day => day.endsWith('-15')));
    }
  }
});

const scope = {workspaceId: 2, companyId: 3, userId: 4, timeZone: 'Europe/Rome'};
function transaction(rules: Array<typeof rule>, found = rules.map(({id}) => ({id}))) {
  const writes: any[] = [], audits: any[] = [], queries: any[] = [];
  const delegate = {findMany: async (query: unknown) => {queries.push(query); return rules;}, update: async (query: unknown) => {writes.push(query);}};
  const tx: any = {$queryRaw: async (...args: unknown[]) => {queries.push(args); return found;}, recurringExpense: delegate, recurringIncome: delegate, auditLog: {create: async (entry: unknown) => {audits.push(entry);}}};
  return {tx, writes, audits, queries};
}

for (const kind of ['expense', 'income'] as const) {
  test(`${kind}: aggiornamento multiplo scoped, nessuna eliminazione, audit e deduplicazione`, async () => {
    const h = transaction([rule, {...rule, id: 2}]);
    assert.equal(await changeRecurringStateInTransaction(h.tx, kind, [2, 1, 2], false, scope), 2);
    assert.equal(h.writes.length, 2);
    assert.ok(h.writes.every(write => write.data.isActive === false && write.data.suspensionPeriods.length === 1));
    assert.deepEqual(h.queries[1].where, {id: {in: [1, 2]}, workspaceId: 2, companyId: 3});
    assert.equal(h.audits[0].data.metadata.operation, 'deactivate');
  });

  test(`${kind}: selezioni esterne o vuote non effettuano scritture`, async () => {
    const h = transaction([rule], []);
    await assert.rejects(changeRecurringStateInTransaction(h.tx, kind, [1], true, scope), RecurringStateError);
    await assert.rejects(changeRecurringStateInTransaction(h.tx, kind, [], true, scope), RecurringStateError);
    assert.equal(h.writes.length, 0);
    assert.equal(h.audits.length, 0);
  });

  test(`${kind}: il generatore ricontrolla lo stato sotto lock prima di creare`, async () => {
    let state = {isActive: false, suspensionPeriods: [{from: '2026-02-01', to: '2026-04-01'}]};
    const tx: any = {$queryRaw: async () => [state]};
    assert.equal(await canGenerateRecurringOccurrence(tx, kind, 1, date('2026-05-01')), false);
    state = {...state, isActive: true};
    assert.equal(await canGenerateRecurringOccurrence(tx, kind, 1, date('2026-03-01')), false);
    assert.equal(await canGenerateRecurringOccurrence(tx, kind, 1, date('2026-04-01')), true);
  });
}
