import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {appendFlash} from '../lib/flash';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL('../app/api/recurring-incomes/[id]/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
}).outputText;
function handler(authorized = true, count = 1) {
  const writes: any[] = [], audits: any[] = [];
  const exports: any = {};
  const mocks: Record<string, unknown> = {
    '@/lib/prisma': {prisma: {recurringIncome: {deleteMany: async (args: unknown) => {writes.push(args); return {count};}}}},
    '@/lib/auth': {workspaceOperationalRoles: ['OWNER'], getWorkspaceApiAccess: async () => authorized
      ? {ok: true, current: {workspace: {id: 2}, company: {id: 3}, user: {id: 4}}}
      : {ok: false, error: 'Forbidden', status: 403}},
    '@/lib/audit': {writeAuditLog: async (args: unknown) => {audits.push(args);}},
    '@/lib/flash': {appendFlash},
    '@/lib/redirect': {pathFromUrl: (value: string, fallback: string) => value || fallback, redirectToPath: (path: string) => new Response(null, {status: 303, headers: {Location: path}})},
    '@/lib/recurring-state': {}, '@/lib/recurring-state-response': {}, '@/lib/recurring-suspensions': {}
  };
  runInNewContext(compiled, {exports, URL, require: (name: string) => mocks[name] ?? require(name)});
  return {post: exports.POST, writes, audits};
}
function request(action = 'delete') {
  const body = new FormData(); body.set('_action', action);
  return new Request('http://localhost/api/recurring-incomes/42?returnTo=%2Frecurring-incomes%3Fsearch%3Dcanone', {method: 'POST', body});
}

test('Elimina soltanto la regola nell’azienda corrente, registra audit e conserva i filtri', async () => {
  const {post, writes, audits} = handler();
  const response = await post(request(), {params: Promise.resolve({id: '42'})});
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{where: {id: 42, workspaceId: 2, companyId: 3}}]);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].entityType, 'RecurringIncome');
  assert.equal(audits[0].action, 'DELETE');
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/recurring-incomes?search=canone&saved=deleted');
});

test('Autorizzazione, ID e azione non validi impediscono qualsiasi eliminazione', async () => {
  for (const [authorized, id, action, status] of [[false, '42', 'delete', 403], [true, 'abc', 'delete', 400], [true, '42', 'update', 400]] as const) {
    const {post, writes, audits} = handler(authorized);
    const response = await post(request(action), {params: Promise.resolve({id})});
    assert.equal(response.status, status);
    assert.equal(writes.length, 0);
    assert.equal(audits.length, 0);
  }
});

test('Una regola assente o di un’altra azienda non produce conferma di eliminazione', async () => {
  const {post, audits} = handler(true, 0);
  const response = await post(request(), {params: Promise.resolve({id: '42'})});
  assert.equal(audits.length, 0);
  assert.match(response.headers.get('location')!, /error=not_found/);
});

test('Gli incassi generati conservano i dati quando la regola viene eliminata', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /recurringIncome\s+RecurringIncome\?\s+@relation\(fields: \[recurringIncomeId\], references: \[id\], onDelete: SetNull\)/);
});
