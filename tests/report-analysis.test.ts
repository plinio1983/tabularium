import assert from 'node:assert/strict';
import test from 'node:test';
import {buildPeriodReport} from '../lib/reports';
import {buildReportAnalysis, reportChartMonthHref} from '../lib/report-analysis';

const periods = [7, 8, 9].map(month => ({year: 2026, month}));
const incomes = [{id: 1, amount: 300, isFiscal: true, vatRate: 0, billingYear: 2026, billingMonth: 7,
  salesChannelId: 1, salesChannelRef: {name: 'Vendite'},
  credits: [{amount: 100, creditDate: new Date('2026-07-01T00:30:00Z')}, {amount: 200, creditDate: new Date('2026-10-10T12:00:00Z')}]}];
const expenses = [{id: 1, amount: 120, isDeclared: true, expenseType: 'STANDARD', vatRate: 0,
  year: 2026, month: 8, categoryId: 1, category: {name: 'Servizi'},
  payments: [{amount: 40, paymentDate: new Date('2026-07-01')}, {amount: 80, paymentDate: new Date('2026-10-01')}]}];

for (const timeZone of ['Europe/Rome', 'America/New_York']) {
  for (const mode of ['overall', 'fiscal'] as const) {
    test(`grafici riconciliati con il report ${mode} in ${timeZone}`, () => {
      const report = buildPeriodReport(periods, incomes, expenses, mode, timeZone);
      const charts = buildReportAnalysis(report, timeZone);
      assert.equal(charts.incomeTrend.total, report.totals.totalRevenue);
      assert.equal(charts.expenseTrend.total, report.totals.totalExpenses);
      assert.equal(charts.composition.reduce((sum, row) => sum + row.total, 0), report.totals.totalExpenses);
      for (const month of report.monthlyBreakdown) {
        assert.equal(charts.incomeTrend.months[month.month - 1].total, month.totals.incassoTotale);
        assert.equal(charts.expenseTrend.months[month.month - 1].total, month.totals.speseTotali);
      }
    });
  }
}

test('il dettaglio mensile mantiene modalità e ritorno al report selezionato', () => {
  const returnTo = '/months/2026/7?period=quarter&quarter=3&mode=fiscal';
  const url = new URL(reportChartMonthHref('2026-08-01', {type: 'quarter', quarter: 3, mode: 'fiscal', returnTo}), 'http://localhost');
  assert.equal(url.pathname, '/months/2026/8');
  assert.equal(url.searchParams.get('mode'), 'fiscal');
  assert.equal(url.searchParams.get('returnTo'), returnTo);
});
