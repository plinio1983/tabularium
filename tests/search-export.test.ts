import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {resolveExpenseSearch, matchesExpenseSearch} from '../lib/expenses-search';
import {resolveIncomeSearch, matchesIncomeSearch} from '../lib/incomes-search';
import * as serializers from '../lib/record-csv-export';

const require = createRequire(import.meta.url);
const now = new Date('2026-10-15T12:00:00Z');
const date = (value: string) => new Date(`${value}T00:00:00Z`);
const expense = (overrides: Record<string, unknown> = {}): any => ({
  id: 1, workspaceId: 21, companyId: 32, expenseType: 'STANDARD', isRecurring: false,
  receivedDate: date('2026-09-15'), dueDate: date('2026-10-01'), year: 2026, month: 9,
  amount: '1234.50', vatRate: '22', isDeclared: true, affectsFiscalProfit: false,
  category: {name: 'Servizi'}, supplier: {businessName: 'Alfa'}, employee: null, taxAuthority: null,
  merchant: null, description: 'Ordine prodotti', paymentStatus: 'PAGATO_PARZIALMENTE', paidAmount: '100',
  hasElectronicInvoice: true, invoiceStatus: 'IN_ATTESA', attachments: [{id: 3}],
  payments: [{id: 1, amount: '100', paymentDate: date('2026-09-16'), paymentMethod: {name: 'Bonifico'}, bank: {name: 'Banca'}}],
  ...overrides,
});
const income = (overrides: Record<string, unknown> = {}): any => ({
  id: 1, workspaceId: 21, companyId: 32, incomeType: 'STANDARD', billingYear: 2026, billingMonth: 9,
  orderDate: date('2026-09-15'), dueDate: date('2026-10-01'), creditDate: date('2026-09-16'),
  amount: '200', vatRate: '22', isFiscal: true, isCredited: false, invoiceStatus: 'NON_INVIATA',
  description: 'Prodotti Alfa', customer: {businessName: 'Alfa'}, salesChannelRef: {name: 'Negozio'},
  paymentMethodRef: {name: 'Bonifico'}, creditBank: {name: 'Banca'}, attachments: [],
  credits: [{amount: '100', paymentMethodId: 4, bankId: 5, creditDate: date('2026-09-16'), paymentMethod: {name: 'Bonifico'}, bank: {name: 'Banca'}}],
  ...overrides,
});
const options = [[{id: 4, name: 'Bonifico'}], [{id: 5, name: 'Banca'}]] as const;
function incomeSearch(filters: Record<string, string>) {
  return resolveIncomeSearch(filters, 'Europe/Rome', now, [...options[0]], [...options[1]]);
}

test('shared expense search respects all filters and defaults used by the list', () => {
  const filters = {
    orderDateFrom: '2026-09-01', orderDateTo: '2026-09-30', category: 'Servizi', expenseType: 'single',
    merchant: 'Alfa', supplierQuick: 'prodotti', product: 'prodotti', amount: '1.200,00–1.300,00',
    paymentStatus: 'overdue', residual: 'open', electronicInvoice: 'yes', invoiceStatus: 'not_received', declared: 'yes', attachments: 'with',
  };
  const search = resolveExpenseSearch(filters, 'Europe/Rome', now);
  assert.equal(matchesExpenseSearch(expense(), search), true);
  for (const change of [
    {receivedDate: date('2026-08-01')}, {category: {name: 'Altro'}}, {expenseType: 'PAYROLL'},
    {supplier: {businessName: 'Beta'}}, {description: 'Altro'}, {amount: '100'}, {dueDate: date('2026-12-01')},
    {payments: [{amount: '2000'}]}, {hasElectronicInvoice: false}, {invoiceStatus: 'RICEVUTA'}, {isDeclared: false}, {attachments: []},
  ]) assert.equal(matchesExpenseSearch(expense(change), search), false, JSON.stringify(change));
  const defaults = resolveExpenseSearch({}, 'Europe/Rome', now);
  assert.equal(matchesExpenseSearch(expense(), defaults), true);
  assert.equal(matchesExpenseSearch(expense({receivedDate: date('2026-01-01')}), defaults), false);
  const fiscal = resolveExpenseSearch({view: 'fiscale', billingPeriodFrom: '2026-10', billingPeriodTo: '2026-09'}, 'Europe/Rome', now);
  assert.equal(matchesExpenseSearch(expense(), fiscal), true);
  assert.equal(matchesExpenseSearch(expense({isDeclared: false}), fiscal), false);
});

