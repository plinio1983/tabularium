import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as lineTools from '../lib/cash-register-lines';
import * as companyTime from '../lib/company-time';
const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../lib/cash-register-save.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
function setup({cash = true, denied = false, failAudit = false, categoryMissing = false}: {cash?: boolean; denied?: boolean; failAudit?: boolean; categoryMissing?: boolean} = {}) {
  const queries: any[] = [], writes: any[] = [], audit: any[] = [];
  let stored: any = null, commits = 0;
  const exports: any = {};
  const tx = {income: {create: async (query: any) => {
    writes.push(query);
    if (stored) throw Object.assign(new Error('duplicate'), {code: 'P2002'});
    const {data} = query;
    return {id: 1, ...data, receiptLines: data.receiptLines.create};
  }, update: async (query: any) => {writes.push(query); return {id: 1, ...query.data};}}};
  const prisma = {
    income: {findFirst: async (query: any) => {queries.push(query); return stored;}},
    incomeCategory: {findFirst: async (query: any) => {queries.push(query); return categoryMissing ? null : {id: 3};}},
    customer: {findFirst: async (query: any) => {queries.push(query); return {id: 4};}},
    paymentMethod: {findFirst: async (query: any) => {queries.push(query); return {id: 5, systemRole: cash ? 'CASH' : null};}},
    incomeSalesChannel: {findFirst: async (query: any) => {queries.push(query); return {id: 6};}},
    bank: {findFirst: async (query: any) => {queries.push(query); return {id: 7};}},
    $transaction: async (fn: Function) => {const result = await fn(tx); stored = result; commits++; return result;},
  };
  runInNewContext(source, {exports, require: (name: string) => {
    if (name === './auth') return {workspaceOperationalRoles: ['OWNER', 'ADMIN', 'ACCOUNTANT'], getWorkspaceApiAccess: async () => denied ? {ok: false, status: 403, error: 'Permessi insufficienti'} : {ok: true, current: {workspace: {id: 21}, company: {id: 32, timeZone: 'Europe/Rome'}, user: {id: 1}}}};
    if (name === './prisma') return {prisma};
    if (name === './workspace-defaults') return {ensureWorkspaceDefaults: async () => {}};
    if (name === './income-category') return {resolveDefaultIncomeCategory: async () => ({id: 3})};
    if (name === './cash-register-bank') return {resolveCashRegisterBankId: async () => 7};
    if (name === './company-time') return companyTime;
    if (name === './cash-register-lines') return lineTools;
    if (name === './audit') return {writeAuditLog: async (input: any, db: any) => {assert.equal(db, tx); if (failAudit) throw new Error('Audit failed'); audit.push(input);}};
    return require(name);
  }});
  const input = {lines: [{amount: 12.2, isFiscal: true, vatRate: 22}, {amount: 11, isFiscal: true, vatRate: 10}, {amount: 5, isFiscal: false, vatRate: 0}], creditDate: '2026-10-14T12:00:00Z', salesChannelId: 6, incomeCategoryId: 3, description: 'Vendita', paymentMethodId: 5, requestId: '619f9a97-725a-4f30-8b03-ab9427c51d3b'};
  return {input, queries, writes, audit, get commits() {return commits;}, post: (change = {}) => exports.saveCashRegisterReceipt(new Request('http://localhost/api/cash-register/receipts', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...input, ...change})}))};
}

test('multi-line receipt saves one income, one credit and every line atomically with company scope', async () => {
  const app = setup(); const response = await app.post(); assert.equal(response.status, 201);
  const data = app.writes[0].data;
  assert.equal(data.amount, 28.2); assert.equal(data.receiptFiscalAmount, 23.2); assert.equal(data.receiptVatAmount, 3.2);
  assert.equal(data.receiptLines.create.length, 3); assert.equal(data.credits.create.amount, 28.2);
  assert.equal(data.workspaceId, 21); assert.equal(data.companyId, 32); assert.equal(app.audit.length, 1); assert.equal(app.commits, 1);
  for (const query of app.queries) assert.equal(query.where.workspaceId, 21);
  const duplicate = await app.post(); assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).duplicate, true); assert.equal(app.commits, 1);
  assert.equal((await app.post({description: 'Diversa'})).status, 409);
});

test('mixed non-fiscal receipts require cash; malformed lines and unauthorized requests never write', async () => {
  for (const [app, change, status] of [
    [setup({cash: false}), {}, 400], [setup({denied: true}), {}, 403], [setup({categoryMissing: true}), {}, 409],
    [setup(), {lines: [{amount: 1.001, isFiscal: true, vatRate: 22}]}, 400], [setup(), {lines: []}, 400],
  ] as const) {assert.equal((await app.post(change)).status, status); assert.equal(app.writes.length, 0);}
});

test('failed audit rolls back the receipt transaction; legacy single-amount payloads remain accepted', async () => {
  const failed = setup({failAudit: true}); assert.equal((await failed.post()).status, 500); assert.equal(failed.commits, 0);
  const legacy = setup(); assert.equal((await legacy.post({lines: undefined, amount: 12.2, isFiscal: true, vatRate: 22})).status, 201);
  assert.equal(legacy.writes[0].data.receiptLines.create.length, 1);
});
