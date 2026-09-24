import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {appendFlash} from '../lib/flash';

const require = createRequire(import.meta.url);

for (const bulk of [false, true]) {
  const compiled = ts.transpileModule(readFileSync(new URL(`../app/api/suppliers/${bulk ? 'bulk' : '[id]'}/route.ts`, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
  }).outputText;

  async function attempt(expenses: number, recurring: number, protectedSupplier = false) {
    const writes: unknown[] = [], audits: unknown[] = [];
    const counts: unknown[] = [];
    const exports: any = {};
    const mocks: Record<string, unknown> = {
      '@/lib/prisma': {prisma: {
        supplier: {
          findFirst: async () => ({systemRole: protectedSupplier ? 'VAT_SETTLEMENT' : null}),
          count: async () => protectedSupplier ? 1 : 0,
          deleteMany: async (args: unknown) => {writes.push(args); return {count: 1};}
        },
        expense: {count: async (args: unknown) => {counts.push(args); return expenses;}},
        recurringExpense: {count: async (args: unknown) => {counts.push(args); return recurring;}}
      }},
      '@/lib/auth': {workspaceOperationalRoles: ['OWNER'], getWorkspaceApiAccess: async () => ({ok: true, current: {workspace: {id: 2}, user: {id: 4}}})},
      '@/lib/audit': {writeAuditLog: async (args: unknown) => {audits.push(args);}},
      '@/lib/flash': {appendFlash},
      '@/lib/redirect': {pathFromUrl: (value: string, fallback: string) => value || fallback, redirectToPath: (path: string) => new Response(null, {status: 303, headers: {Location: path}})},
      '@/lib/supplier-defaults': {isSupplierDefaultVatRate: () => true}
    };
    runInNewContext(compiled, {exports, URL, require: (name: string) => mocks[name] ?? require(name)});
    const body = new FormData();
    body.set(bulk ? 'bulkAction' : '_action', 'delete');
    if (bulk) body.set('ids', '28');
    const response = await exports.POST(new Request(`http://localhost/api/suppliers/${bulk ? 'bulk' : '28'}`, {method: 'POST', body}), {params: Promise.resolve({id: '28'})});
    return {writes, audits, counts, response};
  }

  test(`${bulk ? 'Elenco' : 'Dettaglio'} fornitori: segnala le ricorrenze anche con zero spese (caso Parissa)`, async () => {
    const {response, writes, audits, counts} = await attempt(0, 1);
    assert.equal(response.status, 303);
    assert.match(response.headers.get('location')!, /error=in_use_recurring&usage=1/);
    assert.equal(writes.length, 0);
    assert.equal(audits.length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(counts)), Array(2).fill({where: {supplierId: bulk ? {in: [28]} : 28, workspaceId: 2}}));
  });

  test(`${bulk ? 'Elenco' : 'Dettaglio'} fornitori: distingue spese e collegamenti misti`, async () => {
    for (const [expenses, recurring, error] of [[2, 0, 'in_use'], [2, 1, 'in_use_expenses_and_recurring']] as const) {
      const {response, writes} = await attempt(expenses, recurring);
      assert.equal(new URL(response.headers.get('location')!, 'http://localhost').searchParams.get('error'), error);
      assert.equal(writes.length, 0);
    }
  });

  test(`${bulk ? 'Elenco' : 'Dettaglio'} fornitori: elimina i fornitori senza collegamenti e protegge quelli di sistema`, async () => {
    const {response, writes, audits} = await attempt(0, 0);
    assert.match(response.headers.get('location')!, /saved=(bulk_)?deleted/);
    assert.equal(writes.length, 1);
    assert.equal(audits.length, 1);
    const protectedResult = await attempt(0, 0, true);
    assert.match(protectedResult.response.headers.get('location')!, /error=system_protected/);
    assert.equal(protectedResult.writes.length, 0);
  });
}
