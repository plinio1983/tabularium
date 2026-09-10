import Link from 'next/link';
import {moneyTone, monthName} from '@/lib/money';
import type {getPeriodReport} from '@/lib/reports';
type DashboardMonth = Awaited<ReturnType<typeof getPeriodReport>>['monthlyBreakdown'][number];

function chartEuro(value: number | string | null | undefined) {
    const n = Number(value ?? 0);
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(n);
}

const dashboardChartColors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0f766e', '#db2777', '#64748b'];

function capitalizedMonthName(month: number) {
    const name = monthName(month);
    return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
}

function monthValue(year: number, month: number) { return `${year}-${String(month).padStart(2, '0')}`; }

function periodRangeQuery(periods: Array<{ year: number; month: number }>) {
    if (!periods.length) return '';
    const first = periods[0];
    const last = periods[periods.length - 1];
    return new URLSearchParams({
        billingPeriodFrom: monthValue(first.year, first.month),
        billingPeriodTo: monthValue(last.year, last.month)
    }).toString();
}

function periodLink(path: '/expenses' | '/incomes', periods: Array<{
    year: number;
    month: number
}>, extra?: Record<string, string>) {
    const query = new URLSearchParams(periodRangeQuery(periods));
    Object.entries(extra ?? {}).forEach(([key, value]) => query.set(key, value));
    const qs = query.toString();
    return `${path}${qs ? `?${qs}` : ''}`;
}



export function groupedChartData(data: Array<{ name: string; code: string; total: number }>, limit = 6) {
    if (data.length <= limit) return data;
    const visible = data.slice(0, limit - 1);
    const remainder = data.slice(limit - 1).reduce((sum, item) => sum + item.total, 0);
    return [...visible, {name: 'Altre voci', code: 'ALTRO', total: remainder}];
}

export function ExpenseCompositionChart({data, total, incomeTotal}: {
    data: Array<{ name: string; code: string; total: number }>;
    total: number;
    incomeTotal: number;
}) {
    const groupedData = groupedChartData(data);
    const totalImpact = incomeTotal ? total / incomeTotal * 100 : 0;
    const totalImpactTone = totalImpact > 100 ? 'is-critical' : totalImpact > 75 ? 'is-warning' : 'is-ok';
    return <section className="card dashboard-composition-card">
        <div className="card-heading-row">
            <div>
                <h2>Composizione e impatto delle spese</h2>
                <p className="muted">Peso di ogni categoria sulle uscite e sugli incassi del periodo.</p>
            </div>
        </div>
        <div className={`dashboard-expense-impact-total ${totalImpactTone}`}>
            <div className="dashboard-expense-impact-value">
                <span>Impatto totale delle spese sugli incassi</span>
                <strong>{totalImpact.toFixed(1)}%</strong>
            </div>
            <div className="dashboard-expense-impact-amounts">
                <div><span>Spese totali</span><strong>{chartEuro(total)}</strong></div>
                <div><span>Incassi totali</span><strong>{chartEuro(incomeTotal)}</strong></div>
            </div>
            <div className="dashboard-expense-impact-track" aria-label={`Le spese rappresentano il ${totalImpact.toFixed(1)}% degli incassi`}>
                <i style={{width: `${Math.min(Math.max(totalImpact, 0), 100)}%`}}/>
            </div>
            <p>Ogni €100 incassati, <strong>{chartEuro(totalImpact)}</strong> sono assorbiti dalle spese.</p>
        </div>
        {groupedData.length ? <div className="dashboard-composition-list">
            {groupedData.map((item, index) => {
                const percentage = total ? item.total / total * 100 : 0;
                const incomeImpact = incomeTotal ? item.total / incomeTotal * 100 : 0;
                return <div className="dashboard-composition-row" key={`${item.code}-${item.name}`}>
                    <div className="dashboard-composition-label">
                        <span className="composition-pie-dot" style={{background: dashboardChartColors[index % dashboardChartColors.length]}}/>
                        <strong>{item.name}</strong>
                    </div>
                    <div className="dashboard-composition-bar-wrap">
                        <i style={{
                            width: `${Math.min(Math.max(percentage, 0), 100)}%`,
                            background: dashboardChartColors[index % dashboardChartColors.length]
                        }}/>
                    </div>
                    <div className="dashboard-composition-values">
                        <strong className={moneyTone(item.total)}>{chartEuro(item.total)}</strong>
                        <span><small>Quota spese</small><strong>{percentage.toFixed(1)}%</strong></span>
                        <span><small>Impatto incassi</small><strong>{incomeImpact.toFixed(1)}%</strong></span>
                    </div>
                </div>;
            })}
        </div> : <p className="muted">Nessuna spesa presente per il periodo selezionato.</p>}
    </section>;
}


