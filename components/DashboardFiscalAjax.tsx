'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { euro, moneyTone, monthName } from '@/lib/money';

type Period = { year: number; month: number };
type MonthOption = { year: number; month: number };
type QuarterOption = { year: number; quarterIndex: number };
type Totals = {
  incassoTotale: number;
  speseTotali: number;
  utileNetto: number;
  usciteNonFiscali: number;
  nonSaldato: number;
  fattureScaduteCount: number;
  incassoFiscale: number;
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

function updateUrlParam(key: 'trendMonth' | 'fiscalMonth' | 'fiscalQuarter', value: string, annualYear: number) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  url.searchParams.set('annualYear', String(annualYear));
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
  const overdueExpensesHref = dateRangeLink('/expenses', state.year, state.month, { paymentStatus: 'overdue' });

  return <div className={`card fiscal-summary-card monthly-trend-card ${loading ? 'is-loading' : ''}`}>
    <div className="card-heading-row">
      <div>
        <h2>Andamento mensile</h2>
        <p className="muted">{monthName(state.month)} {state.year} · filtro su Data ordine</p>
      </div>
      {selector}
    </div>
    <div className="summary-metrics-grid summary-metrics-grid-priority fiscal-summary-metrics-ordered">
      <SummaryMetric label="Entrate totali" value={totals.incassoTotale} highlight href={incomesHref} />
      <SummaryMetric label="Uscite totali" value={totals.speseTotali} highlight href={expensesHref} />
      <SummaryMetric label="Utile netto" value={totals.utileNetto} highlight />
      <SummaryMetric label="Spese non fiscali" value={totals.usciteNonFiscali} warning={totals.usciteNonFiscali > 0} href={nonFiscalExpensesHref} />
      <SummaryMetric label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0} href={unpaidExpensesHref} />
      <CountMetric label="Pagamenti scaduti" value={totals.fattureScaduteCount} warning={totals.fattureScaduteCount > 0} href={overdueExpensesHref} />
    </div>
  </div>;
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
  const expensesHref = periodLink('/expenses', periods);
  const fiscalExpensesHref = periodLink('/expenses', periods, { declared: 'yes' });
  const unpaidExpensesHref = periodLink('/expenses', periods, { paymentStatus: 'not_complete', declared: 'yes' });
  const incomesHref = periodLink('/incomes', periods);
  const invoicesNotSentHref = periodLink('/incomes', periods, { fiscal: 'yes', invoiceStatusMode: 'not_emitted' });
  const invoicesNotReceivedHref = periodLink('/expenses', periods, { declared: 'yes', invoiceStatusMode: 'not_received' });
  const overdueExpensesHref = periodLink('/expenses', periods, { paymentStatus: 'overdue', declared: 'yes' });

  return <div className={`card fiscal-summary-card ${loading ? 'is-loading' : ''}`}>
    <div className="card-heading-row">
      <div>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
      </div>
      {selector}
    </div>
    <div className="summary-metrics-grid summary-metrics-grid-priority fiscal-summary-metrics-ordered">
      <SummaryMetric label="Entrate fiscali" value={totals.incassoFiscale} highlight href={incomesHref} />
      <SummaryMetric label="Uscite fiscali" value={totals.usciteFiscali} highlight href={fiscalExpensesHref} />
      <SummaryMetric label="Utile fiscale" value={totals.utileFiscale} highlight />
      <SummaryMetric label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0} href={unpaidExpensesHref} />
      <CountMetric label="Pagamenti scaduti" value={totals.fattureScaduteCount} warning={totals.fattureScaduteCount > 0} href={overdueExpensesHref} />
      <SummaryMetric label="Previsione saldo IVA" value={totals.debitoIva} highlight vat />
      <CountMetric label="Fatture non inviate" value={totals.fattureNonInviate} warning={totals.fattureNonInviate > 0} href={invoicesNotSentHref} />
      <CountMetric label="Fatture non ricevute" value={totals.fattureNonRicevute} warning={totals.fattureNonRicevute > 0} href={invoicesNotReceivedHref} />
    </div>
  </div>;
}

export default function DashboardFiscalAjax({
  annualYear,
  monthOptions,
  quarterOptions,
  initialTrend,
  initialMonth,
  initialQuarter
}: {
  annualYear: number;
  monthOptions: MonthOption[];
  quarterOptions: QuarterOption[];
  initialTrend: TrendState;
  initialMonth: FiscalState;
  initialQuarter: FiscalState;
}) {
  const [trendState, setTrendState] = useState(initialTrend);
  const [monthState, setMonthState] = useState(initialMonth);
  const [quarterState, setQuarterState] = useState(initialQuarter);
  const [trendLoading, setTrendLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [quarterLoading, setQuarterLoading] = useState(false);

  const selectedTrendValue = monthValue(trendState.year, trendState.month);
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

  return <>
    <MonthlyTrendCard
      state={trendState}
      loading={trendLoading}
      selector={<form className="period-selector" onSubmit={(event) => event.preventDefault()}>
        <select name="trendMonth" value={selectedTrendValue} aria-label="Andamento mensile" onChange={(event) => loadTrend(event.currentTarget.value)}>
          {monthOptions.map(option => <option key={`trend-${monthValue(option.year, option.month)}`} value={monthValue(option.year, option.month)}>{monthName(option.month)} {option.year}</option>)}
        </select>
      </form>}
    />

    <FiscalSummaryCard
      title="Mese fiscale"
      subtitle={monthState.periods[0] ? `${monthName(monthState.periods[0].month)} ${monthState.periods[0].year}` : '-'}
      state={monthState}
      loading={monthLoading}
      selector={<form className="period-selector" onSubmit={(event) => event.preventDefault()}>
        <select name="fiscalMonth" value={selectedMonthValue} aria-label="Mese fiscale" onChange={(event) => loadMonth(event.currentTarget.value)}>
          {monthOptions.map(option => <option key={monthValue(option.year, option.month)} value={monthValue(option.year, option.month)}>{monthName(option.month)} {option.year}</option>)}
        </select>
      </form>}
    />

    <FiscalSummaryCard
      title="Trimestre fiscale"
      subtitle={fiscalQuarterLabel(quarterState.periods)}
      state={quarterState}
      loading={quarterLoading}
      selector={<form className="period-selector" onSubmit={(event) => event.preventDefault()}>
        <select name="fiscalQuarter" value={selectedQuarterValue} aria-label="Trimestre fiscale" onChange={(event) => loadQuarter(event.currentTarget.value)}>
          {quarterOptions.map(option => <option key={quarterValue(option.year, option.quarterIndex)} value={quarterValue(option.year, option.quarterIndex)}>T{option.quarterIndex + 1} {option.year}</option>)}
        </select>
      </form>}
    />
  </>;
}
