'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { euro, moneyTone, monthName } from '@/lib/money';

type Period = { year: number; month: number };
type MonthOption = { year: number; month: number };
type QuarterOption = { year: number; quarterIndex: number };
type Totals = {
  incassoTotale: number;
  incassoNonFiscale: number;
  speseTotali: number;
  utileNetto: number;
  usciteNonFiscali: number;
  nonSaldato: number;
  fattureScaduteCount: number;
  incassoFiscale: number;
  imponibileIncassi: number;
  usciteFiscali: number;
  utileFiscale: number;
  debitoIva: number;
  fattureNonInviate: number;
  fattureNonRicevute: number;
};

type FiscalState = {
  periods: Period[];
  totals: Totals;
};

type TrendState = {
  year: number;
  month: number;
  totals: Totals;
};

function monthValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function quarterValue(year: number, quarterIndex: number) {
  return `${year}-Q${quarterIndex + 1}`;
}

function fiscalQuarterLabel(periods: Period[]) {
  if (!periods.length) return '-';
  const first = periods[0];
  const last = periods[periods.length - 1];
  return `${monthName(first.month)} ${first.year} - ${monthName(last.month)} ${last.year}`;
}

function shortMonthName(month: number) {
  return new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(new Date(2026, month - 1, 1)).replace('.', '');
}

function compactQuarterLabel(periods: Period[]) {
  if (!periods.length) return '-';
  const first = periods[0];
  const last = periods[periods.length - 1];
  if (first.year === last.year) return `${shortMonthName(first.month)} - ${shortMonthName(last.month)} ${last.year}`;
  return `${shortMonthName(first.month)} ${first.year} - ${shortMonthName(last.month)} ${last.year}`;
}

function periodRangeQuery(periods: Period[]) {
  if (!periods.length) return '';
  const first = periods[0];
  const last = periods[periods.length - 1];
  return new URLSearchParams({
    billingPeriodFrom: monthValue(first.year, first.month),
    billingPeriodTo: monthValue(last.year, last.month)
  }).toString();
}

function periodLink(path: '/expenses' | '/incomes', periods: Period[], extra?: Record<string, string>) {
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

function monthReportLink(year: number, month: number) {
  return `/months/${year}/${month}?returnTo=${encodeURIComponent('/')}`;
}

function StatementMoneyRow({ label, value, highlight = false, warning = false, vat = false, href }: { label: string; value: number; highlight?: boolean; warning?: boolean; vat?: boolean; href?: string }) {
  const valueClass = [highlight ? 'money-highlight' : '', warning ? 'money-warning' : '', vat ? '' : ''].filter(Boolean).join(' ');
  const valueNode = <strong className={moneyTone(value, valueClass)}>{euro(value)}</strong>;

  const recordAddClass = warning ? `row-warning` : '';
  return <tr className={highlight ? `dashboard-statement-result ${recordAddClass}` : `${recordAddClass}`} title={valueClass}>
    <td>{label}</td>
    <td>{href ? <Link href={href}>{valueNode}</Link> : valueNode}</td>
  </tr>;
}

function StatementCountRow({ label, value, warning = false, href }: { label: string; value: number; warning?: boolean; href?: string }) {
  const valueNode = <strong className={warning ? 'money-warning' : ''}>{value}</strong>;

  return <tr className={warning ? 'row-warning' : ''}>
    <td>{label}</td>
    <td>{href ? <Link href={href}>{valueNode}</Link> : valueNode}</td>
  </tr>;
}

function updateUrlParam(key: 'trendMonth' | 'trendQuarter' | 'fiscalMonth' | 'fiscalQuarter', value: string, annualYear: number) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  url.searchParams.set('annualYear', String(annualYear));
  window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
}

function updateOverviewUrl(key: 'overviewMonth' | 'overviewQuarter', value: string, annualYear: number) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  url.searchParams.set('annualYear', String(annualYear));
  if (key === 'overviewMonth') {
    url.searchParams.delete('trendMonth');
    url.searchParams.delete('fiscalMonth');
  } else {
    url.searchParams.delete('trendQuarter');
    url.searchParams.delete('fiscalQuarter');
  }
  window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
}

