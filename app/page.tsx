import type { ReactNode } from 'react';
import Link from 'next/link';
import { AutoSubmitSelect } from '@/components/AutoSubmitSelect';
import { euro, moneyTone, monthName } from '@/lib/money';
import { fiscalQuarterMonthsByIndex, getAccountingDashboardReport, getOrderDateMonthSummary, getOrderDatePeriodSummary } from '@/lib/reports';
import DashboardFiscalAjax from '@/components/DashboardFiscalAjax';
import { requireWorkspace } from '@/lib/auth';

function fiscalQuarterLabel(periods: Array<{ year: number; month: number }>) {
  if (!periods.length) return '-';
  const first = periods[0];
  const last = periods[periods.length - 1];
  return `${monthName(first.month)} ${first.year} - ${monthName(last.month)} ${last.year}`;
}

function parseMonthSelection(value: string | undefined, fallbackYear: number, fallbackMonth: number) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return { year: fallbackYear, month: fallbackMonth };
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

function parseYearSelection(value: string | undefined, fallbackYear: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : fallbackYear;
}

function parseQuarterSelection(value: string | undefined, fallbackYear: number, fallbackQuarterIndex: number) {
  const match = value?.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return { year: fallbackYear, quarterIndex: fallbackQuarterIndex };
  return { year: Number(match[1]), quarterIndex: Number(match[2]) - 1 };
}

function monthValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function quarterValue(year: number, quarterIndex: number) {
  return `${year}-Q${quarterIndex + 1}`;
}
function periodRangeQuery(periods: Array<{ year: number; month: number }>) {
  if (!periods.length) return '';
  const first = periods[0];
  const last = periods[periods.length - 1];
  return new URLSearchParams({
    billingPeriodFrom: monthValue(first.year, first.month),
    billingPeriodTo: monthValue(last.year, last.month)
  }).toString();
}

function periodLink(path: '/expenses' | '/incomes', periods: Array<{ year: number; month: number }>, extra?: Record<string, string>) {
  const query = new URLSearchParams(periodRangeQuery(periods));
  Object.entries(extra ?? {}).forEach(([key, value]) => query.set(key, value));
  const qs = query.toString();
  return `${path}${qs ? `?${qs}` : ''}`;
}

