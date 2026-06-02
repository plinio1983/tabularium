import type { ReactNode } from 'react';
import Link from 'next/link';
import { AutoSubmitSelect } from '@/components/AutoSubmitSelect';
import { euro, moneyTone, monthName } from '@/lib/money';
import { getAccountingDashboardReport } from '@/lib/reports';

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
  overdueExpensesHref
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
      <SummaryMetric label="Entrate totali" value={totals.incassoTotale} highlight href={incomesHref} />
      <SummaryMetric label="Utile netto" value={totals.utileNetto} highlight />
      <SummaryMetric label="Utile fiscale" value={totals.utileFiscale} highlight />
      <SummaryMetric label="Spese totali" value={totals.speseTotali} highlight href={expensesHref} />
      <SummaryMetric label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0} href={unpaidExpensesHref} />
      <SummaryMetric label="Pagamenti scaduti" value={totals.fattureScadute} warning={totals.fattureScadute > 0} href={overdueExpensesHref} />
      <SummaryMetric label="Previsione saldo IVA" value={totals.debitoIva} highlight vat />
      <CountMetric label="Fatture non inviate" value={totals.fattureNonInviate} warning={totals.fattureNonInviate > 0} href={invoicesNotSentHref} />
      <CountMetric label="Fatture non ricevute" value={totals.fattureNonRicevute} warning={totals.fattureNonRicevute > 0} href={invoicesNotReceivedHref} />
    </div>
  </div>;
}