function MonthlyTrendCard({
  state,
  selector,
  loading = false
}: {
  state: TrendState;
  selector: React.ReactNode;
  loading?: boolean;
}) {
  const totals = state.totals;
  const expensesHref = dateRangeLink('/expenses', state.year, state.month);
  const nonFiscalExpensesHref = dateRangeLink('/expenses', state.year, state.month, { declared: 'no' });
  const unpaidExpensesHref = dateRangeLink('/expenses', state.year, state.month, { paymentStatus: 'not_complete' });
  const incomesHref = dateRangeLink('/incomes', state.year, state.month);
  const nonFiscalIncomesHref = dateRangeLink('/incomes', state.year, state.month, { fiscal: 'no' });
  const overdueExpensesHref = dateRangeLink('/expenses', state.year, state.month, { paymentStatus: 'overdue' });

  return <section className={`card dashboard-statement-panel monthly-trend-card hidden-mobile ${loading ? 'is-loading' : ''}`}>
    <div className="dashboard-statement-heading">
      <div>
        <h2>Andamento mensile</h2>
        <p className="muted">{monthName(state.month)} {state.year}</p>
      </div>
      {selector}
    </div>
    <div className="dashboard-statement-body">
      <table className="dashboard-statement-table">
        <tbody>
          <StatementMoneyRow label="Entrate totali" value={totals.incassoTotale} href={incomesHref} highlight={true} />
          <StatementMoneyRow label="Uscite totali" value={totals.speseTotali} href={expensesHref} />
          <StatementMoneyRow label="Utile netto" value={totals.utileNetto} highlight />
          <StatementMoneyRow label="Incasso non fiscale" value={totals.incassoNonFiscale} href={nonFiscalIncomesHref} />
          <StatementMoneyRow label="Spese non fiscali" value={totals.usciteNonFiscali} warning={totals.usciteNonFiscali > 0} href={nonFiscalExpensesHref} />
          <StatementMoneyRow label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0} href={unpaidExpensesHref} />
          <StatementCountRow label="Pagamenti scaduti" value={totals.fattureScaduteCount} warning={totals.fattureScaduteCount > 0} href={overdueExpensesHref} />
        </tbody>
      </table>
    </div>
    <div className="dashboard-statement-actions">
      <Link className="btn btn-sm btn-ghost" href={monthReportLink(state.year, state.month)}>
        <span className="btn-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="2"/>
              <path d="M16 3v4M8 3v4M3 10h18"/>
              <path d="M8 14h2M14 14h2M8 17h2M14 17h2"/>
          </svg>
        </span>
        <span>Report mensile</span>
      </Link>
    </div>
  </section>;
}

