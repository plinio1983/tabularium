import assert from 'node:assert/strict';
import test from 'node:test';
import {matchesExpenseTask, matchesIncomeTask, parseExpenseTask, parseIncomeTask, summarizeDashboardTasks} from '../lib/dashboard-tasks';

const now = new Date('2026-09-11T12:00:00Z');
const timeZone = 'Europe/Rome';
const expense = (overrides = {}) => ({amount: 100, dueDate: new Date('2024-01-01'), isDeclared: true,
  invoiceStatus: 'IN_ATTESA', expenseType: 'STANDARD', payments: [] as Array<{amount: number}>, ...overrides});
const income = (overrides = {}) => ({amount: 100, isFiscal: true, invoiceStatus: 'NON_EMESSA', incomeType: 'STANDARD',
  credits: [] as Array<{amount: number}>, ...overrides});

test('pendenze: arretrati, rate parziali, fatture già pagate e incassi senza accrediti', () => {
  const expenses = [
    expense({payments: [{amount: 30}]}),
    expense({payments: [{amount: 100}]}),
    expense({dueDate: new Date('2026-09-11'), invoiceStatus: 'RICEVUTA'}),
    expense({dueDate: null, invoiceStatus: 'NON_PREVISTA'}),
    expense({isDeclared: false, invoiceStatus: 'NON_PREVISTA', amount: 40}),
  ];
  const incomes = [
    income({credits: [{amount: 25}]}),
    income({credits: [{amount: 100}]}),
    income({isFiscal: false, amount: 40}),
    income({invoiceStatus: 'EMESSA', amount: 20}),
    income({incomeType: 'CASH_REGISTER', credits: [{amount: 100}]}),
  ];
  const totals = summarizeDashboardTasks(expenses, incomes, now, timeZone);
  assert.deepEqual(totals.overdue, {count: 2, amount: 110});
  assert.deepEqual(totals.invoicesNotReceived, {count: 2, amount: 200});
  assert.deepEqual(totals.invoicesNotEmitted, {count: 2, amount: 200});
  assert.deepEqual(totals.uncredited, {count: 3, amount: 135});
  assert.equal(expenses.filter(item => matchesExpenseTask(item, 'overdue', now, timeZone)).length, totals.overdue.count);
  assert.equal(incomes.filter(item => matchesIncomeTask(item, 'uncredited')).length, totals.uncredited.count);
});

test('documenti esclusi e arrotondamenti degli accrediti', () => {
  for (const expenseType of ['VAT_SETTLEMENT', 'TAX_CONTRIBUTION', 'PAYROLL']) {
    assert.equal(matchesExpenseTask(expense({expenseType}), 'missing_invoice', now, timeZone), false);
  }
  assert.equal(matchesExpenseTask(expense({invoiceStatus: 'INVIATA_SDI'}), 'missing_invoice', now, timeZone), false);
  assert.equal(matchesIncomeTask(income({credits: [{amount: 99.999}]}), 'uncredited'), false);
  assert.equal(matchesIncomeTask(income({amount: 0}), 'uncredited'), false);
});

test('lo scaduto rispetta il giorno aziendale e non include le scadenze di oggi', () => {
  const instant = new Date('2026-09-10T23:30:00Z');
  const item = expense({dueDate: new Date('2026-09-10')});
  assert.equal(matchesExpenseTask(item, 'overdue', instant, 'Europe/Rome'), true);
  assert.equal(matchesExpenseTask(item, 'overdue', instant, 'America/New_York'), false);
});

test('filtri sconosciuti ignorati e prospetto vuoto con quattro conteggi a zero', () => {
  assert.equal(parseExpenseTask('uncredited'), null);
  assert.equal(parseIncomeTask('overdue'), null);
  assert.equal(parseExpenseTask('missing_invoice'), 'missing_invoice');
  assert.equal(parseIncomeTask('uncredited'), 'uncredited');
  for (const value of Object.values(summarizeDashboardTasks([], [], now, timeZone))) {
    assert.deepEqual(value, {count: 0, amount: 0});
  }
});

test('scorciatoie dashboard: filtri standard modificabili, tutti i periodi e lista mobile aperta', async () => {
  const {dashboardTaskHref, normalizeDashboardTaskParams} = await import('../lib/dashboard-tasks');
  const cases = [
    {href: dashboardTaskHref('expenses', 'overdue'), path: '/expenses', field: 'paymentStatus', value: 'overdue'},
    {href: dashboardTaskHref('expenses', 'missing_invoice'), path: '/expenses', field: 'invoiceStatus', value: 'not_received'},
    {href: dashboardTaskHref('incomes', 'missing_invoice'), path: '/incomes', field: 'invoiceStatus', value: 'not_emitted'},
    {href: dashboardTaskHref('incomes', 'uncredited'), path: '/incomes', field: 'creditStatus', value: 'not_complete'},
  ];
  for (const item of cases) {
    const url = new URL(item.href, 'https://example.test');
    assert.equal(url.pathname, item.path);
    assert.equal(url.searchParams.has('pending'), false);
    assert.equal(url.searchParams.get('dateQuick'), 'all');
    assert.equal(url.searchParams.get('mobileList'), '1');
    assert.equal(url.searchParams.get(item.field), item.value);
    // Changing a standard filter must remove the restriction from the dashboard.
    url.searchParams.delete(item.field);
    assert.equal(normalizeDashboardTaskParams(item.path === '/expenses' ? 'expenses' : 'incomes', url.searchParams).has(item.field), false);
  }
});

test('vecchi link dashboard normalizzati conservando periodo e ricerca senza filtri nascosti', async () => {
  const {normalizeDashboardTaskParams} = await import('../lib/dashboard-tasks');
  const params = new URLSearchParams('pending=overdue&dateQuick=last_30_days&supplierQuick=energia&mobileList=1');
  const normal = normalizeDashboardTaskParams('expenses', params);
  assert.equal(normal.has('pending'), false);
  assert.equal(normal.get('paymentStatus'), 'overdue');
  assert.equal(normal.get('dateQuick'), 'last_30_days');
  assert.equal(normal.get('supplierQuick'), 'energia');
  assert.equal(normal.get('mobileList'), '1');
  assert.equal(params.get('pending'), 'overdue');
  const unknown = normalizeDashboardTaskParams('incomes', new URLSearchParams('pending=invalid'));
  assert.equal(unknown.has('pending'), false);
  assert.equal(unknown.has('creditStatus'), false);
});
