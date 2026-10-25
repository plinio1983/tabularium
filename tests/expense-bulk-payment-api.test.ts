import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as allocation from '../lib/expense-bulk-payment';
import * as validation from '../lib/expense-payments';
import * as dates from '../lib/payment-date';
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL('../app/api/expenses/bulk-payment/route.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
function setup(options: {mixed?: boolean; vat?: boolean; missing?: boolean; forbidden?: boolean; conflict?: boolean} = {}) {
  const expenses = [1, 2, 3].map(id => ({id, merchant: `Spesa ${id}`, expenseType: options.vat || (options.mixed && id === 2) ? 'VAT_SETTLEMENT' : 'STANDARD', amount: 100, payments: []}));
  const writes: any[] = [];
  let attempts = 0;
  const tx = {
    expense: {findMany: async ({where}: any) => {
      assert.equal(where.workspaceId, 2); assert.equal(where.companyId, 3);
      return options.missing ? expenses.slice(1) : expenses;
    }, update: async (args: any) => {writes.push({update: args});}},
    expensePayment: {create: async (args: any) => {writes.push({payment: args.data});}},
    paymentMethod: {findMany: async () => [{id: 1, name: 'Bonifico'}, {id: 2, name: 'Cash', systemRole: 'CASH'}]},
    bank: {findMany: async () => []},
    auditLog: {create: async (args: any) => {writes.push({audit: args});}},
  };
  const mocks: Record<string, unknown> = {
    '@/lib/expense-bulk-payment': allocation, '@/lib/expense-payments': validation, '@/lib/payment-date': dates,
    '@/lib/auth': {workspaceOperationalRoles: [], getWorkspaceApiAccess: async () => options.forbidden ? {ok: false, status: 403, error: 'Non autorizzato'} : {ok: true, current: {workspace: {id: 2}, company: {id: 3}, user: {id: 4}}}},
    '@/lib/prisma': {prisma: {...tx, $transaction: async (callback: any, config: any) => {
      assert.equal(config.isolationLevel, 'Serializable');
      if (options.conflict && attempts++ === 0) throw {code: 'P2034'};
      return callback(tx);
    }}},
  };
  const exports: any = {};
  runInNewContext(compiled, {exports, require: (name: string) => mocks[name] ?? require(name), console});
  const preview = options.mixed ? [] : allocation.bulkPaymentRows(expenses);
  return {writes, post: (overrides = {}) => exports.POST(new Request('http://localhost/api/expenses/bulk-payment', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids: [1, 2, 3], amount: 150, paymentDate: '2026-10-25', paymentMethodId: 1, bankId: null, preview, ...overrides})})) as Promise<Response>};
}
test('saves full and partial allocations and leaves uncovered expenses untouched, retrying conflicts', async () => {
  const {post, writes} = setup({conflict: true});
  assert.equal((await post()).status, 200);
  assert.deepEqual(writes.filter(w => w.payment).map(w => w.payment.amount), [100, 50]);
  assert.deepEqual(writes.filter(w => w.update).map(w => w.update.data.paymentStatus), ['COMPLETATO', 'PAGATO_PARZIALMENTE']);
  assert.equal(writes.filter(w => w.audit).length, 1);
});
test('rejects mixed selections, missing records, authorization failures, stale previews and overpayments before writes', async () => {
  for (const options of [{mixed: true}, {missing: true}, {forbidden: true}]) {
    const {post, writes} = setup(options);
    assert.ok((await post()).status >= 400); assert.equal(writes.length, 0);
  }
  for (const override of [{preview: []}, {amount: 301}, {amount: 0}, {amount: 1.001}, {paymentDate: '2026-02-30'}, {paymentMethodId: 999}, {bankId: 999}]) {
    const {post, writes} = setup();
    assert.equal((await post(override)).status, 400); assert.equal(writes.length, 0);
  }
});
test('cash forbidden for homogeneous VAT settlements; bank transfer allowed', async () => {
  const {post, writes} = setup({vat: true});
  assert.equal((await post({paymentMethodId: 2})).status, 400); assert.equal(writes.length, 0);
  assert.equal((await post()).status, 200);
});
