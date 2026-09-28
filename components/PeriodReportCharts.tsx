import IncomeSalesChannelTrendChart from './IncomeSalesChannelTrendChart';
import ExpenseCategoryTrendChart from './ExpenseCategoryTrendChart';
import {ExpenseCompositionChart, FiscalNonFiscalOverview, MonthlyProfitComparisonChart} from './ReportAnalysisCharts';
import {buildReportAnalysis, type PeriodAnalysisReport, type ReportChartPeriod} from '@/lib/report-analysis';

export default function PeriodReportCharts({report, timeZone, period}: {report: PeriodAnalysisReport; timeZone: string; period: ReportChartPeriod}) {
  const charts = buildReportAnalysis(report, timeZone);
  const monthsKey = report.periods.map(item => `${item.year}-${item.month}`).join(',');
  return <div className="grid period-report-analysis" aria-label="Analisi del periodo">
    <ExpenseCompositionChart data={charts.composition} total={report.totals.totalExpenses} incomeTotal={report.totals.totalRevenue}/>
    {report.mode === 'overall' ? <>
      <FiscalNonFiscalOverview totals={report.summary} year={report.year} periods={report.periods} periodType={period.type}/>
      <IncomeSalesChannelTrendChart key={`income-${report.year}-${period.type}-${period.quarter}-${period.mode}-${monthsKey}`} initialData={charts.incomeTrend} availableYears={[report.year]} reportPeriod={{...period, months: report.periods.map(item => item.month)}}/>
      <ExpenseCategoryTrendChart key={`expense-${report.year}-${period.type}-${period.quarter}-${period.mode}-${monthsKey}`} data={charts.expenseTrend} reportPeriod={{...period, months: report.periods.map(item => item.month)}}/>
    </> : null}
    <MonthlyProfitComparisonChart key={`${period.mode}-${monthsKey}`} months={report.monthlyBreakdown} year={report.year} mode={report.mode} returnTo={period.returnTo}/>
  </div>;
}
