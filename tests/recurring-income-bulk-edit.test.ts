import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {parseRecurringIncomeBulkEdit} from '../lib/recurring-income-bulk-edit';

function form(values: Record<string, string>) {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
}

test('il canale di vendita cambia senza modificare cliente, importo o stato', () => {
  assert.deepEqual(parseRecurringIncomeBulkEdit(form({field: 'salesChannelId', salesChannelId: '4', customerId: '9', amount: '500', isActive: 'false'})), {salesChannelId: 4});
  for (const value of ['', '0', '-1', '1.5', 'abc']) {
    assert.throws(() => parseRecurringIncomeBulkEdit(form({field: 'salesChannelId', salesChannelId: value})));
  }
});

test('modifica cadenza e data insieme senza sovrascrivere fatturazione e accredito', () => {
  const data = parseRecurringIncomeBulkEdit(form({field: 'schedule', updateCadence: 'on', cadence: 'YEARLY', updateStartDate: 'on', startDate: '2026-09-15', billingPeriodMode: 'CUSTOM_MONTH', billingMonth: '8', updateCreditDay: 'on', creditDay: '2'}));
  assert.deepEqual(data, {cadence: 'YEARLY', startDate: new Date('2026-09-15')});
});

test('il solo giorno accredito conserva modalità, metodo e banca', () => {
  assert.deepEqual(parseRecurringIncomeBulkEdit(form({field: 'credit', updateCreditDay: 'on', creditDay: '15', isAutomaticCredit: 'false', paymentMethodId: '4', bankId: '7'})), {creditDay: 15});
});

test('accredito automatico e giorno possono essere modificati insieme', () => {
  assert.deepEqual(parseRecurringIncomeBulkEdit(form({field: 'credit', updateCredit: 'on', isAutomaticCredit: 'true', paymentMethodId: '4', bankId: '7', updateCreditDay: 'on', creditDay: '30'})), {isAutomaticCredit: true, paymentMethodId: 4, bankId: 7, creditDay: 30});
});

test('accredito manuale rimuove i riferimenti automatici senza cambiare il giorno', () => {
  assert.deepEqual(parseRecurringIncomeBulkEdit(form({field: 'credit', updateCredit: 'on', isAutomaticCredit: 'false', bankId: '7', creditDay: '15'})), {isAutomaticCredit: false, paymentMethodId: null, bankId: null});
});

test('mese personalizzato obbligatorio e compreso tra 1 e 12', () => {
  const base = {field: 'schedule', updateBilling: 'on', billingPeriodMode: 'CUSTOM_MONTH'};
  for (const value of ['', '0', '13', '1.5']) assert.throws(() => parseRecurringIncomeBulkEdit(form({...base, billingMonth: value})));
  assert.deepEqual(parseRecurringIncomeBulkEdit(form({...base, billingMonth: '12'})), {billingPeriodMode: 'CUSTOM_MONTH', billingMonth: 12});
  assert.deepEqual(parseRecurringIncomeBulkEdit(form({...base, billingPeriodMode: 'NEXT_MONTH', billingMonth: '12'})), {billingPeriodMode: 'NEXT_MONTH', billingMonth: null});
});

test('rifiuta selezioni vuote, date impossibili e valori non validi', () => {
  const invalidForms: Record<string, string>[] = [
    {field: 'schedule'}, {field: 'credit'},
    {field: 'schedule', updateStartDate: 'on', startDate: '2026-02-30'},
    {field: 'schedule', updateCadence: 'on', cadence: 'INVALID'},
    {field: 'credit', updateCreditDay: 'on', creditDay: '31'},
    {field: 'credit', updateCreditDay: 'on', creditDay: '1.5'},
    {field: 'credit', updateCredit: 'on', isAutomaticCredit: 'true', paymentMethodId: '4'},
  ];
  for (const values of invalidForms) assert.throws(() => parseRecurringIncomeBulkEdit(form(values)));
});