test('shared income search respects dates, fiscal status, amounts, credits and invoice filters', () => {
  const search = incomeSearch({creditDateFrom: '2026-09-01', creditDateTo: '2026-09-30', orderDateFrom: '2026-09-01', dueDateTo: '2026-10-01', salesChannel: 'Negozio', amount: '>= 200', paymentMethod: 'Bonifico', creditChannel: 'Banca', customerQuick: 'prodotti Alfa', fiscal: 'yes', invoiceStatus: 'not_emitted', vatRate: '22', creditStatus: 'SCADUTO'});
  assert.equal(matchesIncomeSearch(income(), search), true);
  for (const change of [
    {creditDate: date('2026-10-01')}, {orderDate: date('2026-08-01')}, {dueDate: date('2026-12-01')},
    {salesChannelRef: {name: 'Web'}}, {amount: '50'}, {credits: []}, {isFiscal: false}, {invoiceStatus: 'EMESSA'}, {vatRate: '10'},
    {customer: {businessName: 'Beta'}, description: 'Altro'},
  ]) assert.equal(matchesIncomeSearch(income(change), search), false, JSON.stringify(change));
  assert.equal(matchesIncomeSearch(income({incomeType: 'CASH_REGISTER'}), incomeSearch({dateQuick: 'all'})), true);
  assert.equal(matchesIncomeSearch(income({incomeType: 'CASH_REGISTER'}), search), false);
});

function load(file: string, mocks: Record<string, unknown>, requireFrom = require) {
  const exports: any = {};
  const compiled = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  runInNewContext(compiled, {exports, URL, URLSearchParams, require: (name: string) => mocks[name] ?? requireFrom(name)});
  return exports;
}
function exportService(expenses: any[], incomes: any[]) {
  const queries: any[] = [];
  const scoped = (records: any[]) => async (query: any) => {
    queries.push(query);
    return records.filter(record => record.workspaceId === query.where.workspaceId && record.companyId === query.where.companyId);
  };
  const prisma = {expense: {findMany: scoped(expenses)}, income: {findMany: scoped(incomes)}, paymentMethod: {findMany: async () => [{id: 4, name: 'Bonifico', kind: 'INCOME'}]}, bank: {findMany: async () => [{id: 5, name: 'Banca'}]}};
  const service = load('lib/search-export.ts', {'./prisma': {prisma}}, createRequire(new URL('../lib/search-export.ts', import.meta.url)));
  return {service: service.searchExportCsv, queries, prisma};
}

test('search CSV exports every matching record beyond 5000 and respects company scope', async () => {
  const records = Array.from({length: 5001}, (_, index) => expense({id: index + 1}));
  const app = exportService([...records, expense({id: 6000, companyId: 99})], []);
  const result = await app.service('expenses', 21, 32, 'Europe/Rome', new URLSearchParams({dateQuick: 'all', ids: '1'}), now);
  assert.equal(result.count, 5001);
  assert.equal(result.csv.trimEnd().split('\r\n').length, 5002);
  assert.equal(app.queries[0].take, undefined);
  assert.equal(app.queries[0].where.id, undefined);
  assert.equal((await app.service('expenses', 21, 32, 'Europe/Rome', new URLSearchParams({dateQuick: 'all', merchant: 'Assente'}), now)).count, 0);
});

test('income search CSV keeps individual receipts and shares the selected-export format', async () => {
  const receipts = [income({id: 1, incomeType: 'CASH_REGISTER'}), income({id: 2, incomeType: 'CASH_REGISTER'}), income({id: 3, companyId: 99})];
  const app = exportService([], receipts);
  const result = await app.service('incomes', 21, 32, 'Europe/Rome', new URLSearchParams({dateQuick: 'all', fiscal: 'yes'}), now);
  assert.equal(result.count, 2);
  assert.equal(result.csv, serializers.incomesCsv(receipts.slice(0, 2)));
  assert.equal(result.csv.trimEnd().split('\r\n').length, 3);
});

