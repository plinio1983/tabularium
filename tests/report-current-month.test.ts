import assert from 'node:assert/strict';
import test from 'node:test';
import {selectReportPeriods, reportCurrentMonthHref} from '../lib/report-period-selection';
import {buildPeriodReport, completedReportPeriods} from '../lib/reports';
import {buildReportAnalysis} from '../lib/report-analysis';

const now = new Date('2026-09-28T12:00:00Z');

test('switch disponibile solo nell’anno e nel trimestre correnti, spento per default', () => {
  for (const type of ['year', 'quarter'] as const) {
    const selection = {year: 2026, month: 9, type};
    const off = selectReportPeriods(selection, now);
    const on = selectReportPeriods({...selection, includeCurrentMonth: true}, now);
    assert.equal(off.canIncludeCurrentMonth, true);
    assert.equal(off.includeCurrentMonth, false);
    assert.equal(off.reportPeriods.at(-1)?.month, 8);
    assert.equal(on.reportPeriods.at(-1)?.month, 9);
    assert.equal(on.reportPeriods.length, off.reportPeriods.length + 1);
    assert.deepEqual(off.reportPeriods, completedReportPeriods(off.selectedPeriods, now));
  }
  for (const selection of [
    {year: 2025, month: 9, type: 'year'}, {year: 2027, month: 9, type: 'year'},
    {year: 2026, month: 4, type: 'quarter'}, {year: 2026, month: 10, type: 'quarter'},
    {year: 2025, month: 9, type: 'quarter'}, {year: 2026, month: 9, type: 'month'},
  ] as const) {
    const off = selectReportPeriods(selection, now);
    const on = selectReportPeriods({...selection, includeCurrentMonth: true}, now);
    assert.equal(on.canIncludeCurrentMonth, false);
    assert.equal(on.includeCurrentMonth, false);
    assert.deepEqual(on.reportPeriods, off.reportPeriods);
  }
  assert.deepEqual(selectReportPeriods({year: 2026, month: 9, type: 'month'}, now).reportPeriods, [{year: 2026, month: 9}]);
});

test('gennaio e inizio trimestre: lo switch include il primo mese senza aggiungere mesi futuri', () => {
  for (const [month, type] of [[1, 'year'], [1, 'quarter'], [10, 'quarter']] as const) {
    const instant = new Date(`2026-${String(month).padStart(2, '0')}-15T12:00:00Z`);
    const selection = {year: 2026, month, type};
    assert.deepEqual(selectReportPeriods(selection, instant).reportPeriods, []);
    assert.deepEqual(selectReportPeriods({...selection, includeCurrentMonth: true}, instant).reportPeriods, [{year: 2026, month}]);
  }
});

test('visibilità e mese corrente seguono il fuso dell’azienda anche al cambio anno', () => {
  const boundary = new Date('2026-12-31T23:30:00Z');
  const selection = {year: 2027, month: 1, type: 'year' as const, includeCurrentMonth: true};
  const rome = selectReportPeriods(selection, boundary, 'Europe/Rome');
  const newYork = selectReportPeriods(selection, boundary, 'America/New_York');
  assert.equal(rome.canIncludeCurrentMonth, true);
  assert.deepEqual(rome.reportPeriods, [{year: 2027, month: 1}]);
  assert.equal(newYork.canIncludeCurrentMonth, false);
  assert.deepEqual(newYork.reportPeriods, []);
});

test('URL dello switch conserva periodo, modalità, confronto e ritorno', () => {
  const query = new URLSearchParams({period: 'quarter', mode: 'fiscal', compare: 'year', returnTo: '/?year=2026'});
  const on = new URL(reportCurrentMonthHref('/months/2026/7', query.toString(), true), 'https://example.test');
  assert.equal(on.searchParams.get('includeCurrentMonth'), '1');
  for (const [key, value] of query) assert.equal(on.searchParams.get(key), value);
  const off = new URL(reportCurrentMonthHref(on.pathname, on.search, false), on.origin);
  assert.equal(off.searchParams.has('includeCurrentMonth'), false);
  assert.equal(off.searchParams.toString(), query.toString());
});

for (const mode of ['overall', 'fiscal'] as const) {
  test(`totali, IVA, movimenti e grafici includono il mese corrente insieme: ${mode}`, () => {
    const incomes = [7, 8, 9, 10].map(month => ({id: month, amount: 122, isFiscal: true, vatRate: 22,
      billingYear: 2026, billingMonth: month, salesChannelId: 1, salesChannelRef: {name: 'Vendite'},
      credits: [{amount: 122, creditDate: new Date(`2026-${String(month).padStart(2, '0')}-15T12:00:00Z`)}]}));
    const expenses = [7, 8, 9, 10].map(month => ({id: month, amount: 61, isDeclared: true, affectsFiscalProfit: true,
      expenseType: 'STANDARD', vatRate: 22, year: 2026, month, categoryId: 1, category: {name: 'Servizi'},
      payments: [{amount: 61, paymentDate: new Date(`2026-${String(month).padStart(2, '0')}-15T00:00:00Z`)}]}));
    for (const includeCurrentMonth of [false, true]) {
      const {reportPeriods} = selectReportPeriods({year: 2026, month: 7, type: 'quarter', includeCurrentMonth}, now);
      const report = buildPeriodReport(reportPeriods, incomes, expenses, mode);
      const count = includeCurrentMonth ? 3 : 2;
      assert.equal(report.totals.totalRevenue, 122 * count);
      assert.equal(report.totals.totalExpenses, 61 * count);
      assert.equal(report.totals.vatToPay, 22 * count);
      assert.equal(report.totals.totalVatOnExpenses, 11 * count);
      assert.equal(report.incomeMovements.length, count);
      assert.equal(report.expenseMovements.length, count);
      const charts = buildReportAnalysis(report, 'Europe/Rome');
      assert.equal(charts.incomeTrend.total, report.totals.totalRevenue);
      assert.equal(charts.expenseTrend.total, report.totals.totalExpenses);
      assert.equal(charts.incomeTrend.months[8].total, includeCurrentMonth ? 122 : 0);
      assert.equal(charts.incomeTrend.months[9].total, 0);
    }
  });
}
