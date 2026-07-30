"use client";

import {useMemo, useState} from 'react';
import type {DailyReceiptTrend} from '@/lib/cash-register-trend';
import {euro} from '@/lib/money';

function dayLabel(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('it-IT', options).format(new Date(`${value}T12:00:00`)).replace('.', '');
}

export default function CashRegisterReceiptTrendChart({points}: {points: DailyReceiptTrend[]}) {
  const lastActiveIndex = points.reduce((last, point, index) => point.count ? index : last, 0);
  const [selectedIndex, setSelectedIndex] = useState(lastActiveIndex);
  const selected = points[selectedIndex] ?? points[0];
  const totals = useMemo(() => {
    const total = points.reduce((sum, point) => sum + point.total, 0);
    const count = points.reduce((sum, point) => sum + point.count, 0);
    const best = points.reduce<DailyReceiptTrend | null>(
      (current, point) => !current || point.total > current.total ? point : current,
      null,
    );
    return {total, count, average: count ? total / count : 0, best};
  }, [points]);

  const width = Math.max(720, points.length * 28);
  const height = 290;
  const left = 68;
  const right = 20;
  const top = 24;
  const bottom = 46;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...points.map(point => point.total), 1);
  const x = (index: number) => left + chartWidth * index / Math.max(points.length - 1, 1);
  const y = (value: number) => top + (1 - value / maxValue) * chartHeight;
  const baseline = top + chartHeight;
  const linePoints = points.map((point, index) => `${x(index)},${y(point.total)}`).join(' ');
  const areaPoints = `${left},${baseline} ${linePoints} ${x(points.length - 1)},${baseline}`;
  const labelEvery = points.length > 20 ? 3 : points.length > 12 ? 2 : 1;

  return <section className="card cash-register-trend-card" aria-labelledby="cash-register-trend-title">
    <div className="cash-register-trend-heading">
      <div>
        <h2 id="cash-register-trend-title">Andamento scontrini</h2>
        <p className="muted">Incasso giornaliero. I giorni senza movimenti restano visibili a zero.</p>
      </div>
      <div className="cash-register-trend-kpis">
        <div><span>Incasso</span><strong>{euro(totals.total)}</strong></div>
        <div><span>Scontrini</span><strong>{totals.count}</strong></div>
        <div><span>Ticket medio</span><strong>{euro(totals.average)}</strong></div>
        <div><span>Giorno migliore</span><strong>{totals.best?.count ? dayLabel(totals.best.day, {day: '2-digit', month: 'short'}) : '—'}</strong></div>
      </div>
    </div>

    {points.length ? <>
      <div className="cash-register-trend-chart-scroll">
        <svg className="cash-register-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img"
             aria-label="Grafico dell’incasso giornaliero degli scontrini">
          <polygon className="cash-register-trend-area" points={areaPoints}/>
          {[0, maxValue / 2, maxValue].map((value, index) => {
            const gridY = y(value);
            return <g key={index}>
              <line className="cash-register-trend-grid" x1={left} y1={gridY} x2={width - right} y2={gridY}/>
              <text className="cash-register-trend-axis-label" x={left - 9} y={gridY + 4} textAnchor="end">
                {euro(value)}
              </text>
            </g>;
          })}
          <polyline className="cash-register-trend-line" points={linePoints}/>
          {points.map((point, index) => <g key={point.day}>
            {index % labelEvery === 0 || index === points.length - 1
              ? <text className="cash-register-trend-day-label" x={x(index)} y={height - 18} textAnchor="middle">
                  {dayLabel(point.day, {day: '2-digit'})}
                </text>
              : null}
            <circle
              className={[
                'cash-register-trend-point',
                point.count ? 'has-data' : 'is-empty',
                selectedIndex === index ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              cx={x(index)}
              cy={y(point.total)}
              r={selectedIndex === index ? 6 : point.count ? 4 : 2.5}
              tabIndex={0}
              role="button"
              aria-label={`${dayLabel(point.day, {day: 'numeric', month: 'long'})}: ${point.count ? `${euro(point.total)}, ${point.count} scontrini` : 'nessun movimento'}`}
              onFocus={() => setSelectedIndex(index)}
              onClick={() => setSelectedIndex(index)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedIndex(index);
                }
              }}
            />
          </g>)}
        </svg>
      </div>
      {selected ? <div className={selected.count ? 'cash-register-trend-selection' : 'cash-register-trend-selection is-empty'} aria-live="polite">
        <div><span>Data</span><strong>{dayLabel(selected.day, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})}</strong></div>
        <div><span>Incasso</span><strong>{selected.count ? euro(selected.total) : 'Nessun movimento'}</strong></div>
        <div><span>Scontrini</span><strong>{selected.count}</strong></div>
        <div><span>Ticket medio</span><strong>{selected.count ? euro(selected.average) : '—'}</strong></div>
      </div> : null}
    </> : <div className="expense-empty-panel">Nessun dato disponibile per il periodo selezionato.</div>}
  </section>;
}
