import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function job(kind: 'expense' | 'income', exclusions: string[] = []) {
  const keyField = kind === 'expense' ? 'recurringExpensePeriodKey' : 'recurringIncomePeriodKey';
  const records: Array<Record<string, any>> = [];
  const definition = {
    id: 42, workspaceId: 1, companyId: 1, company: {workspaceId: 1, timeZone: 'Europe/Rome'},
    cadence: 'WEEKLY', startDate: new Date('2026-03-01T00:00:00Z'), endDate: null,
    dueDay: 7, creditDay: 7, generationTiming: 'ON_DUE_DATE', billingPeriodMode: 'CUSTOM_MONTH', billingMonth: 12,
    expenseType: 'STANDARD', supplierId: 1, supplier: {businessName: 'Fornitore'},
    paymentMethodId: 1, bankId: 1, description: 'Ricorrenza', amount: 100,
    suspensionPeriods: [{from: '2026-03-08', to: '2026-03-15'}]
  };
  const delegate = {
    findFirst: async ({where}: any) => records.find(record => where.OR
      ? where.OR.some((clause: any) => clause[keyField] ? record[keyField] === clause[keyField] : record.dueDate.getTime() === clause.dueDate.getTime())
      : record[keyField] === where[keyField]) ?? null,
    create: async ({data}: any) => {const record = {...data, id: records.length + 1}; records.push(record); return record;}
  };
  const prisma: any = {
    expense: delegate, income: delegate,
    recurringExpense: {findMany: async () => [definition]}, recurringIncome: {findMany: async () => [definition]},
    recurringExpenseExclusion: {findMany: async () => exclusions.map(periodKey => ({periodKey}))},
    $queryRaw: async () => [{isActive: true, suspensionPeriods: definition.suspensionPeriods}]
  };
  prisma.$transaction = async (callback: (tx: any) => unknown) => callback(prisma);
  const mocks: Record<string, unknown> = {
    '@/lib/prisma': {prisma}, '@/lib/notifications': {createSystemNotification: async () => {}}
  };
  const compiled = ts.transpileModule(readFileSync(new URL(`../lib/recurring-${kind}s-job.ts`, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
  }).outputText;
  const exports: any = {};
  runInNewContext(compiled, {exports, require: (name: string) => mocks[name] ?? require(name), Date, Map, Set});
  return {records, keyField, run: () => exports[kind === 'expense' ? 'generateRecurringExpenses' : 'generateRecurringIncomes'](new Date('2026-03-29T12:00:00Z'))};
}

for (const kind of ['expense', 'income'] as const) {
  test(`${kind}: più settimane nello stesso mese contabile, sospensione e riesecuzione senza duplicati`, async () => {
    const h = job(kind);
    const first = await h.run();
    assert.equal(first.errors.length, 0, JSON.stringify(first.errors));
    assert.equal(first.created, 4);
    assert.deepEqual(h.records.map(record => record[h.keyField]), ['2026-03-01', '2026-03-15', '2026-03-22', '2026-03-29']);
    assert.ok(h.records.every(record => (record.month ?? record.billingMonth) === 12));
    const second = await h.run();
    assert.equal(second.errors.length, 0);
    assert.equal(second.created, 0);
    assert.equal(h.records.length, 4);
  });
}

test('esclusione di una spesa settimanale non esclude le altre settimane', async () => {
  const h = job('expense', ['2026-03-15']);
  const result = await h.run();
  assert.equal(result.errors.length, 0);
  assert.equal(result.created, 3);
  assert.deepEqual(h.records.map(record => record[h.keyField]), ['2026-03-01', '2026-03-22', '2026-03-29']);
});