export function FiscalNonFiscalOverview({totals, year, periods}: {
    totals: Awaited<ReturnType<typeof getPeriodReport>>['summary'];
    year: number;
    periods: Array<{ year: number; month: number }>;
}) {
    const incomeTotal = totals.incassoTotale;
    const expenseTotal = totals.speseTotali;
    const fiscalIncome = totals.incassoFiscale;
    const nonFiscalIncome = totals.incassoNonFiscale;
    const fiscalExpenses = totals.usciteFiscali;
    const nonFiscalExpenses = totals.usciteNonFiscali;
    const otherExpenses = Math.max(expenseTotal - fiscalExpenses - nonFiscalExpenses, 0);
    const percentage = (value: number, total: number) => total ? value / total * 100 : 0;
    const fiscalIncomePercentage = percentage(fiscalIncome, incomeTotal);
    const nonFiscalIncomePercentage = percentage(nonFiscalIncome, incomeTotal);
    const fiscalExpensePercentage = percentage(fiscalExpenses, expenseTotal);
    const nonFiscalExpensePercentage = percentage(nonFiscalExpenses, expenseTotal);
    const otherExpensePercentage = percentage(otherExpenses, expenseTotal);
    const fiscalBalance = fiscalIncome - fiscalExpenses;
    const nonFiscalBalance = nonFiscalIncome - nonFiscalExpenses;
    const nonFiscalTone = (value: number) => value > 25 ? 'is-critical' : value > 10 ? 'is-warning' : '';
    const cards = [
        {
            label: 'Entrate fiscali',
            value: fiscalIncome,
            percentage: fiscalIncomePercentage,
            percentageOf: 'delle entrate',
            className: 'is-fiscal-income',
            href: periodLink('/incomes', periods, {fiscal: 'yes'})
        },
        {
            label: 'Entrate non fiscali',
            value: nonFiscalIncome,
            percentage: nonFiscalIncomePercentage,
            percentageOf: 'delle entrate',
            className: `is-non-fiscal-income ${nonFiscalTone(nonFiscalIncomePercentage)}`,
            href: periodLink('/incomes', periods, {fiscal: 'no'})
        },
        {
            label: 'Spese fiscali',
            value: fiscalExpenses,
            percentage: fiscalExpensePercentage,
            percentageOf: 'delle spese',
            className: 'is-fiscal-expense',
            href: periodLink('/expenses', periods, {declared: 'yes'})
        },
        {
            label: 'Spese non fiscali',
            value: nonFiscalExpenses,
            percentage: nonFiscalExpensePercentage,
            percentageOf: 'delle spese',
            className: `is-non-fiscal-expense ${nonFiscalTone(nonFiscalExpensePercentage)}`,
            href: periodLink('/expenses', periods, {declared: 'no'})
        }
    ];

    return <section className="card fiscal-non-fiscal-overview">
        <div className="card-heading-row">
            <div>
                <h2>Panoramica fiscale e non fiscale</h2>
                <p className="muted">Composizione di entrate e spese nel periodo selezionato.</p>
            </div>
            <span className="badge">{periods.length === 3 ? `${Math.ceil(periods[0].month / 3)}° trimestre` : 'Anno'} {year}</span>
        </div>
        <div className="fiscal-overview-matrix">
            {cards.map(item =>
                <Link className={`fiscal-overview-metric ${item.className}`} href={item.href} key={item.label}>
                    <span>{item.label}</span>
                    <strong>{chartEuro(item.value)}</strong>
                    <div className="fiscal-overview-percentage">
                        <strong>{item.percentage.toFixed(1)}%</strong>
                        <span>{item.percentageOf}</span>
                    </div>
                </Link>)}
        </div>
        <div className="fiscal-overview-comparison">
            <div className="fiscal-overview-comparison-row">
                <div className="fiscal-overview-comparison-heading">
                    <strong>Entrate</strong>
                    <span>Totale {chartEuro(incomeTotal)}</span>
                </div>
                <div className="fiscal-overview-stacked-bar" aria-label={`Entrate: ${fiscalIncomePercentage.toFixed(1)}% fiscali, ${nonFiscalIncomePercentage.toFixed(1)}% non fiscali`}>
                    <i className="is-fiscal-income" style={{width: `${Math.min(Math.max(fiscalIncomePercentage, 0), 100)}%`}}/>
                    <i className="is-non-fiscal-income" style={{width: `${Math.min(Math.max(nonFiscalIncomePercentage, 0), 100)}%`}}/>
                </div>
                <div className="fiscal-overview-bar-labels">
                    <span className="is-fiscal-income">Fiscali <strong>{fiscalIncomePercentage.toFixed(1)}%</strong></span>
                    <span className="is-non-fiscal-income">Non fiscali <strong>{nonFiscalIncomePercentage.toFixed(1)}%</strong></span>
                </div>
            </div>
            <div className="fiscal-overview-comparison-row">
                <div className="fiscal-overview-comparison-heading">
                    <strong>Spese</strong>
                    <span>Totale {chartEuro(expenseTotal)}</span>
                </div>
                <div className="fiscal-overview-stacked-bar" aria-label={`Spese: ${fiscalExpensePercentage.toFixed(1)}% fiscali, ${nonFiscalExpensePercentage.toFixed(1)}% non fiscali`}>
                    <i className="is-fiscal-expense" style={{width: `${Math.min(Math.max(fiscalExpensePercentage, 0), 100)}%`}}/>
                    <i className="is-non-fiscal-expense" style={{width: `${Math.min(Math.max(nonFiscalExpensePercentage, 0), 100)}%`}}/>
                    {otherExpenses ?
                        <i className="is-other-expense" style={{width: `${Math.min(Math.max(otherExpensePercentage, 0), 100)}%`}}/> : null}
                </div>
                <div className="fiscal-overview-bar-labels">
                    <span className="is-fiscal-expense">Fiscali <strong>{fiscalExpensePercentage.toFixed(1)}%</strong></span>
                    <span className="is-non-fiscal-expense">Non fiscali <strong>{nonFiscalExpensePercentage.toFixed(1)}%</strong></span>
                    {otherExpenses ?
                        <span className="is-other-expense">
                            <span className="hidden-xs-up">Liquid. IVA/altre</span>
                            <span className="hidden-xs-down">Liquidazioni IVA/altre</span>
                            <strong>{otherExpensePercentage.toFixed(1)}%</strong>
                        </span> : null}
                </div>
            </div>
        </div>
        <div className="fiscal-overview-balances">
            <div>
                <span>Saldo fiscale operativo</span>
                <strong className={moneyTone(fiscalBalance)}>{chartEuro(fiscalBalance)}</strong>
                <small>Entrate fiscali meno spese fiscali</small>
            </div>
            <div>
                <span>Saldo non fiscale</span>
                <strong className={moneyTone(nonFiscalBalance)}>{chartEuro(nonFiscalBalance)}</strong>
                <small>Entrate non fiscali meno spese non fiscali</small>
            </div>
        </div>
        <p className="fiscal-overview-note">Il saldo fiscale operativo è un confronto tra flussi registrati e non coincide con l’utile fiscale, che considera imponibile e IVA detraibile.</p>
    </section>;
}


