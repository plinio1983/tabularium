import assert from 'node:assert/strict';
import test from 'node:test';
import {buildPeriodReport, completedReportPeriods, getPeriodReport} from '../lib/reports';
import {buildReportAnalysis} from '../lib/report-analysis';

const months = (year: number, values = Array.from({length: 12}, (_, i) => i + 1)) => values.map(month => ({year, month}));
const now = new Date('2026-09-21T12:00:00Z');

test('anno e trimestre correnti terminano ad agosto, i periodi storici restano completi', () => {
  assert.deepEqual(completedReportPeriods(months(2026), now), months(2026, [1,2,3,4,5,6,7,8]));
  assert.deepEqual(completedReportPeriods(months(2026, [7,8,9]), now), months(2026, [7,8]));
  assert.deepEqual(completedReportPeriods(months(2026, [4,5,6]), now), months(2026, [4,5,6]));
  assert.deepEqual(completedReportPeriods(months(2025), now), months(2025));
  assert.deepEqual(completedReportPeriods(months(2027), now), []);
});

test('inizio trimestre e gennaio non includono mesi ancora aperti', () => {
  assert.deepEqual(completedReportPeriods(months(2026, [10,11,12]), new Date('2026-10-15T12:00:00Z')), []);
  assert.deepEqual(completedReportPeriods(months(2026), new Date('2026-01-15T12:00:00Z')), []);
});

test('la chiusura del mese segue il fuso aziendale', () => {
  const boundary = new Date('2026-09-30T22:30:00Z');
  assert.deepEqual(completedReportPeriods(months(2026, [7,8,9]), boundary, 'Europe/Rome'), months(2026, [7,8,9]));
  assert.deepEqual(completedReportPeriods(months(2026, [7,8,9]), boundary, 'America/New_York'), months(2026, [7,8]));
});

for (const mode of ['overall', 'fiscal'] as const) {
  test(`totali, IVA e grafici escludono settembre e mesi futuri in modalità ${mode}`, () => {
    const periods = completedReportPeriods(months(2026, [7,8,9]), now);
    const incomes = [7,8,9,10].map(month => ({id: month, amount: 122, isFiscal: true, vatRate: 22,
      billingYear: 2026, billingMonth: month, salesChannelId: 1, salesChannelRef: {name: 'Vendite'},
      credits: [{amount: 122, creditDate: new Date(`2026-${String(month).padStart(2, '0')}-15T12:00:00Z`)}]}));
    const expenses = [7,8,9,10].map(month => ({id: month, amount: 61, isDeclared: true, affectsFiscalProfit: true,
      expenseType: 'STANDARD', vatRate: 22, year: 2026, month, categoryId: 1, category: {name: 'Servizi'},
      payments: [{amount: 61, paymentDate: new Date(`2026-${String(month).padStart(2, '0')}-15T00:00:00Z`)}]}));
    const report = buildPeriodReport(periods, incomes, expenses, mode);
    assert.equal(report.totals.totalRevenue, 244);
    assert.equal(report.totals.totalExpenses, 122);
    assert.equal(report.totals.vatToPay, 44);
    assert.equal(report.totals.totalVatOnExpenses, 22);
    assert.deepEqual(report.monthlyBreakdown.map(item => item.month), [7,8]);
    const charts = buildReportAnalysis(report, 'Europe/Rome');
    assert.equal(charts.incomeTrend.total, 244);
    assert.equal(charts.expenseTrend.total, 122);
    assert.equal(charts.incomeTrend.months[8].total, 0);
  });

  test(`periodo senza mesi conclusi restituisce un report vuoto senza interrogare il database: ${mode}`, async () => {
    const report = await getPeriodReport([], undefined, mode, undefined, 'Europe/Rome', {year: 2026, month: 1});
    assert.equal(report.year, 2026);
    assert.equal(report.totals.totalRevenue, 0);
    assert.equal(report.totals.totalExpenses, 0);
    assert.deepEqual(report.monthlyBreakdown, []);
    assert.deepEqual(report.incomes, []);
    assert.deepEqual(report.expenses, []);
  });
}