function dateRangeForPeriods(periods: Period[]) {
  if (!periods.length) return null;
  const orderedPeriods = [...periods].sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
  const first = orderedPeriods[0];
  const last = orderedPeriods[orderedPeriods.length - 1];
  const from = new Date(first.year, first.month - 1, 1);
  const to = new Date(last.year, last.month, 0);
  return {
    from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`,
    to: `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`
  };
}

function dateRangeLinkForPeriods(path: '/expenses' | '/incomes', periods: Period[], extra?: Record<string, string>) {
  const range = dateRangeForPeriods(periods);
  if (!range) return path;
  const query = new URLSearchParams(path === '/expenses'
    ? { orderDateFrom: range.from, orderDateTo: range.to }
    : { creditDateFrom: range.from, creditDateTo: range.to });
  Object.entries(extra ?? {}).forEach(([key, value]) => query.set(key, value));
  return `${path}?${query.toString()}`;
}

function QuarterlyTrendCard({
  state,
  selector,
  loading = false
}: {
  state: FiscalState;
  selector: React.ReactNode;
  loading?: boolean;
}) {
  const totals = state.totals;
  const expensesHref = dateRangeLinkForPeriods('/expenses', state.periods);
  const nonFiscalExpensesHref = dateRangeLinkForPeriods('/expenses', state.periods, { declared: 'no' });
  const unpaidExpensesHref = dateRangeLinkForPeriods('/expenses', state.periods, { paymentStatus: 'not_complete' });
  const incomesHref = dateRangeLinkForPeriods('/incomes', state.periods);
  const nonFiscalIncomesHref = dateRangeLinkForPeriods('/incomes', state.periods, { fiscal: 'no' });
  const overdueExpensesHref = dateRangeLinkForPeriods('/expenses', state.periods, { paymentStatus: 'overdue' });

  return <section className={`card dashboard-statement-panel monthly-trend-card quarterly-trend-card ${loading ? 'is-loading' : ''}`}>
    <div className="dashboard-statement-heading">
      <div>
        <h2>Andamento trimestre</h2>
        <p className="muted">{compactQuarterLabel(state.periods)}</p>
      </div>
      {selector}
    </div>
    <div className="dashboard-statement-body">
      <table className="dashboard-statement-table">
        <tbody>
          <StatementMoneyRow label="Entrate totali" value={totals.incassoTotale} href={incomesHref} highlight={true} />
          <StatementMoneyRow label="Uscite totali" value={totals.speseTotali} href={expensesHref} />
          <StatementMoneyRow label="Utile netto" value={totals.utileNetto} highlight />
          <StatementMoneyRow label="Incasso non fiscale" value={totals.incassoNonFiscale} href={nonFiscalIncomesHref} />
          <StatementMoneyRow label="Spese non fiscali" value={totals.usciteNonFiscali} warning={totals.usciteNonFiscali > 0} href={nonFiscalExpensesHref} />
          <StatementMoneyRow label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0} href={unpaidExpensesHref} />
          <StatementCountRow label="Pagamenti scaduti" value={totals.fattureScaduteCount} warning={totals.fattureScaduteCount > 0} href={overdueExpensesHref} />
        </tbody>
      </table>
    </div>
  </section>;
}

function FiscalSummaryCard({
  title,
  subtitle,
  state,
  selector,
  loading = false
}: {
  title: string;
  subtitle: string;
  state: FiscalState;
  selector: React.ReactNode;
  loading?: boolean;
}) {
  const periods = state.periods;
  const totals = state.totals;
  const fiscalExpensesHref = periodLink('/expenses', periods, { declared: 'yes' });
  const unpaidExpensesHref = periodLink('/expenses', periods, { paymentStatus: 'not_complete', declared: 'yes' });
  const incomesHref = periodLink('/incomes', periods);
  const invoicesNotSentHref = periodLink('/incomes', periods, { fiscal: 'yes', invoiceStatusMode: 'not_emitted' });
  const invoicesNotReceivedHref = periodLink('/expenses', periods, { declared: 'yes', invoiceStatusMode: 'not_received' });
  const overdueExpensesHref = periodLink('/expenses', periods, { paymentStatus: 'overdue', declared: 'yes' });
  const reportPeriod = periods.length === 1 ? periods[0] : null;
  let specialClass = null;
  if(title === 'Mese fiscale') {
     specialClass = 'hidden-mobile';
  }
  return <section className={`card dashboard-statement-panel ${specialClass} ${loading ? 'is-loading' : ''}`}>
    <div className="dashboard-statement-heading">
      <div>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
      </div>
      {selector}
    </div>
    <div className="dashboard-statement-body">
      <table className="dashboard-statement-table">
        <tbody>
          <StatementMoneyRow label="Entrate fiscali" value={totals.incassoFiscale} href={incomesHref} />
          <StatementMoneyRow label="Imponibile" value={totals.imponibileIncassi} />
          <StatementMoneyRow label="Uscite fiscali" value={totals.usciteFiscali} href={fiscalExpensesHref} />
          <StatementMoneyRow label="Utile fiscale" value={totals.utileFiscale} highlight />
          <StatementMoneyRow label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0} href={unpaidExpensesHref} />
          <StatementMoneyRow label="Previsione saldo IVA" value={totals.debitoIva} vat highlight />
          <StatementCountRow label="Pagamenti scaduti" value={totals.fattureScaduteCount} warning={totals.fattureScaduteCount > 0} href={overdueExpensesHref} />
          <StatementCountRow label="Fatture non inviate" value={totals.fattureNonInviate} warning={totals.fattureNonInviate > 0} href={invoicesNotSentHref} />
          <StatementCountRow label="Fatture non ricevute" value={totals.fattureNonRicevute} warning={totals.fattureNonRicevute > 0} href={invoicesNotReceivedHref} />
        </tbody>
      </table>
    </div>
    {reportPeriod ? <div className="dashboard-statement-actions">
      <Link className="btn btn-sm btn-ghost" href={monthReportLink(reportPeriod.year, reportPeriod.month)}>
        <span className="btn-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2"/>
            <path d="M16 3v4M8 3v4M3 10h18"/>
            <path d="M8 14h2M14 14h2M8 17h2M14 17h2"/>
          </svg>
        </span>
        <span>Report mensile</span>
      </Link>
    </div> : null}
  </section>;
}

function PeriodOverviewCard({
  kind,
  overallState,
  fiscalState,
  selector,
  loading
}: {
  kind: 'month' | 'quarter';
  overallState: FiscalState;
  fiscalState: FiscalState;
  selector: React.ReactNode;
  loading: boolean;
}) {
  const periods = overallState.periods;
  const overall = overallState.totals;
  const fiscal = fiscalState.totals;
  const isMonth = kind === 'month';
  const title = isMonth ? 'Andamento mese' : 'Andamento trimestre';
  const subtitle = isMonth && periods[0]
    ? `${monthName(periods[0].month)} ${periods[0].year}`
    : compactQuarterLabel(periods);
  const overallExpensesHref = dateRangeLinkForPeriods('/expenses', periods);
  const overallIncomesHref = dateRangeLinkForPeriods('/incomes', periods);
  const nonFiscalExpensesHref = dateRangeLinkForPeriods('/expenses', periods, {declared: 'no'});
  const nonFiscalIncomesHref = dateRangeLinkForPeriods('/incomes', periods, {fiscal: 'no'});
  const overallUnpaidHref = dateRangeLinkForPeriods('/expenses', periods, {paymentStatus: 'not_complete'});
  const overallOverdueHref = dateRangeLinkForPeriods('/expenses', periods, {paymentStatus: 'overdue'});
  const fiscalExpensesHref = periodLink('/expenses', periods, {declared: 'yes'});
  const fiscalIncomesHref = periodLink('/incomes', periods);
  const fiscalUnpaidHref = periodLink('/expenses', periods, {paymentStatus: 'not_complete', declared: 'yes'});
  const fiscalOverdueHref = periodLink('/expenses', periods, {paymentStatus: 'overdue', declared: 'yes'});
  const invoicesNotSentHref = periodLink('/incomes', periods, {fiscal: 'yes', invoiceStatusMode: 'not_emitted'});
  const invoicesNotReceivedHref = periodLink('/expenses', periods, {declared: 'yes', invoiceStatusMode: 'not_received'});
  const first = periods[0];
  const reportHref = first
    ? `/months/${first.year}/${first.month}?mode=overall${isMonth ? '' : '&period=quarter'}&returnTo=${encodeURIComponent('/')}`
    : '/';

  return <section className={`card dashboard-period-overview ${loading ? 'is-loading' : ''}`}>
    <header className="dashboard-statement-heading dashboard-period-overview-heading">
      <div><h2>{title}</h2><p className="muted">{subtitle}</p></div>
      {selector}
    </header>
    <div className="dashboard-period-overview-groups">
      <section className="dashboard-period-overview-group is-overall" aria-label="Andamento complessivo">
        <div className="dashboard-period-overview-group-heading"><span>Movimenti effettivi</span><h3>Andamento complessivo</h3></div>
        <table className="dashboard-statement-table"><tbody>
          <StatementMoneyRow label="Entrate totali" value={overall.incassoTotale} href={overallIncomesHref} highlight />
          <StatementMoneyRow label="Uscite totali" value={overall.speseTotali} href={overallExpensesHref} />
          <StatementMoneyRow label="Utile netto" value={overall.utileNetto} highlight />
          <StatementMoneyRow label="Incasso non fiscale" value={overall.incassoNonFiscale} href={nonFiscalIncomesHref} />
          <StatementMoneyRow label="Spese non fiscali" value={overall.usciteNonFiscali} warning={overall.usciteNonFiscali > 0} href={nonFiscalExpensesHref} />
          <StatementMoneyRow label="Non saldato complessivo" value={overall.nonSaldato} warning={overall.nonSaldato > 0} href={overallUnpaidHref} />
          <StatementCountRow label="Scaduti complessivi" value={overall.fattureScaduteCount} warning={overall.fattureScaduteCount > 0} href={overallOverdueHref} />
        </tbody></table>
      </section>
      <section className="dashboard-period-overview-group is-fiscal" aria-label="Situazione fiscale">
        <div className="dashboard-period-overview-group-heading"><span>Periodo di competenza</span><h3>Situazione fiscale</h3></div>
        <table className="dashboard-statement-table"><tbody>
          <StatementMoneyRow label="Entrate fiscali" value={fiscal.incassoFiscale} href={fiscalIncomesHref} />
          <StatementMoneyRow label="Imponibile" value={fiscal.imponibileIncassi} />
          <StatementMoneyRow label="Uscite fiscali" value={fiscal.usciteFiscali} href={fiscalExpensesHref} />
          <StatementMoneyRow label="Utile fiscale" value={fiscal.utileFiscale} highlight />
          <StatementMoneyRow label="Non saldato fiscale" value={fiscal.nonSaldato} warning={fiscal.nonSaldato > 0} href={fiscalUnpaidHref} />
          <StatementMoneyRow label="Previsione saldo IVA" value={fiscal.debitoIva} vat highlight />
          <StatementCountRow label="Scaduti fiscali" value={fiscal.fattureScaduteCount} warning={fiscal.fattureScaduteCount > 0} href={fiscalOverdueHref} />
          <StatementCountRow label="Fatture non inviate" value={fiscal.fattureNonInviate} warning={fiscal.fattureNonInviate > 0} href={invoicesNotSentHref} />
          <StatementCountRow label="Fatture non ricevute" value={fiscal.fattureNonRicevute} warning={fiscal.fattureNonRicevute > 0} href={invoicesNotReceivedHref} />
        </tbody></table>
      </section>
    </div>
    <footer className="dashboard-statement-actions dashboard-period-overview-actions">
      <Link className="btn btn-sm btn-ghost" href={reportHref}>Apri Report {isMonth ? 'mensile' : 'trimestrale'}</Link>
    </footer>
  </section>;
}

export default function DashboardFiscalAjax({
  annualYear,
  monthOptions,
  quarterOptions,
  initialTrend,
  initialTrendQuarter,
  initialMonth,
  initialQuarter
}: {
  annualYear: number;
  monthOptions: MonthOption[];
  quarterOptions: QuarterOption[];
  initialTrend: TrendState;
  initialTrendQuarter: FiscalState;
  initialMonth: FiscalState;
  initialQuarter: FiscalState;
}) {
  const [trendState, setTrendState] = useState(initialTrend);
  const [trendQuarterState, setTrendQuarterState] = useState(initialTrendQuarter);
  const [monthState, setMonthState] = useState(initialMonth);
  const [quarterState, setQuarterState] = useState(initialQuarter);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendQuarterLoading, setTrendQuarterLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [quarterLoading, setQuarterLoading] = useState(false);

  const selectedTrendValue = monthValue(trendState.year, trendState.month);
  const selectedTrendQuarterValue = useMemo(() => {
    const first = trendQuarterState.periods[0];
    if (!first) return '';
    return quarterValue(first.year, Math.floor((first.month - 1) / 3));
  }, [trendQuarterState.periods]);
  const selectedMonthValue = monthState.periods[0] ? monthValue(monthState.periods[0].year, monthState.periods[0].month) : '';
  const selectedQuarterValue = useMemo(() => {
    const first = quarterState.periods[0];
    if (!first) return '';
    return quarterValue(first.year, Math.floor((first.month - 1) / 3));
  }, [quarterState.periods]);

  async function loadTrend(value: string) {
    const [year, month] = value.split('-').map(Number);
    setTrendLoading(true);
    try {
      const response = await fetch(`/api/dashboard/fiscal-summary?type=trend&year=${year}&month=${month}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Errore nel caricamento dell’andamento mensile');
      setTrendState(await response.json());
      updateUrlParam('trendMonth', value, annualYear);
    } finally {
      setTrendLoading(false);
    }
  }

  async function loadMonth(value: string) {
    const [year, month] = value.split('-').map(Number);
    setMonthLoading(true);
    try {
      const response = await fetch(`/api/dashboard/fiscal-summary?type=month&year=${year}&month=${month}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Errore nel caricamento del mese fiscale');
      setMonthState(await response.json());
      updateUrlParam('fiscalMonth', value, annualYear);
    } finally {
      setMonthLoading(false);
    }
  }

  async function loadTrendQuarter(value: string) {
    const match = value.match(/^(\d{4})-Q([1-4])$/);
    if (!match) return;
    const year = Number(match[1]);
    const quarterIndex = Number(match[2]) - 1;
    setTrendQuarterLoading(true);
    try {
      const response = await fetch(`/api/dashboard/fiscal-summary?type=trendQuarter&year=${year}&quarterIndex=${quarterIndex}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Errore nel caricamento dell’andamento trimestrale');
      setTrendQuarterState(await response.json());
      updateUrlParam('trendQuarter', value, annualYear);
    } finally {
      setTrendQuarterLoading(false);
    }
  }

  async function loadQuarter(value: string) {
    const match = value.match(/^(\d{4})-Q([1-4])$/);
    if (!match) return;
    const year = Number(match[1]);
    const quarterIndex = Number(match[2]) - 1;
    setQuarterLoading(true);
    try {
      const response = await fetch(`/api/dashboard/fiscal-summary?type=quarter&year=${year}&quarterIndex=${quarterIndex}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Errore nel caricamento del trimestre fiscale');
      setQuarterState(await response.json());
      updateUrlParam('fiscalQuarter', value, annualYear);
    } finally {
      setQuarterLoading(false);
    }
  }

  async function loadMonthOverview(value: string) {
    const [year, month] = value.split('-').map(Number);
    setTrendLoading(true);
    setMonthLoading(true);
    try {
      const response = await fetch(`/api/dashboard/fiscal-summary?type=monthOverview&year=${year}&month=${month}`, {cache: 'no-store'});
      if (!response.ok) throw new Error('Errore nel caricamento del riepilogo mensile');
      const data = await response.json();
      setTrendState({year, month, totals: data.overallTotals});
      setMonthState({periods: data.periods, totals: data.fiscalTotals});
      updateOverviewUrl('overviewMonth', value, annualYear);
    } finally {
      setTrendLoading(false);
      setMonthLoading(false);
    }
  }

  async function loadQuarterOverview(value: string) {
    const match = value.match(/^(\d{4})-Q([1-4])$/);
    if (!match) return;
    const year = Number(match[1]);
    const quarterIndex = Number(match[2]) - 1;
    setTrendQuarterLoading(true);
    setQuarterLoading(true);
    try {
      const response = await fetch(`/api/dashboard/fiscal-summary?type=quarterOverview&year=${year}&quarterIndex=${quarterIndex}`, {cache: 'no-store'});
      if (!response.ok) throw new Error('Errore nel caricamento del riepilogo trimestrale');
      const data = await response.json();
      setTrendQuarterState({periods: data.periods, totals: data.overallTotals});
      setQuarterState({periods: data.periods, totals: data.fiscalTotals});
      updateOverviewUrl('overviewQuarter', value, annualYear);
    } finally {
      setTrendQuarterLoading(false);
      setQuarterLoading(false);
    }
  }

  return <>
    <PeriodOverviewCard
      kind="month"
      overallState={{periods: [{year: trendState.year, month: trendState.month}], totals: trendState.totals}}
      fiscalState={monthState}
      loading={trendLoading || monthLoading}
      selector={<form className="period-selector" onSubmit={(event) => event.preventDefault()}>
        <select name="overviewMonth" value={selectedTrendValue} aria-label="Periodo mensile" onChange={(event) => loadMonthOverview(event.currentTarget.value)}>
          {monthOptions.map(option => <option key={`overview-${monthValue(option.year, option.month)}`} value={monthValue(option.year, option.month)}>{monthName(option.month)} {option.year}</option>)}
        </select>
      </form>}
    />

    <PeriodOverviewCard
      kind="quarter"
      overallState={trendQuarterState}
      fiscalState={quarterState}
      loading={trendQuarterLoading || quarterLoading}
      selector={<form className="period-selector" onSubmit={(event) => event.preventDefault()}>
        <select name="overviewQuarter" value={selectedTrendQuarterValue} aria-label="Periodo trimestrale" onChange={(event) => loadQuarterOverview(event.currentTarget.value)}>
          {quarterOptions.map(option => <option key={`overview-quarter-${quarterValue(option.year, option.quarterIndex)}`} value={quarterValue(option.year, option.quarterIndex)}>T{option.quarterIndex + 1} {option.year}</option>)}
        </select>
      </form>}
    />
  </>;
}