export function MonthlyProfitComparisonChart({months, year, mode, returnTo}: { months: DashboardMonth[]; year: number; mode: 'overall' | 'fiscal'; returnTo: string }) {
    const monthReportLink = (year: number, month: number) => `/months/${year}/${month}?mode=${mode}&returnTo=${encodeURIComponent(returnTo)}`;
    const totalIncome = months.reduce((sum, month) => sum + month.totals.incassoTotale, 0);
    const totalNetProfit = months.reduce((sum, month) => sum + month.totals.utileNetto, 0);
    const totalFiscalProfit = months.reduce((sum, month) => sum + month.totals.utileFiscale, 0);
    const monthlyRatio = (value: number, income: number) => {
        const ratio = income ? value / Math.abs(income) * 100 : 0;
        return Math.abs(ratio) < 0.05 ? 0 : ratio;
    };
    const ratios = months.flatMap(month => [
        monthlyRatio(month.totals.utileLordo, month.totals.incassoTotale),
        monthlyRatio(month.totals.utileNetto, month.totals.incassoTotale),
        monthlyRatio(month.totals.utileFiscale, month.totals.incassoTotale)
    ]);
    const hasNegativeValues = ratios.some(value => Number.isFinite(value) && value < 0);
    const negativeExtent = hasNegativeValues ? Math.max(...ratios.map(value => Math.max(-value, 0)), 0) : 0;
    const totalExtent = Math.max(negativeExtent + 100, 1);
    const zeroPosition = Math.min(25, negativeExtent / totalExtent * 100);
    const annualRatio = (value: number) => totalIncome ? value / Math.abs(totalIncome) * 100 : 0;
    const rankedMonths = months.filter(month => month.totals.incassoTotale || month.totals.speseTotali);
    const bestMonth = rankedMonths.reduce<DashboardMonth | null>(
        (best, month) => !best || month.totals.utileNetto > best.totals.utileNetto ? month : best,
        null
    );
    const worstMonth = rankedMonths.reduce<DashboardMonth | null>(
        (worst, month) => !worst || month.totals.utileNetto < worst.totals.utileNetto ? month : worst,
        null
    );
    const barStyle = (percentage: number) => {
        const boundedPercentage = percentage < 0
            ? Math.max(percentage, -negativeExtent)
            : Math.min(percentage, 100);
        // Compress the negative range into at most a quarter of the track.
        const width = boundedPercentage < 0
            ? Math.abs(boundedPercentage) / negativeExtent * zeroPosition
            : boundedPercentage / 100 * (100 - zeroPosition);
        return {
            left: percentage < 0 ? `${zeroPosition - width}%` : `${zeroPosition}%`,
            width: `${width}%`
        };
    };

    return <section className="card dashboard-insight-card monthly-profit-comparison-card">
        <div className="card-heading-row">
            <div>
                <h2>Andamento e report mensile</h2>
                <p className="muted">Entrate, uscite, utile netto e fiscale con dettaglio per ogni mese del periodo selezionato ({year}).</p>
            </div>
            <div className="dashboard-chart-main-totals">
                <div className="dashboard-chart-main-total">
                    <span>Entrate periodo</span>
                    <strong>{chartEuro(totalIncome)}</strong>
                    <span className="dashboard-chart-main-total-percent text-muted">100%</span>
                </div>
                <div className="dashboard-chart-main-total">
                    <span className="">Utile netto periodo · </span>
                    <strong className={moneyTone(totalNetProfit)}>{chartEuro(totalNetProfit)}</strong>
                    <span className="dashboard-chart-main-total-percent text-green">{annualRatio(totalNetProfit).toFixed(1)}%</span>
                </div>
                <div className="dashboard-chart-main-total">
                    <span className="">Utile fiscale periodo · </span>
                    <strong className={moneyTone(totalFiscalProfit)}>{chartEuro(totalFiscalProfit)}</strong>
                    <span className="dashboard-chart-main-total-percent text-secondary">{annualRatio(totalFiscalProfit).toFixed(1)}%</span>
                </div>
            </div>
        </div>
        <div className="monthly-profit-comparison-legend" aria-label="Legenda del grafico">
            <span className="is-gross">Margine lordo</span>
            <span className="is-net">Utile netto</span>
            <span className="is-fiscal">Utile fiscale</span>
            <small>Le percentuali sono calcolate sulle entrate del mese.</small>
        </div>
        {months.length ? <div className="monthly-profit-comparison-list">
            {months.map(month => {
                const netProfit = month.totals.utileNetto;
                const fiscalProfit = month.totals.utileFiscale;
                const grossProfit = month.totals.utileLordo;
                const netPercentage = monthlyRatio(netProfit, month.totals.incassoTotale);
                const fiscalPercentage = monthlyRatio(fiscalProfit, month.totals.incassoTotale);
                const grossPercentage = monthlyRatio(grossProfit, month.totals.incassoTotale);
                const isBest = bestMonth?.month === month.month && bestMonth?.year === month.year;
                const isWorst = worstMonth?.month === month.month && worstMonth?.year === month.year && worstMonth !== bestMonth;
                return <div className={`monthly-profit-comparison-row ${isBest ? 'is-best' : ''} ${isWorst ? 'is-worst' : ''}`}
                            key={`${month.year}-${month.month}`}>
                    <div className="monthly-profit-comparison-month">
                        <Link href={monthReportLink(month.year, month.month)}>{capitalizedMonthName(month.month)}</Link>
                        {isBest ? <small>Migliore</small> : isWorst ? <small>Più debole</small> : null}
                    </div>
                    <div className="monthly-performance-cashflow">
                        <div><span>Entrate</span><strong>{chartEuro(month.totals.incassoTotale)}</strong></div>
                        <div><span>Uscite</span><strong>{chartEuro(month.totals.speseTotali)}</strong></div>
                    </div>
                    <div className="monthly-profit-comparison-series">
                        <div>
                            <span>Lordo</span>
                            <div className={`monthly-profit-comparison-axis ${hasNegativeValues ? 'has-negative-values' : ''}`}
                                 aria-label={`Margine lordo ${grossPercentage.toFixed(1)}% dell’incasso di ${capitalizedMonthName(month.month)}`}>
                                <i className={grossProfit < 0 ? 'is-negative' : 'is-gross'} style={barStyle(grossPercentage)}/>
                                {hasNegativeValues ? <b style={{left: `${zeroPosition}%`}}/> : null}
                            </div>
                            <strong className={moneyTone(grossProfit)}>{chartEuro(grossProfit)}</strong>
                            <em className={moneyTone(grossProfit)}>{grossPercentage.toFixed(1)}%</em>
                        </div>
                        <div>
                            <span>Netto</span>
                            <div className={`monthly-profit-comparison-axis ${hasNegativeValues ? 'has-negative-values' : ''}`}
                                 aria-label={`Utile netto ${netPercentage.toFixed(1)}% dell’incasso di ${capitalizedMonthName(month.month)}`}>
                                <i className={netProfit < 0 ? 'is-negative' : 'is-net'} style={barStyle(netPercentage)}/>
                                {hasNegativeValues ? <b style={{left: `${zeroPosition}%`}}/> : null}
                            </div>
                            <strong className={moneyTone(netProfit)}>{chartEuro(netProfit)}</strong>
                            <em className={moneyTone(netProfit)}>{netPercentage.toFixed(1)}%</em>
                        </div>
                        <div>
                            <span>Fiscale</span>
                            <div className={`monthly-profit-comparison-axis ${hasNegativeValues ? 'has-negative-values' : ''}`}
                                 aria-label={`Utile fiscale ${fiscalPercentage.toFixed(1)}% dell’incasso di ${capitalizedMonthName(month.month)}`}>
                                <i className={fiscalProfit < 0 ? 'is-negative' : 'is-fiscal'} style={barStyle(fiscalPercentage)}/>
                                {hasNegativeValues ? <b style={{left: `${zeroPosition}%`}}/> : null}
                            </div>
                            <strong className={moneyTone(fiscalProfit)}>{chartEuro(fiscalProfit)}</strong>
                            <em className={moneyTone(fiscalProfit)}>{fiscalPercentage.toFixed(1)}%</em>
                        </div>
                    </div>
                    <details className="monthly-performance-details">
                        <summary>Mostra dettagli</summary>
                        <div>
                            <span>Entrate non fiscali <strong>{chartEuro(month.totals.incassoNonFiscale)}</strong></span>
                            <span>Spese non fiscali <strong>{chartEuro(month.totals.usciteNonFiscali)}</strong></span>
                            <span>Spese non saldate <strong>{chartEuro(month.totals.nonSaldato)}</strong></span>
                            <span>Saldo IVA <strong className={moneyTone(month.totals.debitoIva)}>{chartEuro(month.totals.debitoIva)}</strong></span>
                            <Link className="btn btn-sm btn-link" href={monthReportLink(month.year, month.month)}>Apri report mensile</Link>
                        </div>
                    </details>
                </div>;
            })}
        </div> : <p className="muted">Nessun utile mensile disponibile per il periodo selezionato.</p>}
    </section>;
}