function dateRangeForMonth(year: number, month: number) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  return {
    from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`,
    to: `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`
  };
}

function dateRangeLink(path: '/expenses' | '/incomes', year: number, month: number, extra?: Record<string, string>) {
  const range = dateRangeForMonth(year, month);
  const query = new URLSearchParams(path === '/expenses'
    ? { orderDateFrom: range.from, orderDateTo: range.to }
    : { creditDateFrom: range.from, creditDateTo: range.to });
  Object.entries(extra ?? {}).forEach(([key, value]) => query.set(key, value));
  return `${path}?${query.toString()}`;
}


function SummaryMetric({ label, value, highlight = false, warning = false, vat = false, href }: { label: string; value: number; highlight?: boolean; warning?: boolean; vat?: boolean; href?: string }) {
  const boxClass = ["summary-metric", href ? "summary-metric-link" : "", highlight ? "summary-metric-highlight" : "", warning ? "summary-metric-warning" : "", vat ? "summary-metric-vat" : ""].filter(Boolean).join(' ');
  const valueClass = [highlight ? 'money-highlight' : '', warning ? 'money-warning' : '', vat ? 'money-vat' : ''].filter(Boolean).join(' ');
  const content = <><span>{label}</span><strong className={moneyTone(value, valueClass)}>{euro(value)}</strong></>;
  return href ? <Link className={boxClass} href={href}>{content}</Link> : <div className={boxClass}>{content}</div>;
}

function CountMetric({ label, value, warning = false, href }: { label: string; value: number; warning?: boolean; href?: string }) {
  const boxClass = ["summary-metric", href ? "summary-metric-link" : "", warning ? "summary-metric-warning" : ""].filter(Boolean).join(' ');
  const content = <><span>{label}</span><strong className={warning ? 'money-warning' : ''}>{value}</strong></>;
  return href ? <Link className={boxClass} href={href}>{content}</Link> : <div className={boxClass}>{content}</div>;
}

function FiscalSummaryCard({
  title,
  subtitle,
  totals,
  selector,
  expensesHref,
  unpaidExpensesHref,
  incomesHref,
  invoicesNotSentHref,
  invoicesNotReceivedHref,
  overdueExpensesHref,
  fiscalOnly = false
}: {
  title: string;
  subtitle: string;
  totals: any;
  selector: ReactNode;
  expensesHref: string;
  unpaidExpensesHref: string;
  incomesHref: string;
  invoicesNotSentHref: string;
  invoicesNotReceivedHref: string;
  overdueExpensesHref: string;
  fiscalOnly?: boolean;
}) {
  return <div className="card fiscal-summary-card">
    <div className="card-heading-row">
      <div>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
      </div>
      {selector}
    </div>
    <div className="summary-metrics-grid summary-metrics-grid-priority fiscal-summary-metrics-ordered">
      {fiscalOnly ? <>
        <SummaryMetric label="Entrate fiscali" value={totals.incassoFiscale} highlight href={incomesHref} />
        <SummaryMetric label="Imponibile" value={totals.imponibileIncassi} highlight />
        <SummaryMetric label="Uscite fiscali" value={totals.usciteFiscali} highlight href={expensesHref} />
        <SummaryMetric label="Utile fiscale" value={totals.utileFiscale} highlight />
        <SummaryMetric label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0} href={unpaidExpensesHref} />
        <CountMetric label="Pagamenti scaduti" value={totals.fattureScaduteCount} warning={totals.fattureScaduteCount > 0} href={overdueExpensesHref} />
        <SummaryMetric label="Previsione saldo IVA" value={totals.debitoIva} highlight vat />
        <CountMetric label="Fatture non inviate" value={totals.fattureNonInviate} warning={totals.fattureNonInviate > 0} href={invoicesNotSentHref} />
        <CountMetric label="Fatture non ricevute" value={totals.fattureNonRicevute} warning={totals.fattureNonRicevute > 0} href={invoicesNotReceivedHref} />
      </> : <>
        <SummaryMetric label="Entrate totali" value={totals.incassoTotale} highlight href={incomesHref} />
        <SummaryMetric label="Utile netto" value={totals.utileNetto} highlight />
        <SummaryMetric label="Utile fiscale" value={totals.utileFiscale} highlight />
        <SummaryMetric label="Spese totali" value={totals.speseTotali} highlight href={expensesHref} />
        <SummaryMetric label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0} href={unpaidExpensesHref} />
        <SummaryMetric label="Pagamenti scaduti" value={totals.fattureScadute} warning={totals.fattureScadute > 0} href={overdueExpensesHref} />
        <SummaryMetric label="Previsione saldo IVA" value={totals.debitoIva} highlight vat />
        <CountMetric label="Fatture non inviate" value={totals.fattureNonInviate} warning={totals.fattureNonInviate > 0} href={invoicesNotSentHref} />
        <CountMetric label="Fatture non ricevute" value={totals.fattureNonRicevute} warning={totals.fattureNonRicevute > 0} href={invoicesNotReceivedHref} />
      </>}
    </div>
  </div>;
}


function MonthlyTrendCard({
  title,
  subtitle,
  totals,
  selector,
  expensesHref,
  unpaidExpensesHref,
  incomesHref,
  overdueExpensesHref
}: {
  title: string;
  subtitle: string;
  totals: any;
  selector: ReactNode;
  expensesHref: string;
  unpaidExpensesHref: string;
  incomesHref: string;
  overdueExpensesHref: string;
}) {
  return <div className="card fiscal-summary-card monthly-trend-card">
    <div className="card-heading-row">
      <div>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
      </div>
      {selector}
    </div>
    <div className="summary-metrics-grid summary-metrics-grid-priority fiscal-summary-metrics-ordered">
      <SummaryMetric label="Entrate totali" value={totals.incassoTotale} highlight href={incomesHref} />
      <SummaryMetric label="Uscite totali" value={totals.speseTotali} highlight href={expensesHref} />
      <SummaryMetric label="Utile netto" value={totals.utileNetto} highlight />
      <SummaryMetric label="Spese non fiscali" value={totals.usciteNonFiscali} warning={totals.usciteNonFiscali > 0} href={expensesHref} />
      <SummaryMetric label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0} href={unpaidExpensesHref} />
      <CountMetric label="Pagamenti scaduti" value={totals.fattureScaduteCount} warning={totals.fattureScaduteCount > 0} href={overdueExpensesHref} />
    </div>
  </div>;
}

function MoneyCell({ value, highlight = false, tone = '' }: { value: number; highlight?: boolean; tone?: string }) {
  return <strong className={moneyTone(value, [highlight ? 'money-highlight' : '', tone].filter(Boolean).join(' '))}>{euro(value)}</strong>;
}

function PercentCell({ value, total, tone = '' }: { value: number; total: number; tone?: string }) {
  const percentage = total ? value / total : 0;
  const label = new Intl.NumberFormat('it-IT', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(percentage);
  if(percentage <= 0) {
    return <strong className={`badge muted ${tone}`}>{label}</strong>;
  }
  return <strong className={tone ? `badge color-badge ${tone}` : 'badge'}>{label}</strong>;
}

function nonFiscalExpensePercentTone(value: number, total: number) {
  const percentage = total ? value / total : 0;
  if (percentage > 0.45) return 'tone-critical';
  if (percentage > 0.25) return 'tone-warning';
  if (percentage === 0) return 'money-zero';
  return '';
}

function ExpensesByCategoryChart({ data }: { data: Array<{ name: string; code: string; total: number }> }) {
  const max = Math.max(...data.map(item => item.total), 0);
  const total = data.reduce((sum, item) => sum + item.total, 0);
  return <div className="card expense-category-chart-card">
    <div className="card-heading-row">
      <div>
        <h2>Grafico spese per categoria</h2>
        <p className="muted">Distribuzione delle spese sullo stesso anno fiscale del report mensile.</p>
      </div>
      <span className="badge">Totale {euro(total)}</span>
    </div>
    {data.length ? <div className="category-chart-list">
      {data.map(item => {
        const percentage = total ? (item.total / total) * 100 : 0;
        const width = max ? Math.max((item.total / max) * 100, 4) : 0;
        return <div className="category-chart-row" key={`${item.code}-${item.name}`}>
          <div className="category-chart-label"><strong>{item.code}</strong><span>{item.name}</span></div>
          <div className="category-chart-bar-wrap" aria-label={`${item.name}: ${euro(item.total)}`}>
            <div className="category-chart-bar" style={{ width: `${width}%` }} />
          </div>
          <div className="category-chart-value"><strong className={moneyTone(item.total)}>{euro(item.total)}</strong><small>{percentage.toFixed(1)}%</small></div>
        </div>;
      })}
    </div> : <p className="muted">Nessuna spesa presente per l’anno selezionato.</p>}
  </div>;
}

function IncomeBreakdownChart({ title, description, data }: { title: string; description: string; data: Array<{ name: string; code: string; total: number }> }) {
  const max = Math.max(...data.map(item => item.total), 0);
  const total = data.reduce((sum, item) => sum + item.total, 0);

  return <div className="card expense-category-chart-card embedded-chart-card income-chart">
    <div className="card-heading-row">
      <div>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      <span className="badge">Totale {euro(total)}</span>
    </div>
    {data.length ? <div className="category-chart-list">
      {data.map(item => {
        const percentage = total ? (item.total / total) * 100 : 0;
        const width = max ? Math.max((item.total / max) * 100, 4) : 0;
        return <div className="category-chart-row" key={`${item.code}-${item.name}`}>
          <div className="category-chart-label">
            <strong>{item.code}</strong>
            <span>{item.name}</span>
          </div>
          <div className="category-chart-bar-wrap" aria-label={`${item.name}: ${euro(item.total)}`}>
            <div className="category-chart-bar" style={{ width: `${width}%` }} />
          </div>
          <div className="category-chart-value"><strong className={moneyTone(item.total)}>{euro(item.total)}</strong><small>{percentage.toFixed(1)}%</small></div>
        </div>;
      })}
    </div> : <p className="muted">Nessun incasso presente per l’anno selezionato.</p>}
  </div>;
}

function IncomeExpenseBreakdownChart({
  totals,
  periods
}: {
  totals: any;
  periods: Array<{ year: number; month: number }>;
}) {
  const items = [
    {
      label: 'Entrate fiscali',
      value: totals.incassoFiscale,
      href: periodLink('/incomes', periods, { fiscal: 'yes' }),
      tone: 'income-fiscal'
    },
    {
      label: 'Entrate non fiscali',
      value: totals.incassoNonFiscale,
      href: periodLink('/incomes', periods, { fiscal: 'no' }),
      tone: 'income-non-fiscal'
    },
    {
      label: 'Uscite fiscali',
      value: totals.usciteFiscali,
      href: periodLink('/expenses', periods, { declared: 'yes' }),
      tone: 'expense-fiscal'
    },
    {
      label: 'Uscite non fiscali',
      value: totals.usciteNonFiscali,
      href: periodLink('/expenses', periods, { declared: 'no' }),
      tone: 'expense-non-fiscal'
    }
  ];
  const max = Math.max(...items.map(item => item.value), 0);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return <section className="card income-expense-chart-card" aria-labelledby="income-expense-chart-title">
    <div className="card-heading-row">
      <div className="card-title-wrap">
        <h2 id="income-expense-chart-title">Grafico entrate / uscite</h2>
        <p className="muted">Ripartizione fiscale e non fiscale anno {periods[0]?.year ?? ''}.</p>
      </div>
      <div>
        <span className="badge">Totale {euro(total)}</span>
      </div>
    </div>
    <div className="income-expense-chart-list">
      {items.map(item => {
        const percentage = total ? (item.value / total) * 100 : 0;
        const width = max ? Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0) : 0;

        return <Link className="income-expense-chart-row" href={item.href} key={item.label}>
          <span className={`income-expense-chart-marker ${item.tone}`} aria-hidden="true" />
          <span className="income-expense-chart-label">
            <span>{item.label}</span>
            <span className="income-expense-chart-value">
              <strong className={moneyTone(item.value)}>{euro(item.value)}</strong>
              <small>{percentage.toFixed(1)}%</small>
            </span>
          </span>
          <span className="income-expense-chart-bar-wrap" aria-label={`${item.label}: ${euro(item.value)}`}>
            <span className={`income-expense-chart-bar ${item.tone}`} style={{ width: `${width}%` }} />
          </span>

          <span className="income-expense-chart-value income-expense-chart-value-inline">
            <strong className={moneyTone(item.value)}>{euro(item.value)}</strong>
            <small>{percentage.toFixed(1)}%</small>
          </span>
        </Link>;
      })}
    </div>
  </section>;
}

export default async function Dashboard({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/');
  const params = (await searchParams) ?? {};
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQuarterIndex = Math.floor((currentMonth - 1) / 3);
  const trendMonthValue = Array.isArray(params.trendMonth) ? params.trendMonth[0] : params.trendMonth;
  const trendQuarterValue = Array.isArray(params.trendQuarter) ? params.trendQuarter[0] : params.trendQuarter;
  const fiscalMonthValue = Array.isArray(params.fiscalMonth) ? params.fiscalMonth[0] : params.fiscalMonth;
  const fiscalQuarterValue = Array.isArray(params.fiscalQuarter) ? params.fiscalQuarter[0] : params.fiscalQuarter;
  const annualYearValue = Array.isArray(params.annualYear) ? params.annualYear[0] : params.annualYear;
  const annualYear = parseYearSelection(annualYearValue, currentYear);
  const annualFallbackMonth = annualYear === currentYear ? currentMonth : 1;
  const annualFallbackQuarter = annualYear === currentYear ? currentQuarterIndex : 0;
  const rawSelectedTrendMonth = parseMonthSelection(trendMonthValue, annualYear, annualFallbackMonth);
  const rawSelectedTrendQuarter = parseQuarterSelection(trendQuarterValue, annualYear, annualFallbackQuarter);
  const rawSelectedMonth = parseMonthSelection(fiscalMonthValue, annualYear, annualFallbackMonth);
  const rawSelectedQuarter = parseQuarterSelection(fiscalQuarterValue, annualYear, annualFallbackQuarter);
  const selectedTrendMonth = { ...rawSelectedTrendMonth, year: annualYear };
  const selectedTrendQuarter = { ...rawSelectedTrendQuarter, year: annualYear };
  const selectedMonth = { ...rawSelectedMonth, year: annualYear };
  const selectedQuarter = { ...rawSelectedQuarter, year: annualYear };
  const reportYear = annualYear;
  const trendQuarterPeriods = fiscalQuarterMonthsByIndex(selectedTrendQuarter.year, selectedTrendQuarter.quarterIndex);
  const [report, monthlyTrendTotals, quarterlyTrendTotals] = await Promise.all([
    getAccountingDashboardReport(reportYear, now, selectedMonth, selectedQuarter, annualYear, current.workspace.id),
    getOrderDateMonthSummary(selectedTrendMonth.year, selectedTrendMonth.month, current.workspace.id),
    getOrderDatePeriodSummary(trendQuarterPeriods, current.workspace.id)
  ]);
  const fiscalMonth = report.currentFiscalMonth.periods[0];
  const trendExpensesHref = dateRangeLink('/expenses', selectedTrendMonth.year, selectedTrendMonth.month);
  const trendUnpaidExpensesHref = dateRangeLink('/expenses', selectedTrendMonth.year, selectedTrendMonth.month, { paymentStatus: 'not_complete' });
  const trendOverdueExpensesHref = dateRangeLink('/expenses', selectedTrendMonth.year, selectedTrendMonth.month, { paymentStatus: 'overdue' });
  const trendIncomesHref = dateRangeLink('/incomes', selectedTrendMonth.year, selectedTrendMonth.month);
  const monthExpensesHref = periodLink('/expenses', report.currentFiscalMonth.periods);
  const monthUnpaidExpensesHref = periodLink('/expenses', report.currentFiscalMonth.periods, { paymentStatus: 'not_complete', declared: 'yes' });
  const monthOverdueExpensesHref = periodLink('/expenses', report.currentFiscalMonth.periods, { paymentStatus: 'overdue', declared: 'yes' });
  const monthIncomesHref = periodLink('/incomes', report.currentFiscalMonth.periods);
  const monthInvoicesNotSentHref = periodLink('/incomes', report.currentFiscalMonth.periods, { fiscal: 'yes', invoiceStatusMode: 'not_emitted' });
  const monthInvoicesNotReceivedHref = periodLink('/expenses', report.currentFiscalMonth.periods, { declared: 'yes', invoiceStatusMode: 'not_received' });
  const quarterExpensesHref = periodLink('/expenses', report.currentFiscalQuarter.periods);
  const quarterUnpaidExpensesHref = periodLink('/expenses', report.currentFiscalQuarter.periods, { paymentStatus: 'not_complete', declared: 'yes' });
  const quarterOverdueExpensesHref = periodLink('/expenses', report.currentFiscalQuarter.periods, { paymentStatus: 'overdue', declared: 'yes' });
  const quarterIncomesHref = periodLink('/incomes', report.currentFiscalQuarter.periods);
  const quarterInvoicesNotSentHref = periodLink('/incomes', report.currentFiscalQuarter.periods, { fiscal: 'yes', invoiceStatusMode: 'not_emitted' });
  const quarterInvoicesNotReceivedHref = periodLink('/expenses', report.currentFiscalQuarter.periods, { declared: 'yes', invoiceStatusMode: 'not_received' });
  const monthOptionYear = selectedMonth.year || currentYear;
  const quarterOptionYear = selectedQuarter.year || currentYear;
  const yearOptions = Array.from(new Set([currentYear + 1, currentYear, currentYear - 1, currentYear - 2, reportYear, annualYear, selectedTrendMonth.year, selectedTrendQuarter.year, monthOptionYear, quarterOptionYear])).sort((a, b) => b - a);
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({ year: monthOptionYear, month: index + 1 }));
  const quarterOptions = Array.from({ length: 4 }, (_, index) => ({ year: quarterOptionYear, quarterIndex: index }));
  const annualPeriods = Array.from({ length: 12 }, (_, index) => ({ year: report.annualYear, month: index + 1 }));

  return <div className="grid dashboard-grid">
    <div className="dashboard-actions toolbar-card dashboard-header-card">
      <div className="dashboard-title-block">
        <h2>Dashboard</h2>
        <p className="muted">Sintesi fiscale, incassi e spese.</p>
      </div>
      <div className="actions-row dashboard-top-actions">
        <Link className="btn btn-lg btn-primary" href="/expenses?new=1"><span className="btn-icon">＋</span> Spesa</Link>
        <Link className="btn btn-lg btn-primary" href="/incomes?new=1"><span className="btn-icon">＋</span> Incasso</Link>
        {/*<Link className="btn btn-lg btn-primary" href="/suppliers?new=1"><span className="btn-icon">＋</span> Fornitore</Link>*/}
      </div>
      <form className="period-selector dashboard-year-selector" method="get">
        <span className="selector-label">Anno fiscale</span>
        <AutoSubmitSelect name="annualYear" defaultValue={String(report.annualYear)} aria-label="Anno fiscale dashboard">
          {yearOptions.map(year => <option key={`top-annual-${year}`} value={year}>{year}</option>)}
        </AutoSubmitSelect>
      </form>
    </div>

    <div className="grid grid-2 dashboard-period-cards">
      <DashboardFiscalAjax
        annualYear={report.annualYear}
        monthOptions={monthOptions}
        quarterOptions={quarterOptions}
        initialTrend={{ year: selectedTrendMonth.year, month: selectedTrendMonth.month, totals: monthlyTrendTotals }}
        initialTrendQuarter={{ periods: trendQuarterPeriods, totals: quarterlyTrendTotals }}
        initialMonth={{ periods: report.currentFiscalMonth.periods, totals: report.currentFiscalMonth.totals }}
        initialQuarter={{ periods: report.currentFiscalQuarter.periods, totals: report.currentFiscalQuarter.totals }}
      />
    </div>

    <article className="dashboard-statement-cards">
    <section className="card dashboard-statement-panel dashboard-annual-card">
      <div className="dashboard-statement-heading">
        <div>
          <h2>Conteggi annuali</h2>
          <p className="muted">Totali fiscali anno {report.annualYear}</p>
        </div>
      </div>
      <div className="dashboard-statement-body">
        <table className="dashboard-statement-table dashboard-annual-statement-table">
          <tbody>
          <tr className="dashboard-statement-result"><td>Entrate totali anno</td><td><span className="money-highlight"><strong className={moneyTone(report.totals.incassoTotale)}>{euro(report.totals.incassoTotale)}</strong></span></td></tr>
          <tr><td>Uscite anno</td><td><strong className={moneyTone(report.totals.speseTotali)}>{euro(report.totals.speseTotali)}</strong></td></tr>
          <tr className="dashboard-statement-result"><td>Utile netto anno</td><td><strong className={moneyTone(report.totals.utileNetto, 'money-highlight')}>{euro(report.totals.utileNetto)}</strong></td></tr>
          <tr><td>Entrate non fiscali</td><td><strong className={moneyTone(report.totals.incassoNonFiscale)}>{euro(report.totals.incassoNonFiscale)}</strong></td></tr>
          <tr><td>Imponibile</td><td><strong className={moneyTone(report.totals.imponibileIncassi)}>{euro(report.totals.imponibileIncassi)}</strong></td></tr>
          <tr><td>Uscite non fiscali</td><td><strong className={moneyTone(report.totals.usciteNonFiscali)}>{euro(report.totals.usciteNonFiscali)}</strong></td></tr>
          <tr className="dashboard-statement-result"><td>Utile fiscale anno</td><td><strong className={moneyTone(report.totals.utileFiscale, 'money-highlight')}>{euro(report.totals.utileFiscale)}</strong></td></tr>
          {/*<tr className="row-warning"><td>Previsione imposte anno</td><td><strong className={moneyTone(report.totals.previsioneImposte, 'money-warning')}>{euro(report.totals.previsioneImposte)}</strong></td></tr>*/}
          </tbody>
        </table>
      </div>
    </section>

    <IncomeExpenseBreakdownChart totals={report.totals} periods={annualPeriods} />
    </article>

    <div className="card dashboard-report-card">
      <div className="card-heading-row">
        <div>
          <h2>Report mensile {report.year}</h2>
          <p className="muted">Dati mensili per l’anno fiscale selezionato.</p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="dashboard-report-table">
          <thead><tr>
            <th><span className="th-wrap">Mese</span></th>
            <th className="highlight-column"><span className="th-wrap">Entrate<br />totali</span></th>
            <th><span className="th-wrap">Spesa<br />Totale</span></th>
            {/*<th><span className="th-wrap">Incasso<br />Fiscale</span></th>*/}
            <th className="highlight-column"><span className="th-wrap">Utile<br />netto</span></th>
            <th className="highlight-column"><span className="th-wrap">Utile<br />fiscale</span></th>
            <th><span className="th-wrap">Incasso<br />non fiscale</span></th>
            <th><span className="th-wrap">Spese non<br />fiscalizzate</span></th>
            <th><span className="th-wrap">Spese non<br />saldate</span></th>
            {/*<th><span className="th-wrap">Pagamenti<br />scaduti</span></th>*/}
            <th><span className="th-wrap">Debito<br />IVA</span></th>
          </tr></thead>
          <tbody>{report.months.map(m => <tr key={m.month}>
            <td><Link className="badge" href={`/months/${m.year}/${m.month}`}>{monthName(m.month)}</Link></td>
            <td><Link href={periodLink('/incomes', [{ year: m.year, month: m.month }])}><MoneyCell value={m.totals.incassoTotale} highlight /></Link></td>
            <td><Link href={periodLink('/expenses', [{ year: m.year, month: m.month }])}><MoneyCell value={m.totals.speseTotali} /></Link></td>
            <td className="money-value-col"><MoneyCell value={m.totals.utileNetto} highlight /></td>
            <td className="money-value-col"><MoneyCell value={m.totals.utileFiscale} highlight /></td>
            {/*<td><Link href={periodLink('/incomes', [{ year: m.year, month: m.month }], { fiscal: 'yes' })}><MoneyCell value={m.totals.incassoFiscale} /></Link></td>*/}
            <td><Link href={periodLink('/incomes', [{ year: m.year, month: m.month }], { fiscal: 'no' })}><PercentCell value={m.totals.incassoNonFiscale} total={m.totals.incassoTotale} /></Link></td>
            <td><Link href={periodLink('/expenses', [{ year: m.year, month: m.month }], { declared: 'no' })}><PercentCell value={m.totals.usciteNonFiscali} total={m.totals.speseTotali} tone={nonFiscalExpensePercentTone(m.totals.usciteNonFiscali, m.totals.speseTotali)} /></Link></td>
            <td><Link href={periodLink('/expenses', [{ year: m.year, month: m.month }], { paymentStatus: 'not_complete' })}><MoneyCell value={m.totals.nonSaldato} /></Link></td>
            {/*<td><Link className={m.totals.fattureScaduteCount > 0 ? 'count-critical' : 'count-muted'} href={periodLink('/expenses', [{ year: m.year, month: m.month }], { paymentStatus: 'overdue' })}>{m.totals.fattureScaduteCount}</Link></td>*/}
            <td><MoneyCell value={m.totals.debitoIva} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>

    <div className="dashboard-report-charts">
      <ExpensesByCategoryChart data={report.expensesByCategory} />
      <div className="charts-grid">
        <IncomeBreakdownChart title="Entrate per canale di vendita" description={`Distribuzione degli incassi nell’anno fiscale ${report.annualYear}.`} data={report.incomesBySalesChannel} />
        <IncomeBreakdownChart title="Grafico entrate dichiarate" description={`Distribuzione degli incassi fiscali e non fiscali nell’anno fiscale ${report.annualYear}.`} data={report.incomesByFiscalStatus} />
      </div>
    </div>

    <div className="dashboard-actions toolbar-card dashboard-actions-bottom">
      <div>
        <h2>Azioni rapide</h2>
        <p className="muted">Inserisci rapidamente una nuova operazione.</p>
      </div>
      <div className="actions-row">
        <Link className="btn btn-lg btn-primary" href="/expenses?new=1"><span className="btn-icon">＋</span> Spesa</Link>
        <Link className="btn btn-lg btn-primary" href="/incomes?new=1"><span className="btn-icon">＋</span> Incasso</Link>
        <Link className="btn btn-lg btn-primary" href="/suppliers?new=1"><span className="btn-icon">＋</span> Fornitore</Link>
      </div>
    </div>
  </div>;
}