const require = createRequire(import.meta.url);
function handler(invalidReference = false, invalidEndDate = false) {
  const writes: any[] = [];
  const audits: any[] = [];
  const lookups: any[] = [];
  const compiled = ts.transpileModule(readFileSync(new URL('../app/api/recurring-incomes/bulk/route.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const reference = {findFirst: async (args: unknown) => {lookups.push(args); return invalidReference ? null : {id: 4};}};
  const mocks: Record<string, unknown> = {
    '@/lib/recurring-state-response': {recurringStateResponse: async (_request: Request, kind: string, ids: number[], active: boolean) => {writes.push({kind, ids, active}); return new Response(null, {status: 303, headers: {location: '/recurring-incomes?saved=deactivated'}});}},
    '@/lib/recurring-income-bulk-edit': {parseRecurringIncomeBulkEdit},
    '@/lib/auth': {getWorkspaceApiAccess: async () => ({ok: true, current: {workspace: {id: 2}, company: {id: 3}, user: {id: 1}}}), workspaceOperationalRoles: []},
    '@/lib/prisma': {prisma: {incomeSalesChannel: reference, paymentMethod: reference, bank: reference, recurringIncome: {
      findFirst: async () => invalidEndDate ? {id: 8} : null,
      updateMany: async (args: unknown) => {writes.push(args); return {count: 2};},
    }}},
    '@/lib/audit': {writeAuditLog: async (args: unknown) => {audits.push(args);}},
    '@/lib/flash': {appendFlash: (path: string, flash: Record<string, string>) => `${path}?${new URLSearchParams(flash)}`},
    '@/lib/redirect': {pathFromUrl: (_value: string, fallback: string) => fallback, redirectToPath: (path: string) => new Response(null, {status: 303, headers: {location: path}})},
  };
  const exports: {POST?: (request: Request) => Promise<Response>} = {};
  runInNewContext(compiled, {exports, require: (name: string) => mocks[name] ?? require(name), Response, URL});
  return {writes, audits, lookups, save: (values: Record<string, string>, ids = ['8', '9']) => {
    const body = form({bulkAction: 'bulk_edit', ...values});
    ids.forEach(id => body.append('ids', id));
    return exports.POST!(new Request('http://localhost/api/recurring-incomes/bulk', {method: 'POST', body}));
  }};
}

test('endpoint applica una sola modifica circoscritta ad azienda/workspace e registra audit', async () => {
  const h = handler();
  const response = await h.save({field: 'credit', updateCredit: 'on', isAutomaticCredit: 'true', paymentMethodId: '4', bankId: '7', updateCreditDay: 'on', creditDay: '15'});
  assert.match(response.headers.get('location')!, /saved=bulk_updated/);
  assert.equal(h.writes.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0])), {where: {id: {in: [8, 9]}, workspaceId: 2, companyId: 3}, data: {isAutomaticCredit: true, paymentMethodId: 4, bankId: 7, creditDay: 15}});
  assert.equal(h.audits.length, 1);
  assert.ok(h.lookups.every(query => query.where.workspaceId === 2));
});

test('nessuna selezione non modifica record e la disattivazione esistente rimane disponibile', async () => {
  const empty = handler();
  await empty.save({field: 'salesChannelId', salesChannelId: '4'}, []);
  assert.equal(empty.writes.length, 0);
  assert.equal(empty.audits.length, 0);
  const deletion = handler();
  const response = await deletion.save({bulkAction: 'delete'});
  assert.match(response.headers.get('location')!, /saved=deactivated/);
  assert.deepEqual(JSON.parse(JSON.stringify(deletion.writes[0])), {
    kind: 'income', ids: [8, 9], active: false
  });
});

test('endpoint non salva riferimenti esterni, date dopo fine ricorrenza o richieste invalide', async () => {
  for (const [h, values] of [
    [handler(true), {field: 'salesChannelId', salesChannelId: '4'}],
    [handler(true), {field: 'credit', updateCredit: 'on', isAutomaticCredit: 'true', paymentMethodId: '4', bankId: '7'}],
    [handler(false, true), {field: 'schedule', updateStartDate: 'on', startDate: '2026-09-15'}],
    [handler(), {field: 'schedule'}],
  ] as const) {
    const response = await h.save(values);
    assert.match(response.headers.get('location')!, /error=invalid/);
    assert.equal(h.writes.length, 0);
    assert.equal(h.audits.length, 0);
  }
});
