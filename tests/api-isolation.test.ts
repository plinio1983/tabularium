import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as expensePayments from '../lib/expense-payments';

const require = createRequire(import.meta.url);
const current = {workspace: {id: 2}, company: {id: 3, timeZone: 'Europe/Rome'}, user: {id: 4}};

function route(file: string, db: Record<string, unknown>, denied = false, extra: Record<string, unknown> = {}) {
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const mocks: Record<string, unknown> = {
    '@/lib/prisma': {prisma: db},
    '@/lib/auth': {
      getWorkspaceContext: async () => denied ? null : current,
      getWorkspaceApiAccess: async () => denied ? {ok: false, status: 403, error: 'Permessi insufficienti'} : {ok: true, current},
      workspaceOperationalRoles: ['OWNER', 'ADMIN', 'ACCOUNTANT'],
    },
    '@/lib/expense-payments': expensePayments,
    '@/lib/attachments': {readExpenseAttachment: async () => {throw new Error('Non deve leggere file esterni');}},
    '@/lib/audit': {writeAuditLog: async () => {}},
    '@/lib/expense-bulk-copy': {},
    '@/lib/company-time': {},
    '@/lib/supplier-reference': {},
    '@/lib/redirect': {pathFromUrl: (_value: unknown, fallback: string) => fallback, redirectToPath: () => new Response(null, {status: 303})},
    '@/lib/flash': {appendFlash: (path: string) => path},
    ...extra,
  };
  const exports: Record<string, (...args: any[]) => Promise<Response>> = {};
  runInNewContext(compiled, {exports, require: (name: string) => mocks[name] ?? require(name), URL, Response, Error, Uint8Array});
  return exports;
}

for (const kind of ['expense', 'income']) {
  test(`${kind}: un allegato di un'altra azienda o workspace non è scaricabile`, async () => {
    const file = kind === 'expense' ? 'app/api/attachments/[id]/route.ts' : 'app/api/income-attachments/[id]/route.ts';
    for (const owner of [{workspaceId: 2, companyId: 99}, {workspaceId: 99, companyId: 3}]) {
      const db = {[`${kind}Attachment`]: {findFirst: async ({where}: any) => {
        assert.equal(where.id, 9);
        assert.equal(where[kind].workspaceId, current.workspace.id);
        assert.equal(where[kind].companyId, current.company.id);
        return owner.workspaceId === where[kind].workspaceId && owner.companyId === where[kind].companyId ? {path: 'private.pdf'} : null;
      }}};
      const response = await route(file, db).GET(new Request('http://localhost/api/attachments/9'), {params: Promise.resolve({id: '9'})});
      assert.equal(response.status, 404);
    }
    const response = await route(file, {}, true).GET(new Request('http://localhost'), {params: Promise.resolve({id: '9'})});
    assert.equal(response.status, 401);
  });
}

test('eliminazione multipla spese: selezionare ID esterni non elimina i relativi record', async () => {
  const records = [{id: 1, workspaceId: 2, companyId: 3}, {id: 2, workspaceId: 2, companyId: 99}, {id: 3, workspaceId: 99, companyId: 3}];
  function matches(record: typeof records[number], where: any) {
    return where.id.in.includes(record.id) && record.workspaceId === where.workspaceId && record.companyId === where.companyId;
  }
  const removed: number[] = [];
  const expense = {
    findMany: async ({where}: any) => records.filter(record => matches(record, where)),
    deleteMany: async ({where}: any) => {
      removed.push(...records.filter(record => matches(record, where)).map(record => record.id));
      return {count: removed.length};
    },
  };
  const db = {expense, $transaction: async (callback: any) => callback({expense})};
  const form = new FormData();
  form.set('bulkAction', 'delete');
  for (const record of records) form.append('ids', String(record.id));
  const request = () => new Request('http://localhost/api/expenses/bulk', {method: 'POST', body: form});
  assert.equal((await route('app/api/expenses/bulk/route.ts', db).POST(request())).status, 303);
  assert.deepEqual(removed, [1]);
  removed.length = 0;
  assert.equal((await route('app/api/expenses/bulk/route.ts', db, true).POST(request())).status, 403);
  assert.deepEqual(removed, []);
});

test('creazione spesa: banca di altro workspace rifiutata prima di salvare', async () => {
  let writes = 0;
  const db = {
    paymentMethod: {findMany: async () => [{id: 1, name: 'Bonifico'}]},
    bank: {findMany: async ({where}: any) => {assert.equal(where.workspaceId, current.workspace.id); return [];}},
    expense: {create: async () => {writes++;}},
  };
  const request = () => new Request('http://localhost/api/expenses', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({
    description: 'Spesa', amount: 10, billingPeriod: '2026-10', payments: [{amount: 10, paymentDate: '2026-10-03', paymentMethodId: 1, bankId: 99}],
  })});
  const response = await route('app/api/expenses/route.ts', db).POST(request());
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Banca/);
  assert.equal(writes, 0);
  assert.equal((await route('app/api/expenses/route.ts', db, true).POST(request())).status, 403);
  assert.equal(writes, 0);
});
