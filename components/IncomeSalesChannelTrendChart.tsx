"use client";

import {useMemo, useState} from 'react';
import Link from 'next/link';
import {
  buildIncomeChannelComparisonSeries,
  incomeChannelComparisonDomain,
  leadingIncomeChannelIds,
  type IncomeChannelComparisonSeries,
  type IncomeChannelTrendData,
  type IncomeChannelTrendMonth
} from '@/lib/income-channel-trend';

type View = 'total' | 'channels';
type Period = 'year' | 'q1' | 'q2' | 'q3' | 'q4';
type ComparisonMode = 'index' | 'amount';

const colors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0f766e', '#db2777', '#64748b', '#0891b2', '#9333ea'];
const money = new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0});
const percent = new Intl.NumberFormat('it-IT', {maximumFractionDigits: 1, signDisplay: 'exceptZero'});

function rangeHref(from: string, to: string, channel?: string) {
  const params = new URLSearchParams({creditDateFrom: from, creditDateTo: to, view: 'andamento'});
  if (channel) params.set('salesChannel', channel);
  return `/incomes?${params.toString()}`;
}

function ChannelComparisonPlot({buckets, series, channelColors, mode, selectedIndex, onHover, onTogglePin}: {
  buckets: IncomeChannelTrendMonth[];
  series: IncomeChannelComparisonSeries[];
  channelColors: Map<number, string>;
  mode: ComparisonMode;
  selectedIndex: number | null;
  onHover: (index: number) => void;
  onTogglePin: (index: number) => void;
}) {
  const width = Math.max(920, buckets.length * 76);
  const height = 330;
  const left = 72;
  const right = 24;
  const top = 24;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = series.flatMap(channel => channel.points.flatMap(point => {
    const value = mode === 'amount' ? point.amount : point.indexValue;
    return value === null ? [] : [value];
  }));
  const domain = mode === 'amount'
    ? {min: 0, max: Math.max(...values, 1) * 1.08}
    : incomeChannelComparisonDomain(values, 100);
  const range = Math.max(domain.max - domain.min, 1);
  const x = (index: number) => buckets.length <= 1 ? left + plotWidth / 2 : left + index / (buckets.length - 1) * plotWidth;
  const y = (value: number) => top + (domain.max - value) / range * plotHeight;
  const ticks = Array.from({length: 5}, (_, index) => domain.min + range * index / 4).reverse();
  const selectedX = selectedIndex === null ? null : x(selectedIndex);

  return <div className="income-channel-comparison-scroll">
    <svg className="income-channel-comparison-chart" viewBox={`0 0 ${width} ${height}`} style={{width}} role="img"
         aria-label={`Confronto degli incassi per canale, ${mode === 'amount' ? 'importi in euro' : 'indice base 100'}`}>
      {ticks.map(tick => <g key={tick}>
        <line className="income-channel-comparison-grid" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)}/>
        <text className="income-channel-comparison-axis-label" x={left - 10} y={y(tick) + 4} textAnchor="end">
          {mode === 'amount' ? money.format(tick) : tick.toFixed(0)}
        </text>
      </g>)}
      {mode === 'index' && domain.min <= 100 && domain.max >= 100
        ? <line className="income-channel-comparison-baseline" x1={left} x2={width - right} y1={y(100)} y2={y(100)}/>
        : null}
      {buckets.map((bucket, index) => <text key={bucket.from} className="income-channel-comparison-bucket-label" x={x(index)} y={height - 18} textAnchor="middle">{bucket.label}</text>)}
      {series.map(channel => {
        const points = channel.points.flatMap(point => {
          const value = mode === 'amount' ? point.amount : point.indexValue;
          return value === null ? [] : [{...point, value}];
        });
        const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.bucketIndex)} ${y(point.value)}`).join(' ');
        return <g key={channel.id} className="income-channel-comparison-series">
          <path d={path} fill="none" stroke={channelColors.get(channel.id)} vectorEffect="non-scaling-stroke"/>
          {points.map(point => <circle key={point.bucketIndex} cx={x(point.bucketIndex)} cy={y(point.value)} r={selectedIndex === point.bucketIndex ? 4.5 : 3} fill={channelColors.get(channel.id)}/>) }
        </g>;
      })}
      {selectedX !== null ? <line className="income-channel-comparison-crosshair" x1={selectedX} x2={selectedX} y1={top} y2={height - bottom}/> : null}
      {buckets.map((bucket, index) => {
        const bandWidth = plotWidth / Math.max(buckets.length - 1, 1);
        const hitX = Math.max(left, x(index) - bandWidth / 2);
        return <rect key={`hit-${bucket.from}`} className="income-channel-comparison-hit" x={hitX} y={top}
                     width={Math.min(bandWidth, width - right - hitX)} height={plotHeight} tabIndex={0} role="button"
                     aria-label={`Mostra dettaglio ${bucket.label}`} onMouseEnter={() => onHover(index)}
                     onFocus={() => onHover(index)} onClick={() => onTogglePin(index)}/>;
      })}
    </svg>
  </div>;
}

export default function IncomeSalesChannelTrendChart({initialData, availableYears}: {
  initialData: IncomeChannelTrendData;
  availableYears: number[];
}) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>('channels');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('index');
  const [period, setPeriod] = useState<Period>('year');
  const [selectedChannelIds, setSelectedChannelIds] = useState(() => new Set(initialData.channels.slice(0, 5).map(channel => channel.id)));
  const [selectedBucketIndex, setSelectedBucketIndex] = useState<number | null>(null);
  const [pinnedBucketIndex, setPinnedBucketIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const channelColors = useMemo(() => new Map(data.channels.map((channel, index) => [channel.id, colors[index % colors.length]])), [data.channels]);
  const rawBuckets = period === 'year' ? data.months : data.quarters[Number(period.slice(1)) - 1]?.weeks ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const currentYear = Number(today.slice(0, 4));
  const buckets = data.year === currentYear ? rawBuckets.filter(bucket => bucket.from <= today) : rawBuckets;
  const periodTotal = buckets.reduce((sum, bucket) => sum + bucket.total, 0);
  const periodCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const max = Math.max(...buckets.map(bucket => bucket.total), 1);
  const comparisonSeries = useMemo(() => buildIncomeChannelComparisonSeries(buckets, data.channels), [buckets, data.channels]);
  const visibleSeries = comparisonSeries.filter(channel => selectedChannelIds.has(channel.id));
  const leading = comparisonSeries[0];
  const peak = buckets.reduce<(typeof buckets)[number] | null>((best, bucket) => !best || bucket.total > best.total ? bucket : best, null);
  const displayedBucketIndex = selectedBucketIndex ?? (buckets.length ? buckets.length - 1 : null);
  const selectedBucket = displayedBucketIndex === null ? null : buckets[displayedBucketIndex] ?? null;

  async function changeYear(year: number) {
    if (year === data.year || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/incomes/channel-trend?year=${year}`, {cache: 'no-store'});
      if (!response.ok) throw new Error('Impossibile caricare il grafico.');
      const nextData: IncomeChannelTrendData = await response.json();
      setData(nextData);
      setSelectedChannelIds(new Set(nextData.channels.slice(0, 5).map(channel => channel.id)));
      setSelectedBucketIndex(null);
      setPinnedBucketIndex(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossibile caricare il grafico.');
    } finally {
      setLoading(false);
    }
  }

  function toggleChannel(channelId: number) {
    setSelectedChannelIds(current => {
      const next = new Set(current);
      if (next.has(channelId)) {
        if (next.size > 1) next.delete(channelId);
      } else next.add(channelId);
      return next;
    });
  }

  function hoverBucket(index: number) {
    if (pinnedBucketIndex === null) setSelectedBucketIndex(index);
  }

  function togglePinnedBucket(index: number) {
    if (pinnedBucketIndex === index) {
      setPinnedBucketIndex(null);
      setSelectedBucketIndex(null);
      return;
    }
    setPinnedBucketIndex(index);
    setSelectedBucketIndex(index);
  }

  return <section id="incassi" className="income-channel-trend-card dashboard-anchor-section" aria-labelledby="income-channel-trend-title">
    <div className="income-channel-trend-heading">
      <div><h2 id="income-channel-trend-title">Andamento incassi per canale di vendita</h2>
        <p className="muted">Confronto mensile degli incassi registrati per data di accredito.</p></div>
      <div className="income-channel-trend-controls">
        <div className="trend-mode-toggle" role="group" aria-label="Visualizzazione grafico">
          <button type="button" className={`trend-mode-button ${view === 'total' ? 'is-active' : ''}`} onClick={() => setView('total')}>Totale</button>
          <button type="button" className={`trend-mode-button ${view === 'channels' ? 'is-active' : ''}`} onClick={() => setView('channels')}>Per canale</button>
        </div>
        <div className="trend-mode-toggle income-channel-period-toggle" role="group" aria-label="Periodo grafico">
          {([['year', 'Anno'], ['q1', 'Tri 1'], ['q2', 'Tri 2'], ['q3', 'Tri 3'], ['q4', 'Tri 4']] as const).map(([value, label]) =>
            <button type="button" key={value} className={`trend-mode-button ${period === value ? 'is-active' : ''}`} onClick={() => {setPeriod(value); setSelectedBucketIndex(null); setPinnedBucketIndex(null);}}>{label}</button>)}
        </div>
        {availableYears.length > 1 ? <select aria-label="Anno del grafico" value={data.year} disabled={loading} onChange={event => void changeYear(Number(event.currentTarget.value))}>
          {availableYears.map(year => <option value={year} key={year}>{year}</option>)}
        </select> : null}
      </div>
    </div>

    <div className="income-channel-trend-kpis">
      <div><span>Totale periodo</span><strong>{money.format(periodTotal)}</strong></div>
      <div><span>Numero incassi</span><strong>{periodCount}</strong></div>
      <div><span>Canale principale</span><strong>{leading ? `${leading.icon ?? '•'} ${leading.name}` : '—'}</strong></div>
      <div><span>{period === 'year' ? 'Mese migliore' : 'Settimana migliore'}</span><strong>{peak && peak.total > 0 ? `${peak.label} · ${money.format(peak.total)}` : '—'}</strong></div>
    </div>

    {error ? <p className="inline-warning">{error}</p> : null}
    {view === 'channels' ? <>
      <div className="income-channel-comparison-toolbar">
        <div className="trend-mode-toggle income-channel-comparison-mode" role="group" aria-label="Unità di confronto dei canali">
          <button type="button" className={`trend-mode-button ${comparisonMode === 'index' ? 'is-active' : ''}`} onClick={() => setComparisonMode('index')}>Indice 100</button>
          <button type="button" className={`trend-mode-button ${comparisonMode === 'amount' ? 'is-active' : ''}`} onClick={() => setComparisonMode('amount')}>Importi €</button>
        </div>
        <p className="muted">{comparisonMode === 'index' ? 'Confronta la crescita dal primo intervallo con incassi di ciascun canale.' : 'Confronta i volumi economici effettivi dei canali.'}</p>
      </div>
      <div className={loading ? 'income-channel-comparison-wrap is-loading' : 'income-channel-comparison-wrap'}>
        {visibleSeries.length ? <ChannelComparisonPlot buckets={buckets} series={visibleSeries} channelColors={channelColors} mode={comparisonMode}
          selectedIndex={displayedBucketIndex} onHover={hoverBucket} onTogglePin={togglePinnedBucket}/> : <p className="muted income-channel-comparison-empty">Seleziona almeno un canale disponibile nel periodo.</p>}
      </div>
      <div className={selectedBucket ? 'income-channel-comparison-detail' : 'income-channel-comparison-detail is-empty'}>
        {selectedBucket ? <>
          <div className="income-channel-comparison-detail-period">
              {/*<span>Periodo selezionato</span>*/}
              <strong className="text-primary">{selectedBucket.label}</strong>
              <strong>{selectedBucket.count} movimenti · {money.format(selectedBucket.total)}</strong>
          </div>
          <div className="income-channel-comparison-detail-list">{visibleSeries.map(channel => {
            const point = channel.points[displayedBucketIndex ?? 0];
            return <Link href={rangeHref(selectedBucket.from, selectedBucket.to, channel.name)} key={channel.id}>
              <i style={{background: channelColors.get(channel.id)}}/><span>{channel.icon ?? '•'} {channel.name}</span><strong>{money.format(point?.amount ?? 0)}</strong>
              <small className={point?.previousChange != null && point.previousChange < 0 ? 'is-negative' : undefined}>{point?.indexValue == null ? 'Indice n.d.' : `Indice ${point.indexValue.toFixed(0)}`} · {point?.previousChange == null ? 'var. —' : `${percent.format(point.previousChange)}%`}</small>
            </Link>;
          })}</div>
        </> : <p>Passa su un punto oppure toccalo per visualizzare i dati del periodo.</p>}
      </div>
      <div className="income-channel-comparison-actions">
        <span>Canali visualizzati</span>
        <button type="button" className="btn btn-xs btn-default" onClick={() => setSelectedChannelIds(new Set(leadingIncomeChannelIds(comparisonSeries, 5)))}>Solo principali</button>
        <button type="button" className="btn btn-xs btn-default" onClick={() => setSelectedChannelIds(new Set(comparisonSeries.map(channel => channel.id)))}>Mostra tutti</button>
      </div>
      <div className="income-channel-trend-legend income-channel-comparison-legend" aria-label="Seleziona i canali da confrontare">
        {comparisonSeries.map(channel => {
          const active = selectedChannelIds.has(channel.id);
          const firstPoint = channel.points.find(point => point.indexValue !== null);
          const lastPoint = [...channel.points].reverse().find(point => point.indexValue !== null);
          const periodChange = firstPoint?.indexValue != null && lastPoint?.indexValue != null ? lastPoint.indexValue - firstPoint.indexValue : null;
          return <button type="button" className={active ? 'is-active' : ''} aria-pressed={active} onClick={() => toggleChannel(channel.id)} key={channel.id}>
            <span style={{background: channelColors.get(channel.id)}}/><strong>{channel.icon ?? '•'} {channel.name}</strong>
            <div className="income-channel-item-values"><span>{money.format(channel.total)}</span><span>{channel.share.toFixed(1)}%</span>
              <b className={periodChange !== null && periodChange < 0 ? 'is-negative' : 'is-positive'}>{periodChange === null ? '—' : `${percent.format(periodChange)}%`}</b></div>
          </button>;
        })}
      </div>
    </> : <div className={`income-channel-trend-scroll ${loading ? 'is-loading' : ''}`}>
      <div className={`income-channel-trend-plot ${period === 'year' ? '' : 'is-quarter'}`} role="img" aria-label={`Andamento incassi ${data.year}, ${period === 'year' ? 'anno' : period}`}>
        {buckets.map(bucket => <div className="income-channel-month" key={bucket.from}>
          <strong className="income-channel-month-value">{money.format(bucket.total)}</strong>
          <div className="income-channel-bar-stage">{bucket.total > 0 ? <Link href={rangeHref(bucket.from, bucket.to)} className="income-channel-total-bar" style={{height: `${bucket.total / max * 100}%`}} title={`${bucket.label}: ${money.format(bucket.total)}`}/> : null}</div>
          <span>{bucket.label}</span><small>{bucket.count} mov.</small>
        </div>)}
      </div>
    </div>}
  </section>;
}
