"use client";

import {useMemo, useState} from 'react';
import Link from 'next/link';
import type {IncomeChannelTrendData} from '@/lib/income-channel-trend';

type View = 'total' | 'categories';
type Period = 'year' | 'q1' | 'q2' | 'q3' | 'q4';

const colors = ['#dc2626', '#f97316', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#64748b', '#16a34a', '#4f46e5', '#0f766e'];
const money = new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0});

function categoryParams(name: string) {
  if (name === 'Saldo IVA') return {expenseType: 'vat_settlement'};
  if (name === 'Imposte e contributi') return {expenseType: 'tax_contribution'};
  if (name === 'Buste paga') return {expenseType: 'payroll'};
  if (name === 'Senza categoria') return {};
  return {category: name};
}

function rangeHref(from: string, to: string, category?: string) {
  const params = new URLSearchParams({orderDateFrom: from, orderDateTo: to, view: 'andamento'});
  if (category) Object.entries(categoryParams(category)).forEach(([key, value]) => params.set(key, value));
  return `/expenses?${params.toString()}`;
}

export default function ExpenseCategoryTrendChart({data}: {data: IncomeChannelTrendData}) {
  const [view, setView] = useState<View>('categories');
  const [period, setPeriod] = useState<Period>('year');
  const seriesColors = useMemo(() => new Map(data.channels.map((category, index) => [category.id, colors[index % colors.length]])), [data.channels]);
  const buckets = period === 'year' ? data.months : data.quarters[Number(period.slice(1)) - 1]?.weeks ?? [];
  const periodTotal = buckets.reduce((sum, bucket) => sum + bucket.total, 0);
  const periodCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const max = Math.max(...buckets.map(bucket => bucket.total), 1);
  const periodCategories = data.channels.map(category => ({...category, total: buckets.reduce((sum, bucket) => sum + (bucket.channels.find(item => item.id === category.id)?.total ?? 0), 0)})).filter(category => category.total > 0).sort((a, b) => b.total - a.total);
  const leading = periodCategories[0];
  const peak = buckets.reduce<(typeof buckets)[number] | null>((best, bucket) => !best || bucket.total > best.total ? bucket : best, null);

  return <section id="spese" className="income-channel-trend-card expense-category-trend-card dashboard-anchor-section" aria-labelledby="expense-category-trend-title">
    <div className="income-channel-trend-heading">
      <div><h2 id="expense-category-trend-title">Andamento spese per categoria</h2><p className="muted">Confronto degli importi registrati per data della spesa.</p></div>
      <div className="income-channel-trend-controls">
        <div className="trend-mode-toggle" role="group" aria-label="Visualizzazione grafico spese">
          <button type="button" className={`trend-mode-button ${view === 'total' ? 'is-active' : ''}`} onClick={() => setView('total')}>Totale</button>
          <button type="button" className={`trend-mode-button ${view === 'categories' ? 'is-active' : ''}`} onClick={() => setView('categories')}>Per categoria</button>
        </div>
        <div className="trend-mode-toggle income-channel-period-toggle" role="group" aria-label="Periodo grafico spese">
          {([['year', 'Anno'], ['q1', 'Tri 1'], ['q2', 'Tri 2'], ['q3', 'Tri 3'], ['q4', 'Tri 4']] as const).map(([value, label]) => <button type="button" key={value} className={`trend-mode-button ${period === value ? 'is-active' : ''}`} onClick={() => setPeriod(value)}>{label}</button>)}
        </div>
      </div>
    </div>
    <div className="income-channel-trend-kpis">
      <div><span>Totale periodo</span><strong>{money.format(periodTotal)}</strong></div>
      <div><span>Numero spese</span><strong>{periodCount}</strong></div>
      <div><span>Categoria principale</span><strong>{leading ? `${leading.icon ?? '•'} ${leading.name}` : '—'}</strong></div>
      <div><span>{period === 'year' ? 'Mese più oneroso' : 'Settimana più onerosa'}</span><strong>{peak && peak.total > 0 ? `${peak.label} · ${money.format(peak.total)}` : '—'}</strong></div>
    </div>
    <div className="income-channel-trend-scroll">
      <div className={`income-channel-trend-plot ${period === 'year' ? '' : 'is-quarter'}`} role="img" aria-label={`Andamento spese ${data.year}, ${period === 'year' ? 'anno' : period}`}>
        {buckets.map(bucket => <div className="income-channel-month" key={bucket.from}>
          <strong className="income-channel-month-value">{money.format(bucket.total)}</strong>
          <div className="income-channel-bar-stage">
            {bucket.total > 0 ? view === 'total' ? <Link href={rangeHref(bucket.from, bucket.to)} className="income-channel-total-bar expense-category-total-bar" style={{height: `${bucket.total / max * 100}%`}} title={`${bucket.label}: ${money.format(bucket.total)}`}/> :
              <div className="income-channel-stacked-bar" style={{height: `${bucket.total / max * 100}%`}}>{bucket.channels.map(category => <Link key={category.id} href={rangeHref(bucket.from, bucket.to, category.name)} style={{height: `${category.total / bucket.total * 100}%`, background: seriesColors.get(category.id)}} title={`${category.name}, ${bucket.label}: ${money.format(category.total)}`}/>)}</div> : null}
          </div>
          <span>{bucket.label}</span><small>{bucket.count} mov.</small>
        </div>)}
      </div>
    </div>
    {view === 'categories' ? <div className="income-channel-trend-legend" aria-label="Legenda categorie spese">{periodCategories.map(category => <div key={category.id}><span style={{background: seriesColors.get(category.id)}}/><strong>{category.icon ?? '•'} {category.name}</strong><small>{money.format(category.total)} · {periodTotal ? (category.total / periodTotal * 100).toFixed(1) : '0.0'}%</small></div>)}</div> : null}
  </section>;
}
