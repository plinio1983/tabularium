import Link from 'next/link';
import {monthName} from '@/lib/money';
import {percentageChange, type MonthComparisonKind, type MonthPeriod} from '@/lib/month-comparison';
import MonthComparisonPeriodField from '@/components/MonthComparisonPeriodField';

type Totals = {
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  estimatedNetProfit: number;
  declaredProfit: number;
  estimatedTax: number;
};

type Metric = {
  label: string;
  key: keyof Totals;
  positiveDirection: 1 | -1;
};

type Props = {
  current: MonthPeriod & {totals: Totals; hasMovements: boolean};
  comparison: MonthPeriod & {totals: Totals; hasMovements: boolean};
  kind: MonthComparisonKind;
  mode: 'overall' | 'fiscal';
  returnTo: string;
  isCurrentMonth: boolean;
};

function periodLabel({year, month}: MonthPeriod) {
  const name = monthName(month);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

function euro(value: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value);
}

function comparisonHref(current: MonthPeriod, mode: string, returnTo: string, kind: MonthComparisonKind) {
  const query = new URLSearchParams({mode, returnTo, compare: kind});
  return `/months/${current.year}/${current.month}?${query}`;
}

export default function MonthComparisonPanel({
  current,
  comparison,
  kind,
  mode,
  returnTo,
  isCurrentMonth
}: Props) {
  const metrics: Metric[] = mode === 'fiscal' ? [
    {label: 'Entrate fiscali', key: 'totalRevenue', positiveDirection: 1},
    {label: 'Uscite rilevanti', key: 'totalExpenses', positiveDirection: -1},
    {label: 'Utile fiscale', key: 'declaredProfit', positiveDirection: 1},
    {label: 'Imposte previste', key: 'estimatedTax', positiveDirection: -1}
  ] : [
    {label: 'Entrate', key: 'totalRevenue', positiveDirection: 1},
    {label: 'Uscite', key: 'totalExpenses', positiveDirection: -1},
    {label: 'Utile lordo', key: 'grossProfit', positiveDirection: 1},
    {label: 'Netto previsto', key: 'estimatedNetProfit', positiveDirection: 1}
  ];
  const customValue = `${comparison.year}-${String(comparison.month).padStart(2, '0')}`;

  return <section className="card month-comparison-panel" aria-labelledby="month-comparison-title">
    <div className="month-comparison-heading">
      <div>
        <h3 id="month-comparison-title">Confronto mesi</h3>
        <p className="muted">{periodLabel(current)} rispetto a {periodLabel(comparison)}</p>
      </div>
      <nav className="month-comparison-tabs" aria-label="Periodo di confronto">
        <Link className={kind === 'previous' ? 'is-active' : ''} href={comparisonHref(current, mode, returnTo, 'previous')}>Mese precedente</Link>
        <Link className={kind === 'year' ? 'is-active' : ''} href={comparisonHref(current, mode, returnTo, 'year')}>Anno precedente</Link>
        <Link className={kind === 'custom' ? 'is-active' : ''} href={comparisonHref(current, mode, returnTo, 'custom')}>Scegli mese</Link>
      </nav>
    </div>

    {kind === 'custom' ? <form className="month-comparison-custom-form" method="get">
      <input type="hidden" name="mode" value={mode}/>
      <input type="hidden" name="returnTo" value={returnTo}/>
      <input type="hidden" name="compare" value="custom"/>
      <MonthComparisonPeriodField initialValue={customValue}/>
      <button className="btn btn-sm btn-primary" type="submit">Confronta</button>
    </form> : null}

    {!comparison.hasMovements ? <div className="month-comparison-empty">
      Nessun movimento registrato in {periodLabel(comparison)}. Le differenze percentuali non sono disponibili.
    </div> : null}

    <div className="month-comparison-grid">
      {metrics.map(metric => {
        const currentValue = current.totals[metric.key];
        const comparisonValue = comparison.totals[metric.key];
        const difference = currentValue - comparisonValue;
        const percentage = comparison.hasMovements ? percentageChange(currentValue, comparisonValue) : null;
        const tone = difference === 0
          ? 'is-neutral'
          : difference * metric.positiveDirection > 0 ? 'is-positive' : 'is-negative';
        return <article className="month-comparison-metric" key={metric.key}>
          <h4>{metric.label}</h4>
          <div className="month-comparison-values">
            <div className="month-comparison-current-value">
              <span>{periodLabel(current)}</span>
              <strong className={currentValue < 0 ? 'is-negative-value' : undefined}>{euro(currentValue)}</strong>
            </div>
            <span className="month-comparison-versus" aria-hidden="true">→</span>
            <div className="month-comparison-reference-value">
              <span>{periodLabel(comparison)}</span>
              <strong className={comparisonValue < 0 ? 'is-negative-value' : undefined}>{comparison.hasMovements ? euro(comparisonValue) : 'Nessun movimento'}</strong>
            </div>
          </div>
          <div className={`month-comparison-delta ${tone}`}>
            <span>Variazione</span>
            <b>{difference > 0 ? '+' : ''}{euro(difference)}</b>
            <em>{percentage === null ? 'n.d.' : `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`}</em>
          </div>
        </article>;
      })}
    </div>

    {isCurrentMonth ? <p className="month-comparison-notice">
      Mese in corso: il confronto usa esclusivamente i movimenti registrati finora e non rappresenta una proiezione.
    </p> : null}
  </section>;
}
