import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as payroll from '../lib/payroll-expense';
import * as redirect from '../lib/redirect';
import * as flash from '../lib/flash';

const require = createRequire(import.meta.url);
function handler() {
  const writes: Array<{data: Record<string, any>}> = [];
  const compiled = ts.transpileModule(readFileSync(new URL('../app/api/expenses/[id]/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const current = {workspace: {id: 2}, company: {id: 1, timeZone: 'Europe/Rome'}, user: {id: 3}};
  const mocks: Record<string, unknown> = {
    '@/lib/payroll-expense': payroll,
    '@/lib/redirect': redirect,
    '@/lib/flash': flash,
    '@/lib/company-time': {},
    '@/lib/expense-invoice': {},
    '@/lib/auth': {getWorkspaceApiAccess: async () => ({ok: true, current}), workspaceOperationalRoles: []},
    '@/lib/supplier-reference': {},
    '@/lib/attachments': {saveExpenseAttachmentFiles: async () => []},
    '@/lib/audit': {writeAuditLog: async () => {}},
    '@/lib/prisma': {prisma: {
      expense: {
        findFirst: async () => ({id: 5, expenseType: 'PAYROLL', attachments: [], isRecurring: false}),
        update: async (args: {data: Record<string, any>}) => {writes.push(args); return {id: 5};},
      },
      employee: {findFirst: async () => ({id: 4, firstName: 'Test', lastName: 'Dipendente'})},
      paymentMethod: {findMany: async () => [{id: 1, name: 'Bonifico'}]},
    }},
  };
  const exports: {POST?: (request: Request, context: unknown) => Promise<Response>} = {};
  runInNewContext(compiled, {exports, require: (name: string) => mocks[name] ?? require(name), URL, Response});
  return {save: exports.POST!, writes};
}

function request(net: string, extra: string, payments: string[]) {
  const form = new FormData();
  Object.entries({expenseType: 'PAYROLL', employeeId: '4', description: 'Competenze', amount: String(Number(net.replace(',', '.')) + Number(extra.replace(',', '.'))),
    payrollNetAmount: net, payrollExtraCompensation: extra, payrollGrossAmount: '0,00', payrollEmployerCost: '0,00',
    payrollPeriodStart: '2026-07-01', payrollPeriodEnd: '2026-07-31', dueDate: '2026-08-15', billingPeriod: '2026-07', invoiceStatus: 'NON_PREVISTA', paymentStatus: 'COMPLETATO'})
    .forEach(([key, value]) => form.set(key, value));
  payments.forEach(amount => {
    form.append('paymentAmount[]', amount);
    form.append('paymentDate[]', '2026-08-10');
    form.append('paymentMethodId[]', '1');
    form.append('paymentBankId[]', '1');
  });
  return new Request('http://localhost/api/expenses/5?returnTo=%2Femployees%2F4', {method: 'POST', body: form});
}

test('modifica da dipendente: busta paga saldata salvata senza alterare importi e pagamenti', async () => {
  const {save, writes} = handler();
  const response = await save(request('1500.50', '50,25', ['1000.00', '550.75']), {params: Promise.resolve({id: '5'})});
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/employees/4?saved=updated');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.amount, 1550.75);
  assert.equal(writes[0].data.paidAmount, 1550.75);
  assert.equal(writes[0].data.payments.create.length, 2);
  assert.equal(writes[0].data.employeeId, 4);
});

test('pagamenti superiori al nuovo totale: errore esplicito 400, nessuna scrittura', async () => {
  const {save, writes} = handler();
  const response = await save(request('1400', '0,00', ['1500']), {params: Promise.resolve({id: '5'})});
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /netto più compensi extra/);
  assert.equal(writes.length, 0);
});

test('pagamento parziale resta valido', async () => {
  const {save, writes} = handler();
  const response = await save(request('2400', '0,00', ['1000', '260']), {params: Promise.resolve({id: '5'})});
  assert.equal(response.status, 303);
  assert.equal(writes[0].data.amount, 2400);
  assert.equal(writes[0].data.paidAmount, 1260);
});
