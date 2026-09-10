import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {OptionalPayrollMoneyFromForm} from '../lib/payroll-money-schema';

const require = createRequire(import.meta.url);

function handler(edit: boolean) {
  const writes: Array<{data: Record<string, unknown>}> = [];
  const route = edit ? '../app/api/recurring-expenses/[id]/route.ts' : '../app/api/recurring-expenses/route.ts';
  const compiled = ts.transpileModule(readFileSync(new URL(route, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const current = {workspace: {id: 2}, company: {id: 1, timeZone: 'Europe/Rome'}, user: {id: 3}};
  const mocks: Record<string, unknown> = {
    '@/lib/payroll-money-schema': {OptionalPayrollMoneyFromForm},
    '@/lib/auth': {getWorkspaceApiAccess: async () => ({ok: true, current}), workspaceOperationalRoles: []},
    '@/lib/prisma': {prisma: {
      employee: {findFirst: async () => ({id: 4, firstName: 'Mario', lastName: 'Rossi'})},
      recurringExpense: {
        findFirst: async () => ({id: 5}),
        create: async (args: {data: Record<string, unknown>}) => {writes.push(args); return {id: 5};},
        update: async (args: {data: Record<string, unknown>}) => {writes.push(args); return {id: 5};},
      },
    }},
    '@/lib/audit': {writeAuditLog: async () => {}},
    '@/lib/flash': {appendFlash: (path: string) => path},
    '@/lib/redirect': {pathFromUrl: (_value: string, fallback: string) => fallback, redirectToPath: () => new Response(null, {status: 303})},
    '@/lib/supplier-reference': {},
    '@/lib/company-time': {},
  };
  const exports: {POST?: (request: Request, context: unknown) => Promise<Response>} = {};
  runInNewContext(compiled, {exports, require: (name: string) => mocks[name] ?? require(name), Response, URL});
  return {save: exports.POST!, writes};
}

function request(amounts: Record<string, string>, json = true) {
  const form = new FormData();
  Object.entries({expenseType: 'PAYROLL', employeeId: '4', startDate: '2026-09-01', cadence: 'MONTHLY', description: 'Busta paga', amount: '1550.75', affectsFiscalProfit: 'true', ...amounts})
    .forEach(([name, value]) => form.set(name, value));
  return new Request('http://localhost/api/recurring-expenses', {method: 'POST', body: form, headers: json ? {accept: 'application/json'} : {}});
}

for (const edit of [false, true]) {
  const action = edit ? 'modifica' : 'creazione';
  test(`${action} busta paga ricorrente: salva gli importi con virgola senza errore 500`, async () => {
    const {save, writes} = handler(edit);
    const response = await save(request({payrollNetAmount: '1500,50', payrollExtraCompensation: '50,25', payrollGrossAmount: '2000,75', payrollEmployerCost: '2500,10'}), {params: Promise.resolve({id: '5'})});
    assert.ok(response.status < 400);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].data.amount, 1550.75);
    assert.equal(writes[0].data.payrollNetAmount, 1500.5);
    assert.equal(writes[0].data.payrollExtraCompensation, 50.25);
    assert.equal(writes[0].data.payrollGrossAmount, 2000.75);
    assert.equal(writes[0].data.payrollEmployerCost, 2500.1);
  });

  test(`${action}: importi opzionali vuoti e zero sono accettati`, async () => {
    const {save, writes} = handler(edit);
    const response = await save(request({payrollNetAmount: '1500.50', payrollExtraCompensation: '0,00', payrollGrossAmount: '', payrollEmployerCost: ''}), {params: Promise.resolve({id: '5'})});
    assert.ok(response.status < 400);
    assert.equal(writes[0].data.amount, 1500.5);
    assert.equal(writes[0].data.payrollGrossAmount, null);
    assert.equal(writes[0].data.payrollEmployerCost, null);
  });

  test(`${action}: input errato restituisce 400 senza scrivere dati`, async () => {
    for (const value of ['non valido', '-10,50', 'Infinity']) {
      const {save, writes} = handler(edit);
      const response = await save(request({payrollExtraCompensation: value}), {params: Promise.resolve({id: '5'})});
      assert.equal(response.status, 400);
      assert.ok((await response.json()).fields.payrollExtraCompensation);
      assert.equal(writes.length, 0);
    }
  });

  test(`${action}: input errato da form tradizionale restituisce un redirect gestito`, async () => {
    const {save, writes} = handler(edit);
    assert.equal((await save(request({payrollGrossAmount: 'errato'}, false), {params: Promise.resolve({id: '5'})})).status, 303);
    assert.equal(writes.length, 0);
  });
}
