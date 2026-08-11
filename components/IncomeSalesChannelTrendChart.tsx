"use client";

import {useMemo, useState} from 'react';
import Link from 'next/link';
import type {IncomeChannelTrendData} from '@/lib/income-channel-trend';

type View = 'total' | 'channels';
type Period = 'year' | 'q1' | 'q2' | 'q3' | 'q4';

const colors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0f766e', '#db2777', '#64748b', '#0891b2', '#9333ea'];
const money = new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0});

function rangeHref(from: string, to: string, channel?: string) {
  const params = new URLSearchParams({creditDateFrom: from, creditDateTo: to, view: 'andamento'});
  if (channel) params.set('salesChannel', channel);
  return `/incomes?${params.toString()}`;
}

export default function IncomeSalesChannelTrendChart({initialData, availableYears}: {initialData: IncomeChannelTrendData; availableYears: number[]}) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>('channels');
  const [period, setPeriod] = useState<Period>('year');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const channelColors = useMemo(() => new Map(data.channels.map((channel, index) => [channel.id, colors[index % colors.length]])), [data.channels]);
  const buckets = period === 'year' ? data.months : data.quarters[Number(period.slice(1)) - 1]?.weeks ?? [];
  const periodTotal = buckets.reduce((sum, bucket) => sum + bucket.total, 0);
  const periodCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const max = Math.max(...buckets.map(bucket => bucket.total), 1);
  const periodChannels = data.channels.map(channel => ({...channel, total: buckets.reduce((sum, bucket) => sum + (bucket.channels.find(item => item.id === channel.id)?.total ?? 0), 0)})).filter(channel => channel.total > 0).sort((a, b) => b.total - a.total);
  const leading = periodChannels[0];
  const peak = buckets.reduce<(typeof buckets)[number] | null>((best, bucket) => !best || bucket.total > best.total ? bucket : best, null);

  async function changeYear(year: number) {
    if (year === data.year || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/incomes/channel-trend?year=${year}`, {cache: 'no-store'});
      if (!response.ok) throw new Error('Impossibile caricare il grafico.');
      setData(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossibile caricare il grafico.');
    } finally {
      setLoading(false);
    }
  }

  return <section id="incassi" className="income-channel-trend-card dashboard-anchor-section" aria-labelledby="income-channel-trend-title">
    <div className="income-channel-trend-heading">
      <div><h2 id="income-channel-trend-title">Andamento incassi per canale di vendita</h2><p className="muted">Confronto mensile degli incassi registrati per data di accredito.</p></div>
      <div className="income-channel-trend-controls">
        <div className="trend-mode-toggle" role="group" aria-label="Visualizzazione grafico">
          <button type="button" className={`trend-mode-button ${view === 'total' ? 'is-active' : ''}`} onClick={() => setView('total')}>Totale</button>
          <button type="button" className={`trend-mode-button ${view === 'channels' ? 'is-active' : ''}`} onClick={() => setView('channels')}>Per canale</button>
        </div>
        <div className="trend-mode-toggle income-channel-period-toggle" role="group" aria-label="Periodo grafico">
          {([['year', 'Anno'], ['q1', 'Tri 1'], ['q2', 'Tri 2'], ['q3', 'Tri 3'], ['q4', 'Tri 4']] as const).map(([value, label]) => <button type="button" key={value} className={`trend-mode-button ${period === value ? 'is-active' : ''}`} onClick={() => setPeriod(value)}>{label}</button>)}
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
    <div className={`income-channel-trend-scroll ${loading ? 'is-loading' : ''}`}>
      <div className={`income-channel-trend-plot ${period === 'year' ? '' : 'is-quarter'}`} role="img" aria-label={`Andamento incassi ${data.year}, ${period === 'year' ? 'anno' : period}`}>
        {buckets.map(bucket => <div className="income-channel-month" key={bucket.from}>
          <strong className="income-channel-month-value">{money.format(bucket.total)}</strong>
          <div className="income-channel-bar-stage">
            {bucket.total > 0 ? view === 'total' ? <Link href={rangeHref(bucket.from, bucket.to)} className="income-channel-total-bar" style={{height: `${bucket.total / max * 100}%`}} title={`${bucket.label}: ${money.format(bucket.total)}`} aria-label={`Vedi incassi di ${bucket.label}: ${money.format(bucket.total)}`}/> :
              <div className="income-channel-stacked-bar" style={{height: `${bucket.total / max * 100}%`}}>
                {bucket.channels.map(channel => <Link key={channel.id} href={rangeHref(bucket.from, bucket.to, channel.name)} style={{height: `${channel.total / bucket.total * 100}%`, background: channelColors.get(channel.id)}} title={`${channel.name}, ${bucket.label}: ${money.format(channel.total)}`} aria-label={`Vedi ${channel.name} di ${bucket.label}: ${money.format(channel.total)}`}/>)}
              </div> : null}
          </div>
          <span>{bucket.label}</span><small>{bucket.count} mov.</small>
        </div>)}
      </div>
    </div>

    {view === 'channels' ? <div className="income-channel-trend-legend" aria-label="Legenda canali">
      {periodChannels.map(channel => <div key={channel.id}><span style={{background: channelColors.get(channel.id)}}/><strong>{channel.icon ?? '•'} {channel.name}</strong><small>{money.format(channel.total)} · {periodTotal ? (channel.total / periodTotal * 100).toFixed(1) : '0.0'}%</small></div>)}
    </div> : null}
  </section>;
}