test('bar export link preserves the search, ignores selection, and disables an empty result', () => {
  const SearchExportButton = load('components/SearchExportButton.tsx', {}).default;
  const button = SearchExportButton({entity: 'expenses', returnTo: encodeURIComponent('/expenses?merchant=Alfa&amount=%3E100&mobileList=1&ids=8&saved=1')});
  const url = new URL(button.props.href, 'http://localhost');
  assert.equal(url.pathname, '/api/exports/expenses');
  assert.equal(url.searchParams.get('merchant'), 'Alfa');
  assert.equal(url.searchParams.get('amount'), '>100');
  for (const key of ['mobileList', 'ids', 'saved']) assert.equal(url.searchParams.has(key), false);
  assert.equal(button.props.download, undefined);
  const disabled = SearchExportButton({entity: 'incomes', returnTo: '/incomes', disabled: true});
  assert.equal(disabled.props.href, undefined);
  assert.equal(disabled.props['aria-disabled'], 'true');
});

function endpointSetup(denied = false, empty = false, fail = false) {
  const calls: any[] = [];
  const queries: any[] = [];
  const api = load('app/api/exports/[entity]/route.ts', {
    '@/lib/auth': {workspaceOperationalRoles: ['OWNER', 'ADMIN', 'ACCOUNTANT'], getWorkspaceApiAccess: async () => denied ? {ok: false, error: 'Permessi insufficienti', status: 403} : {ok: true, current: {workspace: {id: 21}, company: {id: 32, timeZone: 'Europe/Rome'}}}},
    '@/lib/search-export': {searchExportCsv: async (...args: any[]) => {calls.push(args); if (fail) throw new Error('DB'); return {count: empty ? 0 : 2, csv: 'CSV ricerca'};}},
    '@/lib/prisma': {prisma: {expense: {findMany: async (query: any) => {queries.push(query); return [expense()];}}, income: {findMany: async (query: any) => {queries.push(query); return [income()];}}}},
  });
  return {calls, queries, get: (entity: string, query = '') => api.GET(new Request(`http://localhost/api/exports/${entity}?${query}`), {params: Promise.resolve({entity})}), post: (entity: string, ids: number[]) => {
    const data = new FormData(); ids.forEach(id => data.append('ids', String(id)));
    return api.POST(new Request(`http://localhost/api/exports/${entity}`, {method: 'POST', body: data}), {params: Promise.resolve({entity})});
  }};
}

test('GET exports the search with workspace/company permissions; POST remains selected-only', async () => {
  for (const entity of ['expenses', 'incomes']) {
    const app = endpointSetup();
    const response = await app.get(entity, 'dateQuick=all&amount=%3E100&ids=99');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type')!, /text\/csv/);
    assert.equal(await response.text(), 'CSV ricerca');
    assert.equal(app.calls[0][0], entity);
    assert.equal(app.calls[0][1], 21);
    assert.equal(app.calls[0][2], 32);
    assert.equal(app.calls[0][3], 'Europe/Rome');
    assert.equal(app.calls[0][4].get('amount'), '>100');
    const selected = await app.post(entity, [1]);
    assert.equal(selected.status, 200);
    assert.equal(app.queries[0].where.companyId, 32);
    assert.equal(app.queries[0].where.workspaceId, 21);
    assert.equal(app.queries[0].where.id.in.join(','), '1');
    assert.equal(app.calls.length, 1);
    assert.equal((await app.post(entity, [])).status, 400);
  }
  const denied = endpointSetup(true);
  assert.equal((await denied.get('expenses')).status, 403);
  assert.equal(denied.calls.length, 0);
});

test('empty or failed search export returns to the filtered list without a partial CSV', async () => {
  for (const [empty, fail, error] of [[true, false, 'export_empty'], [false, true, 'export_failed']] as const) {
    const response = await endpointSetup(false, empty, fail).get('incomes', 'dateQuick=all&customerQuick=Alfa&mobileList=1');
    assert.equal(response.status, 303);
    const url = new URL(response.headers.get('Location')!);
    assert.equal(url.pathname, '/incomes');
    assert.equal(url.searchParams.get('customerQuick'), 'Alfa');
    assert.equal(url.searchParams.get('mobileList'), '1');
    assert.equal(url.searchParams.get('error'), error);
  }
});
