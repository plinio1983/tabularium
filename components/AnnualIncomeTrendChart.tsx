'use client';

import {useMemo, useState} from 'react';
import Link from 'next/link';
import type {IncomeTrendData, IncomeTrendInterval, IncomeTrendPoint} from '@/lib/income-trend';

type Mode = 'periodic' | 'cumulative';

const euro = new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0});

function rangeHref(point: IncomeTrendPoint) {
    return `/incomes?creditDateFrom=${point.from}&creditDateTo=${point.to}`;
}

export default function AnnualIncomeTrendChart({initialData}: { initialData: IncomeTrendData }) {
    const [data, setData] = useState(initialData);
    const [interval, setInterval] = useState<IncomeTrendInterval>(initialData.interval);
    const [mode, setMode] = useState<Mode>('periodic');
    const [comprehensive, setComprehensive] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function loadTrend(nextInterval: IncomeTrendInterval, nextComprehensive: boolean) {
        if (loading) return;
        const previousInterval = interval;
        const previousComprehensive = comprehensive;
        setInterval(nextInterval);
        setComprehensive(nextComprehensive);
        setSelectedIndex(null);
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/dashboard/income-trend?year=${data.year}&interval=${nextInterval}${nextComprehensive ? '' : '&completed=1'}`, {cache: 'no-store'});
            if (!response.ok) throw new Error('Impossibile caricare il grafico.');
            setData(await response.json());
        } catch (reason) {
            setInterval(previousInterval);
            setComprehensive(previousComprehensive);
            setError(reason instanceof Error ? reason.message : 'Impossibile caricare il grafico.');
        } finally {
            setLoading(false);
        }
    }

    function changeInterval(next: IncomeTrendInterval) {
        if (next !== interval) void loadTrend(next, comprehensive);
    }

    const values = useMemo(() => data.points.map(point => mode === 'cumulative' ? point.cumulative : point.value), [data, mode]);
    const maxValue = Math.max(...values, 1);
    const width = interval === 'day' ? Math.max(980, data.points.length * 15) : interval === 'week' ? 1080 : 900;
    const height = 310;
    const padding = {top: 22, right: 24, bottom: 42, left: 76};
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const x = (index: number) => padding.left + (data.points.length <= 1 ? 0 : index / (data.points.length - 1) * plotWidth);
    const y = (value: number) => padding.top + plotHeight - value / maxValue * plotHeight;
    const line = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
    const area = values.length ? `${padding.left},${padding.top + plotHeight} ${line} ${x(values.length - 1)},${padding.top + plotHeight}` : '';
    const selected = selectedIndex === null ? null : data.points[selectedIndex];
    const peakIndex = data.points.length ? data.points.reduce((best, point, index) => point.value > data.points[best].value ? index : best, 0) : -1;
    const peak = peakIndex >= 0 ? data.points[peakIndex] : null;
    const labelEvery = interval === 'day' ? 30 : interval === 'week' ? 4 : 1;

    return <section id="incassi" className="card annual-income-trend-card dashboard-anchor-section">
        <div className="card-heading-row annual-income-trend-heading">
            <div>
                <div>
                    <h2>Andamento annuale incassi</h2>
                    <p className="muted">Incassi effettivamente accreditati per data di accredito nel {data.year}.</p>
                </div>
            </div>
            <div className="annual-income-trend-controls">
                <label className="switch-toggle-field switch-clean switch-inline wide annual-income-trend-scope-switch">
                    <span>Complessivo</span>
                    <span className="switch">
                        <input type="checkbox" checked={comprehensive} disabled={loading} onChange={event => void loadTrend(interval, event.currentTarget.checked)}/>
                        <span className="slider"/>
                    </span>
                </label>
                <div className="trend-mode-toggle" role="group" aria-label="Intervallo temporale">
                    {([['day', 'Giorno'], ['week', 'Settimana'], ['month', 'Mese']] as const).map(([value, label]) =>
                        <button type="button" key={value} disabled={loading} className={`trend-mode-button ${interval === value ? 'is-active' : ''}`} onClick={() => changeInterval(value)}>{label}</button>)}
                </div>
                <div className="trend-mode-toggle" role="group" aria-label="Modalità grafico">
                    <button type="button" className={`trend-mode-button ${mode === 'periodic' ? 'is-active' : ''}`} onClick={() => {
                        setMode('periodic');
                        setSelectedIndex(null);
                    }}>Periodico
                    </button>
                    <button type="button" className={`trend-mode-button ${mode === 'cumulative' ? 'is-active' : ''}`} onClick={() => {
                        setMode('cumulative');
                        setSelectedIndex(null);
                    }}>Cumulativo
                    </button>
                </div>
            </div>
        </div>

        <div className="annual-income-trend-kpis">
            <div><span>Totale accreditato</span><strong>{euro.format(data.total)}</strong></div>
            <div><span>Numero incassi</span><strong>{data.count}</strong></div>
            <div>
                <span>Media per intervallo</span><strong>{euro.format(data.points.length ? data.total / data.points.length : 0)}</strong>
            </div>
            <div>
                <span>Intervallo migliore</span><strong>{peak ? `${peak.label} · ${euro.format(peak.value)}` : '—'}</strong>
            </div>
        </div>

        {error ? <p className="inline-warning">{error}</p> : null}
        <div className={`annual-income-trend-scroll ${loading ? 'is-loading' : ''}`}>
            <svg className="annual-income-trend-chart" viewBox={`0 0 ${width} ${height}`} style={{width}} role="img" aria-label={`Andamento incassi ${data.year}, intervallo ${interval}`}>
                {[0, .25, .5, .75, 1].map(ratio => <g key={ratio}>
                    <line x1={padding.left} x2={width - padding.right} y1={y(maxValue * ratio)} y2={y(maxValue * ratio)} className="annual-income-trend-grid-line"/>
                    <text x={padding.left - 12} y={y(maxValue * ratio) + 4} textAnchor="end" className="annual-income-trend-axis-label">{euro.format(maxValue * ratio)}</text>
                </g>)}
                {area ? <polygon points={area} className="annual-income-trend-area"/> : null}
                {line ? <polyline points={line} className="annual-income-trend-line"/> : null}
                {data.points.map((point, index) => <g key={point.from}>
                    {(index % labelEvery === 0 || index === data.points.length - 1) ?
                        <text x={x(index)} y={height - 14} textAnchor="middle" className="annual-income-trend-date-label">{point.label.split(' – ')[0]}</text> : null}
                    <circle cx={x(index)} cy={y(values[index])} r={selectedIndex === index ? 6 : 3.5} tabIndex={0}
                            className={`annual-income-trend-point ${point.value > 0 ? 'has-data' : ''} ${selectedIndex === index ? 'is-selected' : ''}`}
                            aria-label={`${point.label}: ${euro.format(values[index])}`}
                            onMouseEnter={() => setSelectedIndex(index)} onFocus={() => setSelectedIndex(index)} onClick={() => setSelectedIndex(index)}/>
                </g>)}
            </svg>
        </div>

        {!data.points.length ?
            <p className="muted annual-income-trend-empty">Nessun mese concluso disponibile per l’anno selezionato.</p> : null}

        <div className={`annual-income-trend-selection ${selected ? '' : 'is-empty'}`}>
            {selected ? <>
                <div><span>Periodo</span><strong>{selected.label}</strong></div>
                <div>
                    <span>{mode === 'cumulative' ? 'Cumulato' : 'Incassato'}</span><strong>{euro.format(mode === 'cumulative' ? selected.cumulative : selected.value)}</strong>
                </div>
                <div><span>Movimenti</span><strong>{selected.count}</strong></div>
                <Link className="btn btn-sm btn-default" href={rangeHref(selected)}>Vedi incassi</Link>
            </> : <p className="muted">Seleziona un punto per vedere il dettaglio dell’intervallo.</p>}
        </div>
    </section>;
}