function MoneyCell({ value, highlight = false, tone = '' }: { value: number; highlight?: boolean; tone?: string }) {
  return <strong className={moneyTone(value, [highlight ? 'money-highlight' : '', tone].filter(Boolean).join(' '))}>{euro(value)}</strong>;
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

export default async function Dashboard({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQuarterIndex = Math.floor((currentMonth - 1) / 3);
  const fiscalMonthValue = Array.isArray(params.fiscalMonth) ? params.fiscalMonth[0] : params.fiscalMonth;
  const fiscalQuarterValue = Array.isArray(params.fiscalQuarter) ? params.fiscalQuarter[0] : params.fiscalQuarter;
  const annualYearValue = Array.isArray(params.annualYear) ? params.annualYear[0] : params.annualYear;
  const annualYear = parseYearSelection(annualYearValue, currentYear);
  const annualFallbackMonth = annualYear === currentYear ? currentMonth : 1;
  const annualFallbackQuarter = annualYear === currentYear ? currentQuarterIndex : 0;
  const rawSelectedMonth = parseMonthSelection(fiscalMonthValue, annualYear, annualFallbackMonth);
  const rawSelectedQuarter = parseQuarterSelection(fiscalQuarterValue, annualYear, annualFallbackQuarter);
  const selectedMonth = { ...rawSelectedMonth, year: annualYear };
  const selectedQuarter = { ...rawSelectedQuarter, year: annualYear };
  const reportYear = annualYear;
  const report = await getAccountingDashboardReport(reportYear, now, selectedMonth, selectedQuarter, annualYear);
  const fiscalMonth = report.currentFiscalMonth.periods[0];
  const monthExpensesHref = periodLink('/expenses', report.currentFiscalMonth.periods);
  const monthUnpaidExpensesHref = periodLink('/expenses', report.currentFiscalMonth.periods, { paymentStatus: 'not_complete' });
  const monthOverdueExpensesHref = periodLink('/expenses', report.currentFiscalMonth.periods, { paymentStatus: 'overdue' });
  const monthIncomesHref = periodLink('/incomes', report.currentFiscalMonth.periods);
  const monthInvoicesNotSentHref = periodLink('/incomes', report.currentFiscalMonth.periods, { fiscal: 'yes', invoiceStatusMode: 'not_emitted' });
  const monthInvoicesNotReceivedHref = periodLink('/expenses', report.currentFiscalMonth.periods, { declared: 'yes', invoiceStatusMode: 'not_received' });
  const quarterExpensesHref = periodLink('/expenses', report.currentFiscalQuarter.periods);
  const quarterUnpaidExpensesHref = periodLink('/expenses', report.currentFiscalQuarter.periods, { paymentStatus: 'not_complete' });
  const quarterOverdueExpensesHref = periodLink('/expenses', report.currentFiscalQuarter.periods, { paymentStatus: 'overdue' });
  const quarterIncomesHref = periodLink('/incomes', report.currentFiscalQuarter.periods);
  const quarterInvoicesNotSentHref = periodLink('/incomes', report.currentFiscalQuarter.periods, { fiscal: 'yes', invoiceStatusMode: 'not_emitted' });
  const quarterInvoicesNotReceivedHref = periodLink('/expenses', report.currentFiscalQuarter.periods, { declared: 'yes', invoiceStatusMode: 'not_received' });
  const monthOptionYear = selectedMonth.year || currentYear;
  const quarterOptionYear = selectedQuarter.year || currentYear;
  const yearOptions = Array.from(new Set([currentYear + 1, currentYear, currentYear - 1, currentYear - 2, reportYear, annualYear, monthOptionYear, quarterOptionYear])).sort((a, b) => b - a);
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({ year: monthOptionYear, month: index + 1 }));
  const quarterOptions = Array.from({ length: 4 }, (_, index) => ({ year: quarterOptionYear, quarterIndex: index }));

  return <div className="grid dashboard-grid">
    <div className="dashboard-actions toolbar-card dashboard-header-card">
      <div className="dashboard-title-block">
        <h2>Dashboard</h2>
        <p className="muted">Sintesi fiscale, incassi e spese.</p>
      </div>
      <div className="actions-row dashboard-top-actions">
        <Link className="btn primary-link" href="/expenses?new=1"><span className="btn-icon">＋</span> Spesa</Link>
        <Link className="btn primary-link" href="/incomes?new=1"><span className="btn-icon">＋</span> Incasso</Link>
        <Link className="btn primary-link" href="/suppliers?new=1"><span className="btn-icon">＋</span> Fornitore</Link>
      </div>
      <form className="period-selector dashboard-year-selector" method="get">
        <span className="selector-label">Anno fiscale</span>
        <AutoSubmitSelect name="annualYear" defaultValue={String(report.annualYear)} aria-label="Anno fiscale dashboard">
          {yearOptions.map(year => <option key={`top-annual-${year}`} value={year}>{year}</option>)}
        </AutoSubmitSelect>
      </form>
    </div>

    <div className="grid grid-2 dashboard-period-cards">
      <FiscalSummaryCard
        title="Mese fiscale"
        subtitle={`${monthName(fiscalMonth.month)} ${fiscalMonth.year}`}
        totals={report.currentFiscalMonth.totals}
        expensesHref={monthExpensesHref}
        unpaidExpensesHref={monthUnpaidExpensesHref}
        incomesHref={monthIncomesHref}
        invoicesNotSentHref={monthInvoicesNotSentHref}
        invoicesNotReceivedHref={monthInvoicesNotReceivedHref}
        overdueExpensesHref={monthOverdueExpensesHref}
        selector={<form className="period-selector" method="get"><input type="hidden" name="fiscalQuarter" value={quarterValue(selectedQuarter.year, selectedQuarter.quarterIndex)} /><input type="hidden" name="annualYear" value={report.annualYear} /><AutoSubmitSelect name="fiscalMonth" defaultValue={monthValue(fiscalMonth.year, fiscalMonth.month)} aria-label="Mese fiscale">
          {monthOptions.map(option => <option key={monthValue(option.year, option.month)} value={monthValue(option.year, option.month)}>{monthName(option.month)} {option.year}</option>)}
        </AutoSubmitSelect></form>}
      />
      <FiscalSummaryCard
        title="Trimestre fiscale"
        subtitle={fiscalQuarterLabel(report.currentFiscalQuarter.periods)}
        totals={report.currentFiscalQuarter.totals}
        expensesHref={quarterExpensesHref}
        unpaidExpensesHref={quarterUnpaidExpensesHref}
        incomesHref={quarterIncomesHref}
        invoicesNotSentHref={quarterInvoicesNotSentHref}
        invoicesNotReceivedHref={quarterInvoicesNotReceivedHref}
        overdueExpensesHref={quarterOverdueExpensesHref}
        selector={<form className="period-selector" method="get"><input type="hidden" name="fiscalMonth" value={monthValue(fiscalMonth.year, fiscalMonth.month)} /><input type="hidden" name="annualYear" value={report.annualYear} /><AutoSubmitSelect name="fiscalQuarter" defaultValue={quarterValue(selectedQuarter.year, selectedQuarter.quarterIndex)} aria-label="Trimestre fiscale">
          {quarterOptions.map(option => <option key={quarterValue(option.year, option.quarterIndex)} value={quarterValue(option.year, option.quarterIndex)}>T{option.quarterIndex + 1} {option.year}</option>)}
        </AutoSubmitSelect></form>}
      />
    </div>


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
            <th><span className="th-wrap">Incasso<br />Fiscale</span></th>
            <th><span className="th-wrap">Incasso<br />non fiscale</span></th>
            <th className="highlight-column"><span className="th-wrap">Entrate<br />totali</span></th>
            <th><span className="th-wrap">Spesa<br />Totale</span></th>
            <th><span className="th-wrap">Spese da<br />detrazione</span></th>
            <th className="highlight-column"><span className="th-wrap">Utile<br />netto</span></th>
            <th><span className="th-wrap">Spese non<br />saldate</span></th>
            <th><span className="th-wrap">Pagamenti<br />scaduti</span></th>
            <th className="highlight-column"><span className="th-wrap">Utile<br />fiscale</span></th>
            <th><span className="th-wrap">Debito<br />IVA</span></th>
          </tr></thead>
          <tbody>{report.months.map(m => <tr key={m.month}>
            <td><Link className="badge" href={`/months/${m.year}/${m.month}`}>{monthName(m.month)}</Link></td>
            <td><Link href={periodLink('/incomes', [{ year: m.year, month: m.month }], { fiscal: 'yes' })}><MoneyCell value={m.totals.incassoFiscale} /></Link></td>
            <td><Link href={periodLink('/incomes', [{ year: m.year, month: m.month }], { fiscal: 'no' })}><MoneyCell value={m.totals.incassoNonFiscale} /></Link></td>
            <td><Link href={periodLink('/incomes', [{ year: m.year, month: m.month }])}><MoneyCell value={m.totals.incassoTotale} highlight /></Link></td>
            <td><Link href={periodLink('/expenses', [{ year: m.year, month: m.month }])}><MoneyCell value={m.totals.speseTotali} /></Link></td>
            <td><Link href={periodLink('/expenses', [{ year: m.year, month: m.month }], { declared: 'yes' })}><MoneyCell value={m.totals.speseInDetrazione} /></Link></td>
            <td><MoneyCell value={m.totals.utileNetto} highlight /></td>
            <td><Link href={periodLink('/expenses', [{ year: m.year, month: m.month }], { paymentStatus: 'not_complete' })}><MoneyCell value={m.totals.nonSaldato} tone="money-warning" /></Link></td>
            <td><Link className={m.totals.fattureScaduteCount > 0 ? 'count-critical' : 'count-muted'} href={periodLink('/expenses', [{ year: m.year, month: m.month }], { paymentStatus: 'overdue' })}>{m.totals.fattureScaduteCount}</Link></td>
            <td><MoneyCell value={m.totals.utileFiscale} highlight /></td>
            <td><MoneyCell value={m.totals.debitoIva} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>

    <div className="card dashboard-annual-card">
      <div className="card-heading-row">
        <div>
          <h2>Conteggi annuali</h2>
          <p className="muted">Totali fiscali anno {report.annualYear}</p>
        </div>
      </div>
      <div className="annual-kpi-grid annual-totals-grid">
        <div className="kpi-box kpi-income"><div className="kpi-label">Entrate totali anno</div><div className={moneyTone(report.totals.incassoTotale, 'kpi-value')}>{euro(report.totals.incassoTotale)}</div><p className="kpi-help">Somma di tutte le entrate fiscali e non fiscali dell’anno selezionato.</p></div>
        <div className="kpi-box kpi-expense"><div className="kpi-label">Uscite anno</div><div className={moneyTone(report.totals.speseTotali, 'kpi-value')}>{euro(report.totals.speseTotali)}</div><p className="kpi-help">Totale delle uscite registrate nell’anno fiscale selezionato.</p></div>
        <div className="kpi-box kpi-net"><div className="kpi-label">Utile netto anno</div><div className={moneyTone(report.totals.utileNetto, 'kpi-value')}>{euro(report.totals.utileNetto)}</div><p className="kpi-help">Entrate totali meno uscite totali, IVA pagata e IVA prevista da saldare.</p></div>
        <div className="kpi-box kpi-fiscal"><div className="kpi-label">Utile fiscale anno</div><div className={moneyTone(report.totals.utileFiscale, 'kpi-value')}>{euro(report.totals.utileFiscale)}</div><p className="kpi-help">Entrate fiscali meno spese in detrazione, IVA pagata e IVA prevista da saldare.</p></div>
        <div className="kpi-box annual-tax-forecast kpi-tax"><div className="kpi-label">Previsione imposte anno</div><div className={moneyTone(report.totals.previsioneImposte, 'kpi-value money-warning')}>{euro(report.totals.previsioneImposte)}</div><p className="kpi-help">Calcolo provvisorio: utile fiscale positivo × aliquota fissa 30%.</p></div>
      </div>
    </div>

    <div className="dashboard-actions toolbar-card dashboard-actions-bottom">
      <div>
        <h2>Azioni rapide</h2>
        <p className="muted">Inserisci rapidamente una nuova operazione.</p>
      </div>
      <div className="actions-row">
        <Link className="btn primary-link" href="/expenses?new=1"><span className="btn-icon">＋</span> Inserisci spesa</Link>
        <Link className="btn primary-link" href="/incomes?new=1"><span className="btn-icon">＋</span> Inserisci incasso</Link>
        <Link className="btn primary-link" href="/suppliers?new=1"><span className="btn-icon">＋</span> Nuovo fornitore</Link>
      </div>
    </div>
  </div>;
}
