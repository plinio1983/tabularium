import IncomeSalesChannelTrendChart from './IncomeSalesChannelTrendChart';
import ExpenseCategoryTrendChart from './ExpenseCategoryTrendChart';
import {ExpenseCompositionChart, FiscalNonFiscalOverview, MonthlyProfitComparisonChart} from './ReportAnalysisCharts';
import {buildReportAnalysis, type PeriodAnalysisReport, type ReportChartPeriod} from '@/lib/report-analysis';

export default function PeriodReportCharts({report, timeZone, period}: {report: PeriodAnalysisReport; timeZone: string; period: ReportChartPeriod}) {
  const charts = buildReportAnalysis(report, timeZone);
  return <div className="grid period-report-analysis" aria-label="Analisi del periodo">
    <ExpenseCompositionChart data={charts.composition} total={report.totals.totalExpenses} incomeTotal={report.totals.totalRevenue}/>
    <FiscalNonFiscalOverview totals={report.summary} year={report.year} periods={report.periods}/>
    <IncomeSalesChannelTrendChart key={`income-${report.year}-${period.type}-${period.quarter}-${period.mode}`} initialData={charts.incomeTrend} availableYears={[report.year]} reportPeriod={period}/>
    <ExpenseCategoryTrendChart key={`expense-${report.year}-${period.type}-${period.quarter}-${period.mode}`} data={charts.expenseTrend} reportPeriod={period}/>
    <MonthlyProfitComparisonChart months={report.monthlyBreakdown} year={report.year} mode={report.mode} returnTo={period.returnTo}/>
  </div>;
}
