import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

for (const kind of ['expense', 'income'] as const) {
  test(`${kind}: automazione mantiene le conversioni ordinarie ed esclude i movimenti da banco`, async () => {
    const writes: any[] = [];
    const queries: any[] = [];
    const definition = {id: 42, isAutomaticPayment: true, isAutomaticCredit: true, paymentMethodId: 4, bankId: 3};
    const ordinary = {id: 10, expenseType: 'PAYROLL', incomeType: 'STANDARD', amount: 100,
      dueDate: new Date('2026-09-10T00:00:00Z'), payments: [], credits: [], merchant: 'Beneficiario',
      recurringExpense: definition, recurringIncome: definition,
      company: {id: 2, workspaceId: 1, timeZone: 'Europe/Rome'}};
    // Return both records to also exercise the job's guard on fetched data.
    const counter = {...ordinary, id: 11, expenseType: 'COUNTER', incomeType: 'CASH_REGISTER'};
    const delegate = {
      findMany: async (query: any) => {queries.push(query); return [ordinary, counter];},
      update: async (args: any) => {writes.push({operation: 'update', ...args}); return args;}
    };
    const ledger = {create: async (args: any) => {writes.push({operation: 'create', ...args}); return args;}};
    const prisma = {expense: delegate, income: delegate, expensePayment: ledger, incomeCredit: ledger,
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations)};
    const mocks: Record<string, unknown> = {
      '@/lib/prisma': {prisma}, '@/lib/notifications': {createSystemNotification: async () => {}}
    };
    const compiled = ts.transpileModule(readFileSync(new URL(`../lib/recurring-${kind}s-job.ts`, import.meta.url), 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
    }).outputText;
    const exports: any = {};
    runInNewContext(compiled, {exports, require: (name: string) => mocks[name] ?? require(name), Date, Map, Set});
    const result = await exports[kind === 'expense' ? 'settleAutomaticRecurringPayments' : 'settleAutomaticRecurringCredits'](new Date('2026-09-11T12:00:00Z'));
    assert.deepEqual([...result.errors], []);
    assert.equal(result.created, 1);
    assert.equal(result.skipped, 1);
    assert.equal(writes.length, 2);
    const payment = writes.find(write => write.operation === 'create').data;
    assert.equal(payment[kind === 'expense' ? 'expenseId' : 'incomeId'], 10);
    assert.equal(payment.amount, 100);
    assert.equal(payment.paymentMethodId, 4);
    assert.equal(payment.bankId, 3);
    assert.equal(writes.some(write => write.where?.id === 11), false);
    assert.equal(kind === 'expense' ? queries[0].where.expenseType.not : queries[0].where.incomeType, kind === 'expense' ? 'COUNTER' : 'STANDARD');
  });
}
