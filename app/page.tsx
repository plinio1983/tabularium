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

function capitalizedMonthName(month: number) {
  const name = monthName(month);
  return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
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

function monthReportLink(year: number, month: number) {
  return `/months/${year}/${month}`;
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

function chartEuro(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(n);
}

const dashboardChartColors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0f766e', '#db2777', '#64748b'];

type DashboardPieItem = {
  name: string;
  code: string;
  total: number;
  href?: string;
};

function DashboardPieChart({
  title,
  description,
  badge,
  data,
  total,
  visualTotal = total,
  percentageTotal,
  centerLabel = 'Totale',
  centerValue,
  emptyMessage,
  remainderLabel,
  remainderName
}: {
  title: string;
  description: string;
  badge: ReactNode;
  data: DashboardPieItem[];
  total: number;
  visualTotal?: number;
  percentageTotal?: number;
  centerLabel?: string;
  centerValue?: string;
  emptyMessage: string;
  remainderLabel?: string;
  remainderName?: string;
}) {
  const chartTotal = data.reduce((sum, item) => sum + item.total, 0);
  const denominator = Math.max(visualTotal, chartTotal);
  const percentageDenominator = percentageTotal ?? denominator;
  let cursor = 0;
  const segments = data.map((item, index) => {
    const start = denominator ? (cursor / denominator) * 100 : 0;
    cursor += item.total;
    const end = denominator ? (cursor / denominator) * 100 : 0;
    return `${dashboardChartColors[index % dashboardChartColors.length]} ${start.toFixed(3)}% ${end.toFixed(3)}%`;
  });
  if (denominator > chartTotal) {
    segments.push(`#eef1f7 ${((chartTotal / denominator) * 100).toFixed(3)}% 100%`);
  }
  const background = segments.length ? `conic-gradient(${segments.join(', ')})` : undefined;

  return <div className="card expense-category-chart-card expense-impact-pie-card">
    <div className="card-heading-row">
      <div>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      <div className="text-right chart-total"><span className="badge">{badge}</span></div>
    </div>
    {data.length && denominator > 0 ? <div className="expense-impact-pie-layout">
      <div className="expense-impact-pie" style={{ background }} aria-label={title}>
        <div>
          <span>{centerLabel}</span>
          <strong className="main-label">{centerValue ?? chartEuro(total)}</strong>
          <span>{chartEuro(total.toFixed(2))}</span>
        </div>
      </div>
      <div className="expense-impact-pie-legend">
        {data.map((item, index) => {
          const percentage = percentageDenominator ? (item.total / percentageDenominator) * 100 : 0;
          const barWidth = Math.min(percentage, 100);
          const rowContent = <>
            <div className="expense-impact-pie-legend-row">
              <span className="expense-impact-pie-dot" style={{ background: dashboardChartColors[index % dashboardChartColors.length] }} />
              <div><strong className="hidden-mobile">{item.code}</strong><span>{item.name}</span></div>
              <div className="flex-grow justify-end"><strong className={moneyTone(item.total)}>{chartEuro(item.total)}</strong><small>{percentage.toFixed(1)}%</small></div>
            </div>
            <div className="expense-impact-pie-bar" style={{ width: `${barWidth.toFixed(1)}%`, background: `${dashboardChartColors[index % dashboardChartColors.length]}` }} />
          </>;
          return item.href
            ? <Link className="expense-impact-pie-row-wrap expense-impact-pie-row-link" href={item.href} key={`${item.code}-${item.name}`}>{rowContent}</Link>
            : <div className="expense-impact-pie-row-wrap" key={`${item.code}-${item.name}`}>{rowContent}</div>;
        })}
        {denominator > chartTotal && remainderLabel && remainderName ? <div className="expense-impact-pie-legend-row">
          <span className="expense-impact-pie-dot expense-impact-pie-dot-muted" />
          <div><strong>{remainderLabel}</strong><span>{remainderName}</span></div>
          <div><strong>{chartEuro(denominator - chartTotal)}</strong><small>{(((denominator - chartTotal) / percentageDenominator) * 100).toFixed(1)}%</small></div>
        </div> : null}
      </div>
    </div> : <p className="muted">{emptyMessage}</p>}
  </div>;
}

function groupedExpenseIncomeImpactData(data: Array<{ name: string; code: string; total: number }>, incomeTotal: number) {
  return incomeTotal > 0 ? data.reduce((items, item) => {
    const percentage = (item.total / incomeTotal) * 100;
    if (percentage >= 5) return [...items, item];
    const other = items.find(entry => entry.code === 'ALTRO');
    if (other) {
      other.total += item.total;
      return items;
    }
    return [...items, { name: 'Altro', code: 'ALTRO', total: item.total }];
  }, [] as Array<{ name: string; code: string; total: number }>).sort((a, b) => b.total - a.total) : data;
}

function ExpenseCategoryIncomeImpactChart({
  data,
  incomeTotal
}: {
  data: Array<{ name: string; code: string; total: number }>;
  incomeTotal: number;
}) {
  const groupedData = groupedExpenseIncomeImpactData(data, incomeTotal);
  const expenseTotal = groupedData.reduce((sum, item) => sum + item.total, 0);
  return <DashboardPieChart
    title="Impatto spese su incasso totale"
    description="Percentuale di ogni categoria spese rispetto alle entrate totali dell’anno fiscale."
    badge={<>Incasso {chartEuro(incomeTotal)}</>}
    data={groupedData}
    total={expenseTotal}
    visualTotal={Math.max(incomeTotal, expenseTotal)}
    percentageTotal={incomeTotal}
    centerLabel="Spese"
    centerValue={incomeTotal ? `${((expenseTotal / incomeTotal) * 100).toFixed(1)}%` : '0%'}
    emptyMessage="Nessun incasso disponibile per calcolare l’impatto percentuale."
    remainderLabel="RESTO"
    remainderName="Incasso non assorbito"
  />;
}

function IncomeBreakdownChart({ title, description, data }: { title: string; description: string; data: Array<{ name: string; code: string; total: number }> }) {
  const total = data.reduce((sum, item) => sum + item.total, 0);
  return <DashboardPieChart
    title={title}
    description={description}
    badge={<>Totale {chartEuro(total)}</>}
    data={data}
    total={total}
    centerLabel="Entrate"
    emptyMessage="Nessun incasso presente per l’anno selezionato."
  />;
}

function NetProfitByIncomeChannelChart({
  data,
  profit,
  incomeTotal,
  year,
  label
}: {
  data: Array<{ name: string; code: string; total: number }>;
  profit: number;
  incomeTotal: number;
  year: number;
  label: 'netto' | 'fiscale';
}) {
  const positiveProfit = Math.max(profit, 0);
  const titleLabel = `Utile ${label}`;
  const allocatedData = incomeTotal > 0
    ? data.map(item => ({
      ...item,
      total: positiveProfit * (item.total / incomeTotal)
    })).filter(item => item.total > 0)
    : [];

  return <DashboardPieChart
    title={`${titleLabel} per canale e categoria`}
    description={`${titleLabel} ripartito in proporzione agli incassi per canale vendita e categoria nell’anno fiscale ${year}.`}
    badge={<>{titleLabel} {chartEuro(profit)}</>}
    data={allocatedData}
    total={positiveProfit}
    centerLabel={titleLabel}
    emptyMessage={`Nessun utile ${label} positivo disponibile per la ripartizione.`}
  />;
}

function MonthlyNonFiscalRatioChart({
  months,
  year
}: {
  months: Array<{ year: number; month: number; totals: any }>;
  year: number;
}) {
  const totalIncome = months.reduce((sum, month) => sum + month.totals.incassoTotale, 0);
  const totalNonFiscalExpenses = months.reduce((sum, month) => sum + month.totals.usciteNonFiscali, 0);
  const totalNonFiscalIncomes = months.reduce((sum, month) => sum + month.totals.incassoNonFiscale, 0);
  const expenseYearPercentage = totalIncome ? (totalNonFiscalExpenses / totalIncome) * 100 : 0;
  const incomeYearPercentage = totalIncome ? (totalNonFiscalIncomes / totalIncome) * 100 : 0;

  return <section className="card monthly-non-fiscal-chart-card" aria-labelledby="monthly-non-fiscal-chart-title">
    <div className="card-heading-row">
      <div>
        <h2 id="monthly-non-fiscal-chart-title">Rapporto spese e incassi non fiscali su incasso totale per mese</h2>
        <p className="muted">Percentuali mensili calcolate sull’incasso totale da inizio anno {year}.</p>
      </div>
      <div className="text-right chart-total">
        <span className="badge">Spese {expenseYearPercentage.toFixed(1)}% · Incassi {incomeYearPercentage.toFixed(1)}%</span>
      </div>
    </div>
    {months.length ? <div className="monthly-non-fiscal-chart-list">
      {months.map(month => {
        const incomeTotal = month.totals.incassoTotale;
        const nonFiscalExpense = month.totals.usciteNonFiscali;
        const nonFiscalIncome = month.totals.incassoNonFiscale;
        const expensePercentage = incomeTotal ? (nonFiscalExpense / incomeTotal) * 100 : 0;
        const incomePercentage = incomeTotal ? (nonFiscalIncome / incomeTotal) * 100 : 0;
        const expenseWidth = Math.min(expensePercentage, 100);
        const incomeWidth = Math.min(incomePercentage, 100);
        const expenseTone = nonFiscalExpensePercentTone(nonFiscalExpense, incomeTotal);
        const monthLabel = capitalizedMonthName(month.month);

        return <Link
          className="monthly-non-fiscal-chart-row"
          href={periodLink('/expenses', [{ year: month.year, month: month.month }], { declared: 'no' })}
          key={`${month.year}-${month.month}`}
        >
          <div className="monthly-non-fiscal-chart-month-row">
            <span className="monthly-non-fiscal-chart-month">{monthLabel}</span>
            <small>Incasso tot {chartEuro(incomeTotal)}</small>
          </div>
          <div className="monthly-non-fiscal-chart-top">
            <span>Spese n.f.</span>
            <small className={moneyTone(nonFiscalExpense)}>{chartEuro(nonFiscalExpense)}</small>
            <strong>{expensePercentage.toFixed(1)}%</strong>
          </div>
          <span className="monthly-non-fiscal-chart-bar-wrap" aria-label={`${monthLabel} spese non fiscali: ${expensePercentage.toFixed(1)}%`}>
            <span className={`monthly-non-fiscal-chart-bar monthly-non-fiscal-chart-expense-bar ${expenseTone}`} style={{ width: `${expenseWidth}%` }} />
          </span>
          <span className="monthly-non-fiscal-chart-bar-wrap" aria-label={`${monthLabel} incassi non fiscali: ${incomePercentage.toFixed(1)}%`}>
            <span className="monthly-non-fiscal-chart-bar monthly-non-fiscal-chart-income-bar" style={{ width: `${incomeWidth}%` }} />
          </span>
          <div className="monthly-non-fiscal-chart-bottom">
            <span>Incassi n.f.</span>
            <small className={moneyTone(nonFiscalIncome)}>{chartEuro(nonFiscalIncome)}</small>
            <strong>{incomePercentage.toFixed(1)}%</strong>
          </div>
        </Link>;
      })}
    </div> : <p className="muted">Nessun mese disponibile per l’anno selezionato.</p>}
  </section>;
}

function MonthlyIncomeExpenseRatioChart({
  months,
  year
}: {
  months: Array<{ year: number; month: number; totals: any }>;
  year: number;
}) {
  const totalIncome = months.reduce((sum, month) => sum + month.totals.incassoTotale, 0);
  const totalExpenses = months.reduce((sum, month) => sum + month.totals.speseTotali, 0);
  const grossMargin = totalIncome - totalExpenses;
  const yearPercentage = totalIncome ? (grossMargin / totalIncome) * 100 : 0;
  const marginBarTone = (margin: number, percentage: number) => {
    if (margin < 0) return 'tone-critical';
    if (margin === 0) return 'money-zero';
    if (percentage < 25) return 'tone-warning';
    return '';
  };
  const marginBarClass = (margin: number, percentage: number) => [
    'monthly-non-fiscal-chart-bar',
    'monthly-income-expense-ratio-chart-bar',
    marginBarTone(margin, percentage),
    percentage <= 0 ? 'is-empty' : ''
  ].filter(Boolean).join(' ');
  const marginBarWidth = (percentage: number) => Math.min(Math.max(percentage, 0), 100);

  return <section className="card monthly-income-expense-ratio-chart-card" aria-labelledby="monthly-income-expense-ratio-chart-title">
    <div className="card-heading-row">
      <div>
        <h2 id="monthly-income-expense-ratio-chart-title">Margine lordo per mese</h2>
        <p className="muted">Percentuale del margine lordo rispetto alle entrate totali mensili da inizio anno {year}.</p>
      </div>
      <div className="text-right chart-total">
        <span className="badge">Anno {year}</span>
      </div>
    </div>
    {months.length ? <div className="monthly-non-fiscal-chart-list">
      <div className="monthly-income-expense-ratio-year-row">
        <div className="monthly-non-fiscal-chart-month-row">
          <span className="monthly-non-fiscal-chart-month">{year}</span>
          <div className="summary-text">
            <small>Entrate &nbsp;</small> <strong>{chartEuro(totalIncome)}</strong>
            &nbsp;&nbsp;&nbsp;&nbsp;
            <small>Uscite &nbsp;</small> <strong>{chartEuro(totalExpenses)}</strong>
          </div>
        </div>
        <div className="monthly-income-expense-ratio-chart-values">
          <span>Margine lordo annuale</span>
          <small className={moneyTone(grossMargin)}>{chartEuro(grossMargin)}</small>
          <strong className="text-accent">{yearPercentage.toFixed(1)}%</strong>
        </div>
        <span className="monthly-non-fiscal-chart-bar-wrap" aria-label={`${year} margine lordo su entrate: ${yearPercentage.toFixed(1)}%`}>
          <span className={marginBarClass(grossMargin, yearPercentage)} style={{ width: `${marginBarWidth(yearPercentage)}%` }} />
        </span>
      </div>
      {months.map(month => {
        const incomeTotal = month.totals.incassoTotale;
        const expenseTotal = month.totals.speseTotali;
        const monthGrossMargin = incomeTotal - expenseTotal;
        const percentage = incomeTotal ? (monthGrossMargin / incomeTotal) * 100 : 0;
        const width = marginBarWidth(percentage);
        const monthLabel = capitalizedMonthName(month.month);

        return <Link
          className="monthly-income-expense-ratio-chart-row"
          href={monthReportLink(month.year, month.month)}
          key={`${month.year}-${month.month}`}>
          <div className="monthly-non-fiscal-chart-month-row">
            <span className="monthly-non-fiscal-chart-month">{monthLabel}</span>
            <small>Entrate {chartEuro(incomeTotal)}</small>
          </div>
          <div className="monthly-income-expense-ratio-chart-values">
            <span>Margine lordo</span>
            <small className={moneyTone(monthGrossMargin)}>{chartEuro(monthGrossMargin)}</small>
            <strong>{percentage.toFixed(1)}%</strong>
          </div>
          <span className="monthly-non-fiscal-chart-bar-wrap" aria-label={`${monthLabel} margine lordo su entrate: ${percentage.toFixed(1)}%`}>
            <span className={marginBarClass(monthGrossMargin, percentage)} style={{ width: `${width}%` }} />
          </span>
        </Link>;
      })}
    </div> : <p className="muted">Nessun mese disponibile per l’anno selezionato.</p>}
  </section>;
}

function MonthlyNetFiscalProfitRatioChart({
  months,
  year
}: {
  months: Array<{ year: number; month: number; totals: any }>;
  year: number;
}) {
  const totalNetProfit = months.reduce((sum, month) => sum + month.totals.utileNetto, 0);
  const totalFiscalProfit = months.reduce((sum, month) => sum + month.totals.utileFiscale, 0);
  const totalGrossMargin = months.reduce((sum, month) => sum + month.totals.utileLordo, 0);
  const marginRatioLabel = (value: number, grossMargin: number) => {
    if (!grossMargin) return value ? 'n.d.' : '0.0%';
    return `${((value / Math.abs(grossMargin)) * 100).toFixed(1)}%`;
  };
  const profitBarClass = (value: number, kind: 'net' | 'fiscal') => [
    'monthly-non-fiscal-chart-bar',
    'monthly-profit-ratio-chart-bar',
    `monthly-profit-ratio-chart-${kind}-bar`,
    value < 0 ? 'tone-critical' : '',
    value === 0 ? 'money-zero' : ''
  ].filter(Boolean).join(' ');
  const profitBarStyle = (value: number, grossMargin: number) => {
    if (!grossMargin || value === 0) return { left: '50%', width: '0%' };
    const width = Math.min(Math.max((Math.abs(value) / Math.abs(grossMargin)) * 50, 2), 50);
    return {
      left: value < 0 ? `${50 - width}%` : '50%',
      width: `${width}%`
    };
  };

  return <section className="card monthly-profit-ratio-chart-card" aria-labelledby="monthly-profit-ratio-chart-title">
    <div className="card-heading-row">
      <div>
        <h2 id="monthly-profit-ratio-chart-title">Rapporto utile netto / utile fiscale per mese</h2>
        <p className="muted">Percentuale di utile netto e utile fiscale sul margine lordo nell’anno {year}.</p>
      </div>
      <div className="text-right chart-total">
        <span className="badge">Anno {year}</span>
      </div>
    </div>
    {months.length ? <div className="monthly-non-fiscal-chart-list">
      <div className="monthly-income-expense-ratio-year-row monthly-profit-ratio-year-row">
        <div className="monthly-non-fiscal-chart-month-row">
          <span className="monthly-non-fiscal-chart-month">{year}</span>
          <div className="summary-text flex align-end">
            <small>Margine lordo &nbsp;</small> <strong className={moneyTone(totalGrossMargin)}>{chartEuro(totalGrossMargin)}</strong>
            &nbsp;&nbsp;&nbsp;&nbsp;
            <div>
              <small>Netto &nbsp;</small> <strong className={moneyTone(totalNetProfit)}>{chartEuro(totalNetProfit)}</strong>
              &nbsp;&nbsp;&nbsp;&nbsp;
              <small>Fiscale &nbsp;</small> <strong className={moneyTone(totalFiscalProfit)}>{chartEuro(totalFiscalProfit)}</strong>
            </div>
          </div>
        </div>
        <div className="monthly-income-expense-ratio-chart-values">
          <span>Rapporto annuale</span>
          <small>Netto {marginRatioLabel(totalNetProfit, totalGrossMargin)}</small>
          <strong className="text-accent">Fiscale {marginRatioLabel(totalFiscalProfit, totalGrossMargin)}</strong>
        </div>
        <span className="monthly-profit-ratio-bar-stack" aria-label={`${year} utile netto ${chartEuro(totalNetProfit)}, utile fiscale ${chartEuro(totalFiscalProfit)}, margine lordo ${chartEuro(totalGrossMargin)}`}>
          <span className="monthly-non-fiscal-chart-bar-wrap monthly-profit-ratio-bar-wrap">
            <span className={profitBarClass(totalNetProfit, 'net')} style={profitBarStyle(totalNetProfit, totalGrossMargin)} />
          </span>
          <span className="monthly-non-fiscal-chart-bar-wrap monthly-profit-ratio-bar-wrap">
            <span className={profitBarClass(totalFiscalProfit, 'fiscal')} style={profitBarStyle(totalFiscalProfit, totalGrossMargin)} />
          </span>
        </span>
      </div>
      {months.map(month => {
        const netProfit = month.totals.utileNetto;
        const fiscalProfit = month.totals.utileFiscale;
        const grossMargin = month.totals.utileLordo;
        const monthLabel = capitalizedMonthName(month.month);

        return <Link
          className="monthly-income-expense-ratio-chart-row monthly-profit-ratio-chart-row"
          href={monthReportLink(month.year, month.month)}
          key={`${month.year}-${month.month}`}>
          <div className="monthly-non-fiscal-chart-month-row">
            <span className="monthly-non-fiscal-chart-month">{monthLabel}</span>
            <small>Margine lordo {chartEuro(grossMargin)}</small>
          </div>
          <div className="monthly-income-expense-ratio-chart-values">
            <span>Utile netto</span>
            <small className={moneyTone(netProfit)}>{chartEuro(netProfit)}</small>
            <strong>{marginRatioLabel(netProfit, grossMargin)}</strong>
          </div>
          <span className="monthly-non-fiscal-chart-bar-wrap monthly-profit-ratio-bar-wrap" aria-label={`${monthLabel} utile netto: ${chartEuro(netProfit)} su margine lordo ${chartEuro(grossMargin)}`}>
            <span className={profitBarClass(netProfit, 'net')} style={profitBarStyle(netProfit, grossMargin)} />
          </span>
          <div className="monthly-income-expense-ratio-chart-values">
            <span>Utile fiscale</span>
            <small className={moneyTone(fiscalProfit)}>{chartEuro(fiscalProfit)}</small>
            <strong>{marginRatioLabel(fiscalProfit, grossMargin)}</strong>
          </div>
          <span className="monthly-non-fiscal-chart-bar-wrap monthly-profit-ratio-bar-wrap" aria-label={`${monthLabel} utile fiscale: ${chartEuro(fiscalProfit)} su margine lordo ${chartEuro(grossMargin)}`}>
            <span className={profitBarClass(fiscalProfit, 'fiscal')} style={profitBarStyle(fiscalProfit, grossMargin)} />
          </span>
        </Link>;
      })}
    </div> : <p className="muted">Nessun mese disponibile per l’anno selezionato.</p>}
  </section>;
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
        <span className="badge">Totale {chartEuro(total)}</span>
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
              <strong className={moneyTone(item.value)}>{chartEuro(item.value)}</strong>
              <small>{percentage.toFixed(1)}%</small>
            </span>
          </span>
          <span className="income-expense-chart-bar-wrap" aria-label={`${item.label}: ${chartEuro(item.value)}`}>
            <span className={`income-expense-chart-bar ${item.tone}`} style={{ width: `${width}%` }} />
          </span>

          <span className="income-expense-chart-value income-expense-chart-value-inline">
            <strong className={moneyTone(item.value)}>{chartEuro(item.value)}</strong>
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
  const nonFiscalExpenseChartMonths = report.months.filter(month => report.annualYear === currentYear ? month.month <= currentMonth : true);

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

    <div className="dashboard-report-charts">
      <div className="charts-grid">
        <IncomeBreakdownChart title="Entrate per canale e categoria" description={`Distribuzione degli incassi per canale vendita e categoria nell’anno fiscale ${report.annualYear}.`} data={report.incomesBySalesChannel} />
        <NetProfitByIncomeChannelChart data={report.incomesBySalesChannel} profit={report.totals.utileNetto} incomeTotal={report.totals.incassoTotale} year={report.annualYear} label="netto" />
        <NetProfitByIncomeChannelChart data={report.incomesBySalesChannel} profit={report.totals.utileFiscale} incomeTotal={report.totals.incassoTotale} year={report.annualYear} label="fiscale" />
        <ExpenseCategoryIncomeImpactChart data={report.expensesByCategory} incomeTotal={report.totals.incassoTotale} />
      </div>
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
          <tr><td>Imponibile</td><td><strong className={moneyTone(report.totals.imponibileIncassi)}>{euro(report.totals.imponibileIncassi)}</strong></td></tr>
          <tr><td>Entrate non fiscali</td><td><strong className={moneyTone(report.totals.incassoNonFiscale)}>{euro(report.totals.incassoNonFiscale)}</strong></td></tr>
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
      <div className="charts-grid">
        <MonthlyNonFiscalRatioChart months={nonFiscalExpenseChartMonths} year={report.annualYear} />
        <MonthlyIncomeExpenseRatioChart months={nonFiscalExpenseChartMonths} year={report.annualYear} />
        <MonthlyNetFiscalProfitRatioChart months={nonFiscalExpenseChartMonths} year={report.annualYear} />
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
