import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {parseRecurringExpenseBulkEdit} from '../lib/recurring-expense-bulk-edit';

function form(values: Record<string, string>) {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
}

test('modifica cadenza e data insieme senza sovrascrivere fatturazione e pagamento', () => {
  const data = parseRecurringExpenseBulkEdit(form({field: 'schedule', updateCadence: 'on', cadence: 'YEARLY', updateStartDate: 'on', startDate: '2026-09-15', billingPeriodMode: 'CUSTOM_MONTH', billingMonth: '8', updateDueDay: 'on', dueDay: '2'}));
  assert.deepEqual(data, {cadence: 'YEARLY', startDate: new Date('2026-09-15')});
});

test('il solo giorno pagamento conserva modalità, metodo e banca', () => {
  assert.deepEqual(parseRecurringExpenseBulkEdit(form({field: 'payment', updateDueDay: 'on', dueDay: '15', isAutomaticPayment: 'false', paymentMethodId: '4', bankId: '7'})), {dueDay: 15});
});

test('pagamento automatico e giorno possono essere modificati insieme', () => {
  assert.deepEqual(parseRecurringExpenseBulkEdit(form({field: 'payment', updatePayment: 'on', isAutomaticPayment: 'true', paymentMethodId: '4', bankId: '7', updateDueDay: 'on', dueDay: '30'})), {isAutomaticPayment: true, paymentMethodId: 4, bankId: 7, dueDay: 30});
});

test('pagamento manuale rimuove i riferimenti automatici senza cambiare il giorno', () => {
  assert.deepEqual(parseRecurringExpenseBulkEdit(form({field: 'payment', updatePayment: 'on', isAutomaticPayment: 'false', bankId: '7', dueDay: '15'})), {isAutomaticPayment: false, paymentMethodId: null, bankId: null});
});

test('mese personalizzato obbligatorio e compreso tra 1 e 12', () => {
  const base = {field: 'schedule', updateBilling: 'on', billingPeriodMode: 'CUSTOM_MONTH'};
  for (const value of ['', '0', '13', '1.5']) assert.throws(() => parseRecurringExpenseBulkEdit(form({...base, billingMonth: value})));
  assert.deepEqual(parseRecurringExpenseBulkEdit(form({...base, billingMonth: '12'})), {billingPeriodMode: 'CUSTOM_MONTH', billingMonth: 12});
  assert.deepEqual(parseRecurringExpenseBulkEdit(form({...base, billingPeriodMode: 'NEXT_MONTH', billingMonth: '12'})), {billingPeriodMode: 'NEXT_MONTH', billingMonth: null});
});

test('rifiuta selezioni vuote, date impossibili e valori non validi', () => {
  const invalidForms: Record<string, string>[] = [
    {field: 'schedule'}, {field: 'payment'},
    {field: 'schedule', updateStartDate: 'on', startDate: '2026-02-30'},
    {field: 'schedule', updateCadence: 'on', cadence: 'INVALID'},
    {field: 'payment', updateDueDay: 'on', dueDay: '31'},
    {field: 'payment', updateDueDay: 'on', dueDay: '1.5'},
    {field: 'payment', updatePayment: 'on', isAutomaticPayment: 'true', paymentMethodId: '4'},
  ];
  for (const values of invalidForms) assert.throws(() => parseRecurringExpenseBulkEdit(form(values)));
});

const require = createRequire(import.meta.url);
function handler(invalidReference = false, invalidEndDate = false) {
  const writes: any[] = [];
  const audits: any[] = [];
  const lookups: any[] = [];
  const compiled = ts.transpileModule(readFileSync(new URL('../app/api/recurring-expenses/bulk/route.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const reference = {findFirst: async (args: unknown) => {lookups.push(args); return invalidReference ? null : {id: 4};}};
  const mocks: Record<string, unknown> = {
    '@/lib/recurring-expense-bulk-edit': {parseRecurringExpenseBulkEdit},
    '@/lib/auth': {getWorkspaceApiAccess: async () => ({ok: true, current: {workspace: {id: 2}, company: {id: 3}, user: {id: 1}}}), workspaceOperationalRoles: []},
    '@/lib/prisma': {prisma: {expenseCategory: reference, paymentMethod: reference, bank: reference, recurringExpense: {
      findFirst: async () => invalidEndDate ? {id: 8} : null,
      updateMany: async (args: unknown) => {writes.push(args); return {count: 2};},
    }}},
    '@/lib/audit': {writeAuditLog: async (args: unknown) => {audits.push(args);}},
    '@/lib/flash': {appendFlash: (path: string, flash: Record<string, string>) => `${path}?${new URLSearchParams(flash)}`},
    '@/lib/redirect': {pathFromUrl: (_value: string, fallback: string) => fallback, redirectToPath: (path: string) => new Response(null, {status: 303, headers: {location: path}})},
  };
  const exports: {POST?: (request: Request) => Promise<Response>} = {};
  runInNewContext(compiled, {exports, require: (name: string) => mocks[name] ?? require(name), Response, URL});
  return {writes, audits, lookups, save: (values: Record<string, string>) => exports.POST!(new Request('http://localhost/api/recurring-expenses/bulk', {method: 'POST', body: form({bulkAction: 'bulk_edit', ids: '8', ...values})}))};
}

test('endpoint applica una sola modifica circoscritta ad azienda/workspace e registra audit', async () => {
  const h = handler();
  const response = await h.save({field: 'payment', updatePayment: 'on', isAutomaticPayment: 'true', paymentMethodId: '4', bankId: '7', updateDueDay: 'on', dueDay: '15'});
  assert.match(response.headers.get('location')!, /saved=bulk_updated/);
  assert.equal(h.writes.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0])), {where: {id: {in: [8]}, workspaceId: 2, companyId: 3}, data: {isAutomaticPayment: true, paymentMethodId: 4, bankId: 7, dueDay: 15}});
  assert.equal(h.audits.length, 1);
  assert.ok(h.lookups.every(query => query.where.workspaceId === 2));
});

test('endpoint non salva riferimenti esterni, date dopo fine ricorrenza o richieste invalide', async () => {
  for (const [h, values] of [
    [handler(true), {field: 'categoryId', categoryId: '4'}],
    [handler(true), {field: 'payment', updatePayment: 'on', isAutomaticPayment: 'true', paymentMethodId: '4', bankId: '7'}],
    [handler(false, true), {field: 'schedule', updateStartDate: 'on', startDate: '2026-09-15'}],
    [handler(), {field: 'schedule'}],
  ] as const) {
    const response = await h.save(values);
    assert.match(response.headers.get('location')!, /error=invalid/);
    assert.equal(h.writes.length, 0);
    assert.equal(h.audits.length, 0);
  }
});
