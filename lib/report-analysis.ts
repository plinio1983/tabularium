import type {getPeriodReport} from './reports';
import {aggregateIncomeChannelTrend} from './income-channel-trend';
import {aggregateExpenseCategoryTrend} from './expense-category-trend';
import {zonedMidnightUtc} from './company-time';

export type PeriodAnalysisReport = Awaited<ReturnType<typeof getPeriodReport>>;
export type ReportChartPeriod = {type: 'quarter' | 'year'; quarter: number; mode: 'overall' | 'fiscal'; returnTo: string};

/** Derive charts from the same scoped records and amounts as the report totals. */
export function buildReportAnalysis(report: PeriodAnalysisReport, timeZone: string) {
  const billingDate = (year: number, month: number) => zonedMidnightUtc(`${year}-${String(month).padStart(2, '0')}-01`, timeZone);
  const incomeRecords = report.incomes.flatMap(income => {
    const channel = {salesChannelId: income.salesChannelId, salesChannelRef: income.salesChannelRef};
    return report.mode === 'fiscal'
      ? [{...channel, amount: income.amount, creditDate: billingDate(income.billingYear, income.billingMonth)}]
      : income.credits.map((credit: {amount: unknown; creditDate: Date}) => ({...channel, amount: credit.amount, creditDate: credit.creditDate}));
  });
  const expenseRecords = report.expenses.flatMap(expense => {
    const category = {categoryId: expense.categoryId, category: expense.category, expenseType: expense.expenseType};
    return report.mode === 'fiscal'
      ? [{...category, amount: expense.amount, receivedDate: billingDate(expense.year, expense.month)}]
      : expense.payments.map((payment: {amount: unknown; paymentDate: Date}) => ({
          ...category, amount: payment.amount,
          // Payment dates are civil dates stored at UTC midnight, not instants.
          receivedDate: zonedMidnightUtc(new Date(payment.paymentDate).toISOString().slice(0, 10), timeZone),
        }));
  });
  const incomeTrend = aggregateIncomeChannelTrend(incomeRecords, report.year, timeZone);
  const expenseTrend = aggregateExpenseCategoryTrend(expenseRecords, report.year, timeZone);
  return {incomeTrend, expenseTrend, composition: expenseTrend.channels.map(category => ({name: category.name, code: String(category.id), total: category.total}))};
}

export function reportChartMonthHref(from: string, period: ReportChartPeriod) {
  const [year, month] = from.split('-').map(Number);
  return `/months/${year}/${month}?mode=${period.mode}&returnTo=${encodeURIComponent(period.returnTo)}`;
}
