'use client';

import {useState} from 'react';
import Link from 'next/link';

type MonthData = {
  year: number;
  month: number;
  totals: {
    incassoTotale: number;
    speseTotali: number;
    utileNetto: number;
  };
};

const euro = new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0});
const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function monthName(month: number) {
  return months[month - 1] ?? '';
}

function reportHref(year: number, month: number) {
  return `/months/${year}/${month}?returnTo=${encodeURIComponent('/')}`;
}

export default function MonthlyEconomicTrendChart({data, year}: {data: MonthData[]; year: number}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex === null ? null : data[selectedIndex];
  const positiveValues = data.flatMap(month => [month.totals.incassoTotale, month.totals.speseTotali, month.totals.utileNetto]);
  const maxValue = Math.max(...positiveValues, 1);
  const minValue = Math.min(0, ...data.map(month => month.totals.utileNetto));
  const range = Math.max(maxValue - minValue, 1);
  const width = 960;
  const height = 300;
  const left = 42;
  const right = 18;
  const top = 24;
  const bottom = 48;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const groupWidth = chartWidth / Math.max(data.length, 1);
  const y = (value: number) => top + ((maxValue - value) / range) * chartHeight;
  const baselineY = y(0);
  const profitPoints = data.map((month, index) => {
    const x = left + groupWidth * index + groupWidth / 2;
    return `${x},${y(month.totals.utileNetto)}`;
  }).join(' ');

  return <section className="card dashboard-insight-card full">
    <div className="card-heading-row">
      <div>
        <h2>Entrate, uscite e utile per mese</h2>
        <p className="muted">Andamento economico dell’anno {year}. La linea rappresenta l’utile netto.</p>
      </div>
      <div className="dashboard-chart-legend" aria-label="Legenda">
        <span><i className="legend-income"/>Entrate</span>
        <span><i className="legend-expense"/>Uscite</span>
        <span><i className="legend-profit"/>Utile netto</span>
      </div>
    </div>
    {data.length ? <>
      <div className="dashboard-svg-chart-scroll">
        <svg className="dashboard-economic-chart" viewBox={`0 0 ${width} ${height}`} role="img"
             aria-label={`Entrate, uscite e utile netto mensile ${year}`}>
          {[minValue, 0, maxValue / 2, maxValue].filter((value, index, all) => all.indexOf(value) === index).map(value => {
            const gridY = y(value);
            return <g key={value}>
              <line className={value === 0 ? 'dashboard-chart-zero-line' : 'dashboard-chart-grid-line'}
                    x1={left} y1={gridY} x2={width - right} y2={gridY}/>
              <text className="dashboard-chart-axis-label" x={left - 8} y={gridY + 4} textAnchor="end">{euro.format(value)}</text>
            </g>;
          })}
          {data.map((month, index) => {
            const center = left + groupWidth * index + groupWidth / 2;
            const barWidth = Math.min(22, groupWidth * .28);
            const incomeY = y(month.totals.incassoTotale);
            const expenseY = y(month.totals.speseTotali);
            return <g key={`${month.year}-${month.month}`}>
              <rect className="dashboard-chart-income-bar" x={center - barWidth - 2} y={incomeY}
                    width={barWidth} height={Math.max(baselineY - incomeY, 0)} rx="3"/>
              <rect className="dashboard-chart-expense-bar" x={center + 2} y={expenseY}
                    width={barWidth} height={Math.max(baselineY - expenseY, 0)} rx="3"/>
              <text className="dashboard-chart-month-label" x={center} y={height - 20} textAnchor="middle">{monthName(month.month).slice(0, 3)}</text>
            </g>;
          })}
          <polyline className="dashboard-chart-profit-line" points={profitPoints}/>
          {data.map((month, index) => {
            const x = left + groupWidth * index + groupWidth / 2;
            const pointY = y(month.totals.utileNetto);
            const tooltipWidth = 200;
            const tooltipX = Math.max(left, Math.min(x - tooltipWidth / 2, width - right - tooltipWidth));
            const tooltipY = pointY > top + 66 ? pointY - 64 : pointY + 13;
            const label = monthName(month.month);
            return <g key={`profit-${month.month}`}
                      className={`dashboard-chart-profit-marker ${selectedIndex === index ? 'is-selected' : ''}`}
                      tabIndex={0} role="button"
                      aria-label={`${label}: utile netto ${euro.format(month.totals.utileNetto)}. Mostra dettaglio.`}
                      onMouseEnter={() => setSelectedIndex(index)} onFocus={() => setSelectedIndex(index)}
                      onClick={() => setSelectedIndex(index)}>
              <circle className="dashboard-chart-profit-hit-area" cx={x} cy={pointY} r="12"/>
              <circle className={month.totals.utileNetto < 0 ? 'dashboard-chart-profit-point is-negative' : 'dashboard-chart-profit-point'} cx={x} cy={pointY} r="4"/>
              <g className="dashboard-chart-profit-tooltip" aria-hidden="true">
                <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height="52" rx="8"/>
                <text x={tooltipX + 12} y={tooltipY + 19}>{label}</text>
                <text className="dashboard-chart-profit-tooltip-value" x={tooltipX + 12} y={tooltipY + 40}>Utile netto: {euro.format(month.totals.utileNetto)}</text>
              </g>
            </g>;
          })}
        </svg>
      </div>
      <div className={`monthly-economic-selection-scroll ${selected ? '' : 'is-empty'}`}>
        {selected ? <div className="monthly-economic-selection">
          <div><span>Entrate</span><strong>{euro.format(selected.totals.incassoTotale)}</strong></div>
          <div><span>Uscite</span><strong>{euro.format(selected.totals.speseTotali)}</strong></div>
          <div><span>Netto</span><strong>{euro.format(selected.totals.utileNetto)}</strong></div>
          <Link className="btn btn-sm btn-default" href={reportHref(selected.year, selected.month)}>Report {monthName(selected.month)}</Link>
        </div> : <p className="muted">Seleziona un punto per vedere il dettaglio del mese.</p>}
      </div>
    </> : <p className="muted">Nessun dato economico disponibile per l’anno selezionato.</p>}
  </section>;
}
