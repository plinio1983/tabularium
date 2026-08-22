import type {ReactNode} from 'react';
import Link from 'next/link';
import {prisma} from '@/lib/prisma';
import {AutoSubmitSelect} from '@/components/AutoSubmitSelect';
import {euro, moneyTone, monthName} from '@/lib/money';
import {
    fiscalQuarterMonthsByIndex,
    getAccountingDashboardReport,
    getOrderDateMonthSummary,
    getOrderDatePeriodSummary
} from '@/lib/reports';
import DashboardFiscalAjax from '@/components/DashboardFiscalAjax';
import DashboardSectionNav from '@/components/DashboardSectionNav';
import {requireWorkspace} from '@/lib/auth';
import {calendarDayNumber, yearMonthInTimeZone, zonedMidnightUtc} from '@/lib/company-time';
import NewExpensePanel from '@/components/NewExpensePanel';
import ExpenseNewTriggerButton from '@/components/ExpenseNewTriggerButton';
import {orderBanks, orderExpenseCategories, orderPaymentMethods} from '@/lib/workspace-defaults';
import IncomeSalesChannelTrendChart from '@/components/IncomeSalesChannelTrendChart';
import {aggregateIncomeChannelTrend} from '@/lib/income-channel-trend';
import ExpenseCategoryTrendChart from '@/components/ExpenseCategoryTrendChart';
import {aggregateExpenseCategoryTrend} from '@/lib/expense-category-trend';
import MonthlyEconomicTrendChart from '@/components/MonthlyEconomicTrendChart';

function fiscalQuarterLabel(periods: Array<{ year: number; month: number }>) {
    if (!periods.length) return '-';
    const first = periods[0];
    const last = periods[periods.length - 1];
    return `${monthName(first.month)} ${first.year} - ${monthName(last.month)} ${last.year}`;
}

function parseMonthSelection(value: string | undefined, fallbackYear: number, fallbackMonth: number) {
    if (!value || !/^\d{4}-\d{2}$/.test(value)) return {year: fallbackYear, month: fallbackMonth};
    const [year, month] = value.split('-').map(Number);
    return {year, month};
}

function parseYearSelection(value: string | undefined, fallbackYear: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : fallbackYear;
}

function parseQuarterSelection(value: string | undefined, fallbackYear: number, fallbackQuarterIndex: number) {
    const match = value?.match(/^(\d{4})-Q([1-4])$/);
    if (!match) return {year: fallbackYear, quarterIndex: fallbackQuarterIndex};
    return {year: Number(match[1]), quarterIndex: Number(match[2]) - 1};
}

function monthValue(year: number, month: number) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

function quarterValue(year: number, quarterIndex: number) {
    return `${year}-Q${quarterIndex + 1}`;
}

function capitalizedMonthName(month: number) {
    const name = monthName(month);
    return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
}

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

function monthReportLink(year: number, month: number) {
    return `/months/${year}/${month}?returnTo=${encodeURIComponent('/')}`;
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
        ? {orderDateFrom: range.from, orderDateTo: range.to}
        : {creditDateFrom: range.from, creditDateTo: range.to});
    Object.entries(extra ?? {}).forEach(([key, value]) => query.set(key, value));
    return `${path}?${query.toString()}`;
}


function SummaryMetric({label, value, highlight = false, warning = false, vat = false, href}: {
    label: string;
    value: number;
    highlight?: boolean;
    warning?: boolean;
    vat?: boolean;
    href?: string
}) {
    const boxClass = ["summary-metric", href ? "summary-metric-link" : "", highlight ? "summary-metric-highlight" : "", warning ? "summary-metric-warning" : "", vat ? "summary-metric-vat" : ""].filter(Boolean).join(' ');
    const valueClass = [highlight ? 'money-highlight' : '', warning ? 'money-warning' : '', vat ? 'money-vat' : ''].filter(Boolean).join(' ');
    const content = <><span>{label}</span><strong className={moneyTone(value, valueClass)}>{euro(value)}</strong></>;
    return href ? <Link className={boxClass} href={href}>{content}</Link> : <div className={boxClass}>{content}</div>;
}

function CountMetric({label, value, warning = false, href}: {
    label: string;
    value: number;
    warning?: boolean;
    href?: string
}) {
    const boxClass = ["summary-metric", href ? "summary-metric-link" : "", warning ? "summary-metric-warning" : ""].filter(Boolean).join(' ');
    const content = <><span>{label}</span><strong className={warning ? 'money-warning' : ''}>{value}</strong></>;
    return href ? <Link className={boxClass} href={href}>{content}</Link> : <div className={boxClass}>{content}</div>;
}

function FiscalSummaryCard({
                               title,
                               subtitle,
                               totals,
                               selector,
                               expensesHref,
                               unpaidExpensesHref,
                               incomesHref,
                               invoicesNotSentHref,
                               invoicesNotReceivedHref,
                               overdueExpensesHref,
                               fiscalOnly = false
                           }: {
    title: string;
    subtitle: string;
    totals: any;
    selector: ReactNode;
    expensesHref: string;
    unpaidExpensesHref: string;
    incomesHref: string;
    invoicesNotSentHref: string;
    invoicesNotReceivedHref: string;
    overdueExpensesHref: string;
    fiscalOnly?: boolean;
}) {
    return <div className="card fiscal-summary-card">
        <div className="card-heading-row">
            <div>
                <h2>{title}</h2>
                <p className="muted">{subtitle}</p>
            </div>
            {selector}
        </div>
        <div className="summary-metrics-grid summary-metrics-grid-priority fiscal-summary-metrics-ordered">
            {fiscalOnly ? <>
                <SummaryMetric label="Entrate fiscali" value={totals.incassoFiscale} highlight href={incomesHref}/>
                <SummaryMetric label="Imponibile" value={totals.imponibileIncassi} highlight/>
                <SummaryMetric label="Uscite fiscali" value={totals.usciteFiscali} highlight href={expensesHref}/>
                <SummaryMetric label="Utile fiscale" value={totals.utileFiscale} highlight/>
                <SummaryMetric label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0}
                               href={unpaidExpensesHref}/>
                <CountMetric label="Pagamenti scaduti" value={totals.fattureScaduteCount}
                             warning={totals.fattureScaduteCount > 0} href={overdueExpensesHref}/>
                <SummaryMetric label="Previsione saldo IVA" value={totals.debitoIva} highlight vat/>
                <CountMetric label="Fatture non inviate" value={totals.fattureNonInviate}
                             warning={totals.fattureNonInviate > 0} href={invoicesNotSentHref}/>
                <CountMetric label="Fatture non ricevute" value={totals.fattureNonRicevute}
                             warning={totals.fattureNonRicevute > 0} href={invoicesNotReceivedHref}/>
            </> : <>
                <SummaryMetric label="Entrate totali" value={totals.incassoTotale} highlight href={incomesHref}/>
                <SummaryMetric label="Utile netto" value={totals.utileNetto} highlight/>
                <SummaryMetric label="Utile fiscale" value={totals.utileFiscale} highlight/>
                <SummaryMetric label="Spese totali" value={totals.speseTotali} highlight href={expensesHref}/>
                <SummaryMetric label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0}
                               href={unpaidExpensesHref}/>
                <SummaryMetric label="Pagamenti scaduti" value={totals.fattureScadute}
                               warning={totals.fattureScadute > 0} href={overdueExpensesHref}/>
                <SummaryMetric label="Previsione saldo IVA" value={totals.debitoIva} highlight vat/>
                <CountMetric label="Fatture non inviate" value={totals.fattureNonInviate}
                             warning={totals.fattureNonInviate > 0} href={invoicesNotSentHref}/>
                <CountMetric label="Fatture non ricevute" value={totals.fattureNonRicevute}
                             warning={totals.fattureNonRicevute > 0} href={invoicesNotReceivedHref}/>
            </>}
        </div>
    </div>;
}


function MonthlyTrendCard({
                              title,
                              subtitle,
                              totals,
                              selector,
                              expensesHref,
                              unpaidExpensesHref,
                              incomesHref,
                              overdueExpensesHref
                          }: {
    title: string;
    subtitle: string;
    totals: any;
    selector: ReactNode;
    expensesHref: string;
    unpaidExpensesHref: string;
    incomesHref: string;
    overdueExpensesHref: string;
}) {
    return <div className="card fiscal-summary-card monthly-trend-card">
        <div className="card-heading-row">
            <div>
                <h2>{title}</h2>
                <p className="muted">{subtitle}</p>
            </div>
            {selector}
        </div>
        <div className="summary-metrics-grid summary-metrics-grid-priority fiscal-summary-metrics-ordered">
            <SummaryMetric label="Entrate totali" value={totals.incassoTotale} highlight href={incomesHref}/>
            <SummaryMetric label="Uscite totali" value={totals.speseTotali} highlight href={expensesHref}/>
            <SummaryMetric label="Utile netto" value={totals.utileNetto} highlight/>
            <SummaryMetric label="Spese non fiscali" value={totals.usciteNonFiscali} warning={totals.usciteNonFiscali > 0} href={expensesHref}/>
            <SummaryMetric label="Non saldato" value={totals.nonSaldato} warning={totals.nonSaldato > 0} href={unpaidExpensesHref}/>
            <CountMetric label="Pagamenti scaduti" value={totals.fattureScaduteCount} warning={totals.fattureScaduteCount > 0} href={overdueExpensesHref}/>
        </div>
    </div>;
}

function MoneyCell({value, highlight = false, tone = ''}: { value: number; highlight?: boolean; tone?: string }) {
    return <strong
        className={moneyTone(value, [highlight ? 'money-highlight' : '', tone].filter(Boolean).join(' '))}>{euro(value)}</strong>;
}

function AnnualMoneyWithRatio({
                                  value,
                                  denominator,
                                  highlight = false,
                                  percentageOverride,
                                  denominatorLabel = 'entrate totali'
                              }: {
    value: number;
    denominator: number;
    highlight?: boolean;
    percentageOverride?: number;
    denominatorLabel?: string;
}) {
    const percentage = percentageOverride ?? (denominator ? value / denominator * 100 : null);
    return <span className="dashboard-annual-value-with-ratio">
        <strong className={moneyTone(value, highlight ? 'money-highlight' : '')}>{euro(value)}</strong>
        <small aria-label={percentage === null ? 'Percentuale non disponibile' : `${percentage.toFixed(1)} percento delle ${denominatorLabel}`}>
            {percentage === null ? '—' : `${percentage.toFixed(1)}%`}
        </small>
    </span>;
}

function MobileMoneyCell({value}: { value: number }) {
    const formatted = new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
    return <strong className={moneyTone(value)}>{formatted}</strong>;
}

function MobileMoneyCellNoFormat({value, tone = ''}: { value: number; tone?: string }) {
    const formatted = new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
    return <strong className={tone}>{formatted}</strong>;
}

function MobilePercentCell({value, total, tone = ''}: { value: number; total: number; tone?: string }) {
    const percentage = total ? value / total : 0;
    const label = new Intl.NumberFormat('it-IT', {
        style: 'percent',
        maximumFractionDigits: 0
    }).format(percentage);
    const className = percentage <= 0 ? `${tone}` : (tone ? `${tone}` : '');
    return <strong className={className}>{label}</strong>;
}

function PercentCell({value, total, tone = ''}: { value: number; total: number; tone?: string }) {
    const percentage = total ? value / total : 0;
    const label = new Intl.NumberFormat('it-IT', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }).format(percentage);
    if (percentage <= 0) {
        return <strong className={`badge muted ${tone}`}>{label}</strong>;
    }
    return <strong className={tone ? `badge color-badge ${tone}` : 'badge'}>{label}</strong>;
}

function nonFiscalExpensePercentTone(value: number, total: number) {
    const percentage = total ? value / total : 0;
    if (percentage > 0.45) return 'tone-critical';
    if (percentage > 0.25) return 'tone-warning';
    if (percentage === 0) return 'money-zero';
    return '';
}

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

type DashboardPieItem = {
    name: string;
    code: string;
    total: number;
    visualValue?: number;
    href?: string;
};

function DashboardPieChart({
                               title,
                               description,
                               badge,
                               secondaryBadge,
                               data,
                               total,
                               visualTotal = total,
                               percentageTotal,
                               centerLabel = 'Totale',
                               centerValue,
                               centerDetail,
                               emptyMessage,
                               remainderLabel,
                               remainderName
                           }: {
    title: string;
    description: string;
    badge: ReactNode | null;
    secondaryBadge?: ReactNode;
    data: DashboardPieItem[];
    total: number;
    visualTotal?: number;
    percentageTotal?: number;
    centerLabel?: string;
    centerValue?: string;
    centerDetail?: string | null;
    emptyMessage: string;
    remainderLabel?: string;
    remainderName?: string;
}) {
    const chartValue = (item: DashboardPieItem) => item.visualValue ?? item.total;
    const chartTotal = data.reduce((sum, item) => sum + chartValue(item), 0);
    const denominator = Math.max(visualTotal, chartTotal);
    const percentageDenominator = percentageTotal ?? denominator;
    let cursor = 0;
    const segments = data.map((item, index) => {
        const start = denominator ? (cursor / denominator) * 100 : 0;
        cursor += chartValue(item);
        const end = denominator ? (cursor / denominator) * 100 : 0;
        return `${dashboardChartColors[index % dashboardChartColors.length]} ${start.toFixed(3)}% ${end.toFixed(3)}%`;
    });
    if (denominator > chartTotal) {
        segments.push(`#eef1f7 ${((chartTotal / denominator) * 100).toFixed(3)}% 100%`);
    }
    const background = segments.length ? `conic-gradient(${segments.join(', ')})` : undefined;
    const legendContent = <>
        {data.map((item, index) => {
            const percentage = percentageDenominator ? (chartValue(item) / percentageDenominator) * 100 : 0;
            const barWidth = Math.min(percentage, 100);
            const rowContent = <>
                <div className="composition-pie-legend-row">
                    <span className="composition-pie-dot" style={{background: dashboardChartColors[index % dashboardChartColors.length]}}/>
                    <div>
                        <strong className="hidden-mobile">{item.code}</strong>
                        <span>{item.name}</span>
                    </div>
                    <div className="flex-grow justify-end">
                        <strong className={moneyTone(item.total)}>{chartEuro(item.total)}</strong>
                        <small>{percentage.toFixed(1)}%</small>
                    </div>
                </div>
                <div className="composition-pie-bar" style={{
                    width: `${barWidth.toFixed(1)}%`,
                    background: dashboardChartColors[index % dashboardChartColors.length]
                }}/>
            </>;
            return item.href ?
                <Link className="composition-pie-row-wrap composition-pie-row-link" href={item.href} key={`${item.code}-${item.name}`}>{rowContent}</Link> :
                <div className="composition-pie-row-wrap" key={`${item.code}-${item.name}`}>{rowContent}</div>;
        })}
        {denominator > chartTotal && remainderLabel && remainderName ? <div className="composition-pie-legend-row">
            <span className="composition-pie-dot composition-pie-dot-muted"/>
            <div><strong>{remainderLabel}</strong><span>{remainderName}</span></div>
            <div>
                <strong>{chartEuro(denominator - chartTotal)}</strong><small>{(((denominator - chartTotal) / percentageDenominator) * 100).toFixed(1)}%</small>
            </div>
        </div> : null}
    </>;

    return <div className="card category-chart-card composition-pie-card">
        <div className="card-heading-row">
            <div>
                <h2>{title}</h2>
                <p className="muted">{description}</p>
            </div>
            {badge || secondaryBadge ? <div className="dashboard-chart-main-totals">
                {badge ? <div className="dashboard-chart-main-total">{badge}</div> : null}
                {secondaryBadge ? <div className="dashboard-chart-main-total">{secondaryBadge}</div> : null}
            </div> : null}
        </div>
        {data.length && denominator > 0 ? <div className="composition-pie-layout">
            <div className="composition-pie" style={{background}} aria-label={title}>
                <div>
                    <span>{centerLabel}</span>
                    <strong className="main-label">{centerValue ?? chartEuro(total)}</strong>
                    {centerDetail === null ? null : <span>{centerDetail ?? chartEuro(total.toFixed(2))}</span>}
                </div>
            </div>
            <div className="composition-pie-legend dashboard-pie-legend-desktop">{legendContent}</div>
            <details className="dashboard-pie-legend-collapsible">
                <summary>
                    <span className="dashboard-pie-legend-show">Mostra legenda</span>
                    <span className="dashboard-pie-legend-hide">Nascondi legenda</span>
                    <span className="dashboard-pie-legend-caret" aria-hidden="true">⌄</span>
                </summary>
                <div className="composition-pie-legend">{legendContent}</div>
            </details>
        </div> : <p className="muted">{emptyMessage}</p>}
    </div>;
}

function groupedExpenseIncomeImpactData(data: Array<{
    name: string;
    code: string;
    total: number
}>, incomeTotal: number) {
    return incomeTotal > 0 ? data.reduce((items, item) => {
        const percentage = (item.total / incomeTotal) * 100;
        if (percentage >= 5) return [...items, item];
        const other = items.find(entry => entry.code === 'ALTRO');
        if (other) {
            other.total += item.total;
            return items;
        }
        return [...items, {name: 'Altro', code: 'ALTRO', total: item.total}];
    }, [] as Array<{ name: string; code: string; total: number }>).sort((a, b) => b.total - a.total) : data;
}

function ExpenseCategoryIncomeImpactChart({
                                              data,
                                              incomeTotal
                                          }: {
    data: Array<{ name: string; code: string; total: number }>;
    incomeTotal: number;
}) {
    const groupedData = groupedChartData(groupedExpenseIncomeImpactData(data, incomeTotal));
    const expenseTotal = groupedData.reduce((sum, item) => sum + item.total, 0);
    return <DashboardPieChart
        title="Impatto spese su incasso totale"
        description="Percentuale di ogni categoria spese rispetto alle entrate totali dell’anno fiscale."
        badge={<><span>Entrate totali</span><strong>{chartEuro(incomeTotal)}</strong></>}
        secondaryBadge={<><span>Uscite totali</span><strong>{chartEuro(expenseTotal)}</strong></>}
        data={groupedData}
        total={expenseTotal}
        visualTotal={Math.max(incomeTotal, expenseTotal)}
        percentageTotal={incomeTotal}
        centerLabel="Spese"
        centerValue={incomeTotal ? `${((expenseTotal / incomeTotal) * 100).toFixed(1)}%` : '0%'}
        emptyMessage="Nessun incasso disponibile per calcolare l’impatto percentuale."
        remainderLabel="RESTO"
        remainderName="Incasso non assorbito"
    />;
}

function groupedChartData(data: Array<{ name: string; code: string; total: number }>, limit = 6) {
    if (data.length <= limit) return data;
    const visible = data.slice(0, limit - 1);
    const remainder = data.slice(limit - 1).reduce((sum, item) => sum + item.total, 0);
    return [...visible, {name: 'Altre voci', code: 'ALTRO', total: remainder}];
}

function ExpenseCompositionChart({data, total, incomeTotal}: {
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
                <p className="muted">Peso di ogni categoria sulle uscite e sugli incassi annuali.</p>
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
        </div> : <p className="muted">Nessuna spesa presente per l’anno selezionato.</p>}
    </section>;
}

function ProfitabilitySummaryCard({totals, year, periodLabel}: { totals: any; year: number; periodLabel: string }) {
    const income = totals.incassoTotale;
    const items = [
        {label: 'Margine lordo', value: totals.utileLordo, formula: 'Entrate meno spese totali', className: 'is-gross'},
        {
            label: 'Utile netto',
            value: totals.utileNetto,
            formula: 'Margine lordo meno saldo IVA stimato',
            className: 'is-net'
        },
        {
            label: 'Utile fiscale',
            value: totals.utileFiscale,
            formula: 'Imponibile meno costi fiscalmente rilevanti',
            className: 'is-fiscal'
        },
        {
            label: 'Imponibile',
            value: totals.imponibileIncassi,
            formula: 'Entrate fiscali meno IVA generata',
            className: 'is-taxable',
            secondary: true
        }
    ];
    const ratio = (value: number) => income ? value / Math.abs(income) * 100 : 0;

    return <section className="card profitability-summary-card">
        <div className="card-heading-row profitability-summary-heading">
            <div>
                <span className="profitability-summary-eyebrow">Redditività consolidata</span>
                <h2>Margini e utili</h2>
                <p className="muted">Periodo {periodLabel} · anno fiscale {year}</p>
            </div>
            <div className="profitability-summary-reference">
                <span>Entrate di riferimento</span>
                <strong>{chartEuro(income)}</strong>
                <small>Base delle percentuali</small>
            </div>
        </div>
        <div className="profitability-summary-kpis">
            {items.map(item => {
                const percentage = ratio(item.value);
                return <article className={`profitability-summary-kpi ${item.className} ${item.secondary ? 'is-secondary' : ''}`} key={item.label}>
                    <span>{item.label}</span>
                    <strong className={moneyTone(item.value)}>{chartEuro(item.value)}</strong>
                    <div className={moneyTone(item.value, 'profitability-summary-percentage')}>
                        <b>{percentage.toFixed(1)}%</b>
                        <small>sugli incassi</small>
                    </div>
                    <small className="profitability-summary-formula">{item.formula}</small>
                </article>;
            })}
        </div>
        <div className="profitability-summary-footer">
            <span>Spese totali <strong>{chartEuro(totals.speseTotali)}</strong></span>
            <span>Saldo IVA stimato <strong className={moneyTone(totals.debitoIva)}>{chartEuro(totals.debitoIva)}</strong></span>
        </div>
    </section>;
}

function FiscalNonFiscalOverview({totals, year, periods}: {
    totals: any;
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
                <p className="muted">Composizione annuale di entrate e spese registrate nel {year}.</p>
            </div>
            <span className="badge">Anno {year}</span>
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

function AnnualProfitOverview({totals, year}: { totals: any; year: number }) {
    const incomeTotal = totals.incassoTotale;
    const percentage = (value: number) => incomeTotal ? value / incomeTotal * 100 : 0;
    const items = [
        {label: 'Margine lordo', value: totals.utileLordo, className: 'is-gross-margin'},
        {label: 'Utile netto', value: totals.utileNetto, className: 'is-net-profit'},
        {label: 'Utile fiscale', value: totals.utileFiscale, className: 'is-fiscal-profit'},
        {label: 'Imponibile', value: totals.imponibileIncassi, className: 'is-taxable-income'}
    ];

    return <section className="card annual-profit-overview">
        <div className="card-heading-row">
            <div>
                <h2>Margini e redditività</h2>
                <p className="muted">Valori annuali e incidenza sulle entrate totali nel {year}.</p>
            </div>
        </div>
        <div className="fiscal-overview-matrix annual-profit-overview-matrix">
            {items.map(item => {
                const ratio = percentage(item.value);
                return <div className={`fiscal-overview-metric ${item.className}`} key={item.label}>
                    <span>{item.label}</span>
                    <strong className={moneyTone(item.value)}>{chartEuro(item.value)}</strong>
                    <span className={moneyTone(item.value, 'annual-profit-percentage')}>{ratio.toFixed(1)}%</span>
                    <small>delle entrate totali</small>
                </div>;
            })}
        </div>
    </section>;
}

function NetProfitByIncomeChannelChart({
                                           data,
                                           profit,
                                           incomeTotal,
                                           year,
                                           label
                                       }: {
    data: Array<{ name: string; code: string; total: number }>;
    profit: number;
    incomeTotal: number;
    year: number;
    label: 'netto' | 'fiscale';
}) {
    const positiveProfit = Math.max(profit, 0);
    const titleLabel = `Utile ${label}`;
    const allocatedData = incomeTotal > 0
        ? data.map(item => ({
            ...item,
            total: positiveProfit * (item.total / incomeTotal)
        })).filter(item => item.total > 0)
        : [];

    return <DashboardPieChart
        title={`${titleLabel} per canale e categoria`}
        description={`${titleLabel} ripartito in proporzione agli incassi per canale vendita e categoria nell’anno fiscale ${year}.`}
        badge={<>{titleLabel} {chartEuro(profit)}</>}
        data={allocatedData}
        total={positiveProfit}
        centerLabel={titleLabel}
        emptyMessage={`Nessun utile ${label} positivo disponibile per la ripartizione.`}
    />;
}

function MonthlyProfitPieChart({months, totalProfit, year, kind}: {
    months: Array<{
        year: number;
        month: number;
        totals: { utileLordo: number; utileNetto: number; utileFiscale: number }
    }>;
    totalProfit: number;
    year: number;
    kind: 'lordo' | 'netto' | 'fiscale';
}) {
    const titleLabel = kind === 'lordo' ? 'Margine lordo' : `Utile ${kind}`;
    const data = months.map(month => {
        const profit = kind === 'lordo'
            ? month.totals.utileLordo
            : kind === 'netto' ? month.totals.utileNetto : month.totals.utileFiscale;
        return {
            name: capitalizedMonthName(month.month),
            code: capitalizedMonthName(month.month).slice(0, 3).toUpperCase(),
            total: profit,
            visualValue: Math.abs(profit),
            href: monthReportLink(month.year, month.month)
        };
    });
    const absoluteProfitTotal = data.reduce((sum, item) => sum + item.visualValue, 0);

    return <DashboardPieChart
        title={`Report ${titleLabel} per mese`}
        description={`Distribuzione del ${titleLabel.toLocaleLowerCase('it-IT')} per mese nel ${year}. Le fette negative usano l’ampiezza assoluta e mantengono il segno in legenda.`}
        badge={<>{titleLabel} {chartEuro(totalProfit)}</>}
        data={data}
        total={totalProfit}
        visualTotal={absoluteProfitTotal}
        percentageTotal={absoluteProfitTotal}
        centerLabel={titleLabel}
        centerValue={chartEuro(totalProfit)}
        centerDetail={null}
        emptyMessage={`Nessun ${titleLabel.toLocaleLowerCase('it-IT')} disponibile per l’anno selezionato.`}
    />;
}

function QuarterlyVatBalancePieChart({months, year}: {
    months: Array<{
        year: number;
        month: number;
        totals: { ivaGenerataIncassi: number; ivaVersataSpese: number }
    }>;
    year: number;
}) {
    const data = [0, 1, 2, 3].map(quarterIndex => {
        const quarterMonths = months.filter(month => Math.floor((month.month - 1) / 3) === quarterIndex);
        const vatBalance = quarterMonths.reduce(
            (sum, month) => sum + month.totals.ivaGenerataIncassi - month.totals.ivaVersataSpese,
            0
        );
        const firstMonth = quarterIndex * 3 + 1;
        const lastMonth = firstMonth + 2;
        return {
            name: `${capitalizedMonthName(firstMonth)} – ${capitalizedMonthName(lastMonth)}`,
            code: `T${quarterIndex + 1}`,
            total: vatBalance,
            visualValue: Math.abs(vatBalance)
        };
    });
    const totalVatBalance = data.reduce((sum, item) => sum + item.total, 0);
    const absoluteVatBalanceTotal = data.reduce((sum, item) => sum + item.visualValue, 0);

    return <DashboardPieChart
        title="Saldo IVA per trimestre"
        description={`IVA generata con gli incassi meno IVA versata con le spese fiscali, aggregata per trimestre nel ${year}. Le fette negative mantengono il segno in legenda.`}
        badge={<>Saldo IVA {chartEuro(totalVatBalance)}</>}
        data={data}
        total={totalVatBalance}
        visualTotal={absoluteVatBalanceTotal}
        percentageTotal={absoluteVatBalanceTotal}
        centerLabel="Saldo IVA"
        centerValue={chartEuro(totalVatBalance)}
        centerDetail={null}
        emptyMessage="Nessun saldo IVA trimestrale disponibile per l’anno selezionato."
    />;
}

function MonthlyNonFiscalRatioChart({
                                        months,
                                        year
                                    }: {
    months: Array<{ year: number; month: number; totals: any }>;
    year: number;
}) {
    const totalIncome = months.reduce((sum, month) => sum + month.totals.incassoTotale, 0);
    const totalNonFiscalExpenses = months.reduce((sum, month) => sum + month.totals.usciteNonFiscali, 0);
    const totalNonFiscalIncomes = months.reduce((sum, month) => sum + month.totals.incassoNonFiscale, 0);
    const expenseYearPercentage = totalIncome ? (totalNonFiscalExpenses / totalIncome) * 100 : 0;
    const incomeYearPercentage = totalIncome ? (totalNonFiscalIncomes / totalIncome) * 100 : 0;

    return <section className="monthly-non-fiscal-chart-card">
        {months.length ? <div className="monthly-non-fiscal-chart-list">
            <div className="monthly-income-expense-ratio-year-row">
                <div className="monthly-non-fiscal-chart-month-row">
                    <span className="monthly-non-fiscal-chart-month">{year}</span>
                    <div className="summary-text">
                        <small>Incasso tot &nbsp;</small> <strong>{chartEuro(totalIncome)}</strong>
                    </div>
                </div>
                <div className="monthly-non-fiscal-chart-top">
                    <span>Spese n.f. annuali</span>
                    <small className={moneyTone(totalNonFiscalExpenses)}>{chartEuro(totalNonFiscalExpenses)}</small>
                    <strong>{expenseYearPercentage.toFixed(1)}%</strong>
                </div>
                <span className="monthly-non-fiscal-chart-bar-wrap"
                      aria-label={`${year} spese non fiscali: ${expenseYearPercentage.toFixed(1)}%`}>
          <span
              className={`monthly-non-fiscal-chart-bar monthly-non-fiscal-chart-expense-bar ${nonFiscalExpensePercentTone(totalNonFiscalExpenses, totalIncome)}`}
              style={{width: `${Math.min(expenseYearPercentage, 100)}%`}}/>
        </span>
                <span className="monthly-non-fiscal-chart-bar-wrap"
                      aria-label={`${year} incassi non fiscali: ${incomeYearPercentage.toFixed(1)}%`}>
          <span className="monthly-non-fiscal-chart-bar monthly-non-fiscal-chart-income-bar"
                style={{width: `${Math.min(incomeYearPercentage, 100)}%`}}/>
        </span>
                <div className="monthly-non-fiscal-chart-bottom">
                    <span>Incassi n.f. annuali</span>
                    <small className={moneyTone(totalNonFiscalIncomes)}>{chartEuro(totalNonFiscalIncomes)}</small>
                    <strong>{incomeYearPercentage.toFixed(1)}%</strong>
                </div>
            </div>
            {months.map(month => {
                const incomeTotal = month.totals.incassoTotale;
                const nonFiscalExpense = month.totals.usciteNonFiscali;
                const nonFiscalIncome = month.totals.incassoNonFiscale;
                const expensePercentage = incomeTotal ? (nonFiscalExpense / incomeTotal) * 100 : 0;
                const incomePercentage = incomeTotal ? (nonFiscalIncome / incomeTotal) * 100 : 0;
                const expenseWidth = Math.min(expensePercentage, 100);
                const incomeWidth = Math.min(incomePercentage, 100);
                const expenseTone = nonFiscalExpensePercentTone(nonFiscalExpense, incomeTotal);
                const monthLabel = capitalizedMonthName(month.month);

                return <Link
                    className="monthly-non-fiscal-chart-row"
                    href={periodLink('/expenses', [{year: month.year, month: month.month}], {declared: 'no'})}
                    key={`${month.year}-${month.month}`}
                >
                    <div className="monthly-non-fiscal-chart-month-row">
                        <span className="monthly-non-fiscal-chart-month">{monthLabel}</span>
                        <small>Incasso tot {chartEuro(incomeTotal)}</small>
                    </div>
                    <div className="monthly-non-fiscal-chart-top">
                        <span>Spese n.f.</span>
                        <small className={moneyTone(nonFiscalExpense)}>{chartEuro(nonFiscalExpense)}</small>
                        <strong>{expensePercentage.toFixed(1)}%</strong>
                    </div>
                    <span className="monthly-non-fiscal-chart-bar-wrap"
                          aria-label={`${monthLabel} spese non fiscali: ${expensePercentage.toFixed(1)}%`}>
            <span className={`monthly-non-fiscal-chart-bar monthly-non-fiscal-chart-expense-bar ${expenseTone}`}
                  style={{width: `${expenseWidth}%`}}/>
          </span>
                    <span className="monthly-non-fiscal-chart-bar-wrap"
                          aria-label={`${monthLabel} incassi non fiscali: ${incomePercentage.toFixed(1)}%`}>
            <span className="monthly-non-fiscal-chart-bar monthly-non-fiscal-chart-income-bar"
                  style={{width: `${incomeWidth}%`}}/>
          </span>
                    <div className="monthly-non-fiscal-chart-bottom">
                        <span>Incassi n.f.</span>
                        <small className={moneyTone(nonFiscalIncome)}>{chartEuro(nonFiscalIncome)}</small>
                        <strong>{incomePercentage.toFixed(1)}%</strong>
                    </div>
                </Link>;
            })}
        </div> : <p className="muted">Nessun mese disponibile per l’anno selezionato.</p>}
    </section>;
}

function MonthlyIncomeExpenseRatioChart({
                                            months,
                                            year
                                        }: {
    months: Array<{ year: number; month: number; totals: any }>;
    year: number;
}) {
    const totalIncome = months.reduce((sum, month) => sum + month.totals.incassoTotale, 0);
    const totalExpenses = months.reduce((sum, month) => sum + month.totals.speseTotali, 0);
    const grossMargin = totalIncome - totalExpenses;
    const yearPercentage = totalIncome ? (grossMargin / totalIncome) * 100 : 0;
    const marginBarTone = (margin: number, percentage: number) => {
        if (margin < 0) return 'tone-critical';
        if (margin === 0) return 'money-zero';
        if (percentage < 25) return 'tone-warning';
        return '';
    };
    const marginBarClass = (margin: number, percentage: number) => [
        'monthly-non-fiscal-chart-bar',
        'monthly-income-expense-ratio-chart-bar',
        marginBarTone(margin, percentage),
        percentage <= 0 ? 'is-empty' : ''
    ].filter(Boolean).join(' ');
    const marginBarWidth = (percentage: number) => Math.min(Math.max(percentage, 0), 100);

    return <section className="card monthly-income-expense-ratio-chart-card"
                    aria-labelledby="monthly-income-expense-ratio-chart-title">
        <div className="card-heading-row">
            <div>
                <h2 id="monthly-income-expense-ratio-chart-title">Margine lordo per mese</h2>
                <p className="muted">Percentuale del margine lordo rispetto alle entrate totali mensili da inizio anno {year}.</p>
            </div>
            {/*<div className="text-right chart-total">*/}
            {/*    <span className="badge">Anno {year}</span>*/}
            {/*</div>*/}
        </div>
        {months.length ? <div className="monthly-non-fiscal-chart-list">
            <div className="monthly-income-expense-ratio-year-row">
                <div className="monthly-non-fiscal-chart-month-row">
                    <span className="monthly-non-fiscal-chart-month">{year}</span>
                    <div className="summary-text">
                        <small>Entrate &nbsp;</small> <strong>{chartEuro(totalIncome)}</strong>
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <small>Uscite &nbsp;</small> <strong>{chartEuro(totalExpenses)}</strong>
                    </div>
                </div>
                <div className="monthly-income-expense-ratio-chart-values">
                    <span>Margine lordo annuale</span>
                    <small className={moneyTone(grossMargin)}>{chartEuro(grossMargin)}</small>
                    <strong className="text-accent">{yearPercentage.toFixed(1)}%</strong>
                </div>
                <span className="monthly-non-fiscal-chart-bar-wrap"
                      aria-label={`${year} margine lordo su entrate: ${yearPercentage.toFixed(1)}%`}>
          <span className={marginBarClass(grossMargin, yearPercentage)}
                style={{width: `${marginBarWidth(yearPercentage)}%`}}/>
        </span>
            </div>
            {months.map(month => {
                const incomeTotal = month.totals.incassoTotale;
                const expenseTotal = month.totals.speseTotali;
                const monthGrossMargin = incomeTotal - expenseTotal;
                const percentage = incomeTotal ? (monthGrossMargin / incomeTotal) * 100 : 0;
                const width = marginBarWidth(percentage);
                const monthLabel = capitalizedMonthName(month.month);

                return <Link
                    className="monthly-income-expense-ratio-chart-row"
                    href={monthReportLink(month.year, month.month)}
                    key={`${month.year}-${month.month}`}>
                    <div className="monthly-non-fiscal-chart-month-row">
                        <span className="monthly-non-fiscal-chart-month">{monthLabel}</span>
                        <small>Entrate {chartEuro(incomeTotal)}</small>
                    </div>
                    <div className="monthly-income-expense-ratio-chart-values">
                        <span>Margine lordo</span>
                        <small className={moneyTone(monthGrossMargin)}>{chartEuro(monthGrossMargin)}</small>
                        <strong>{percentage.toFixed(1)}%</strong>
                    </div>
                    <span className="monthly-non-fiscal-chart-bar-wrap"
                          aria-label={`${monthLabel} margine lordo su entrate: ${percentage.toFixed(1)}%`}>
            <span className={marginBarClass(monthGrossMargin, percentage)} style={{width: `${width}%`}}/>
          </span>
                </Link>;
            })}
        </div> : <p className="muted">Nessun mese disponibile per l’anno selezionato.</p>}
    </section>;
}

function MonthlyFiscalExpenseImpactChart({
                                             months,
                                             year
                                         }: {
    months: Array<{ year: number; month: number; totals: any }>;
    year: number;
}) {
    const totalFiscalIncome = months.reduce((sum, month) => sum + month.totals.incassoFiscale, 0);
    const totalFiscalExpenses = months.reduce((sum, month) => sum + month.totals.usciteFiscali, 0);
    const annualPercentage = totalFiscalIncome ? (totalFiscalExpenses / totalFiscalIncome) * 100 : 0;
    const impactBarClass = (expenses: number, income: number) => [
        'monthly-non-fiscal-chart-bar',
        'monthly-fiscal-expense-impact-chart-bar',
        nonFiscalExpensePercentTone(expenses, income),
        expenses <= 0 ? 'is-empty' : ''
    ].filter(Boolean).join(' ');
    const barWidth = (percentage: number) => Math.min(Math.max(percentage, 0), 100);

    return <section className="monthly-income-expense-ratio-chart-card monthly-fiscal-expense-impact-chart-card">
        {months.length ? <div className="monthly-non-fiscal-chart-list">
            <div className="monthly-income-expense-ratio-year-row">
                <div className="monthly-non-fiscal-chart-month-row">
                    <span className="monthly-non-fiscal-chart-month">{year}</span>
                    <div className="summary-text">
                        <small>Incasso fiscale &nbsp;</small> <strong>{chartEuro(totalFiscalIncome)}</strong>
                    </div>
                </div>
                <div className="monthly-income-expense-ratio-chart-values">
                    <span>Spese fiscali annuali</span>
                    <small className={moneyTone(totalFiscalExpenses)}>{chartEuro(totalFiscalExpenses)}</small>
                    <strong>{annualPercentage.toFixed(1)}%</strong>
                </div>
                <span className="monthly-non-fiscal-chart-bar-wrap"
                      aria-label={`${year} spese fiscali: ${annualPercentage.toFixed(1)}% dell'incasso fiscale`}>
          <span className={impactBarClass(totalFiscalExpenses, totalFiscalIncome)}
                style={{width: `${barWidth(annualPercentage)}%`}}/>
        </span>
            </div>
            {months.map(month => {
                const fiscalIncome = month.totals.incassoFiscale;
                const fiscalExpenses = month.totals.usciteFiscali;
                const percentage = fiscalIncome ? (fiscalExpenses / fiscalIncome) * 100 : 0;
                const monthLabel = capitalizedMonthName(month.month);

                return <Link
                    className="monthly-income-expense-ratio-chart-row"
                    href={periodLink('/expenses', [{year: month.year, month: month.month}], {declared: 'yes'})}
                    key={`${month.year}-${month.month}`}
                >
                    <div className="monthly-non-fiscal-chart-month-row">
                        <span className="monthly-non-fiscal-chart-month">{monthLabel}</span>
                        <small>Incasso fiscale {chartEuro(fiscalIncome)}</small>
                    </div>
                    <div className="monthly-income-expense-ratio-chart-values">
                        <span>Spese fiscali</span>
                        <small className={moneyTone(fiscalExpenses)}>{chartEuro(fiscalExpenses)}</small>
                        <strong>{percentage.toFixed(1)}%</strong>
                    </div>
                    <span className="monthly-non-fiscal-chart-bar-wrap"
                          aria-label={`${monthLabel} spese fiscali: ${percentage.toFixed(1)}% dell'incasso fiscale`}>
            <span className={impactBarClass(fiscalExpenses, fiscalIncome)} style={{width: `${barWidth(percentage)}%`}}/>
          </span>
                </Link>;
            })}
        </div> : <p className="muted">Nessun mese disponibile per l’anno selezionato.</p>}
    </section>;
}

function MonthlyVatRatioChart({months, year}: {
    months: Array<{ year: number; month: number; totals: any }>;
    year: number;
}) {
    const totalIncome = months.reduce((sum, month) => sum + month.totals.incassoTotale, 0);
    const totalGeneratedVat = months.reduce((sum, month) => sum + month.totals.ivaGenerataIncassi, 0);
    const totalPaidVat = months.reduce((sum, month) => sum + month.totals.ivaVersataSpese, 0);
    const percentage = (value: number, income: number) => income ? (value / Math.abs(income)) * 100 : 0;
    const barWidth = (value: number, income: number) => `${Math.min(Math.max(percentage(value, income), 0), 100)}%`;
    const totalGeneratedPercentage = percentage(totalGeneratedVat, totalIncome);
    const totalPaidPercentage = percentage(totalPaidVat, totalIncome);

    return <section className="monthly-vat-ratio-chart-card">
        {months.length ? <div className="monthly-non-fiscal-chart-list">
            <div className="monthly-income-expense-ratio-year-row">
                <div className="monthly-non-fiscal-chart-month-row">
                    <span className="monthly-non-fiscal-chart-month">{year}</span>
                    <small>Incasso totale {chartEuro(totalIncome)}</small>
                </div>
                <div className="monthly-income-expense-ratio-chart-values">
                    <span>IVA generata</span><small>{chartEuro(totalGeneratedVat)}</small>
                    <strong>{totalGeneratedPercentage.toFixed(1)}%</strong>
                </div>
                <span className="monthly-non-fiscal-chart-bar-wrap" aria-label={`${year} IVA generata: ${totalGeneratedPercentage.toFixed(1)}% dell'incasso totale`}>
                    <span className="monthly-non-fiscal-chart-bar monthly-vat-generated-bar" style={{width: barWidth(totalGeneratedVat, totalIncome)}}/>
                </span>
                <span className="monthly-non-fiscal-chart-bar-wrap" aria-label={`${year} IVA versata: ${totalPaidPercentage.toFixed(1)}% dell'incasso totale`}>
                    <span className="monthly-non-fiscal-chart-bar monthly-vat-paid-bar" style={{width: barWidth(totalPaidVat, totalIncome)}}/>
                </span>
                <div className="monthly-income-expense-ratio-chart-values">
                    <span>IVA versata</span><small>{chartEuro(totalPaidVat)}</small>
                    <strong>{totalPaidPercentage.toFixed(1)}%</strong>
                </div>
            </div>
            {months.map(month => {
                const income = month.totals.incassoTotale;
                const generatedVat = month.totals.ivaGenerataIncassi;
                const paidVat = month.totals.ivaVersataSpese;
                const generatedPercentage = percentage(generatedVat, income);
                const paidPercentage = percentage(paidVat, income);
                const monthLabel = capitalizedMonthName(month.month);
                return <Link className="monthly-income-expense-ratio-chart-row"
                             href={monthReportLink(month.year, month.month)} key={`${month.year}-${month.month}`}>
                    <div className="monthly-non-fiscal-chart-month-row">
                        <span className="monthly-non-fiscal-chart-month">{monthLabel}</span>
                        <small>Incasso totale {chartEuro(income)}</small>
                    </div>
                    <div className="monthly-income-expense-ratio-chart-values">
                        <span>IVA generata</span><small>{chartEuro(generatedVat)}</small>
                        <strong>{generatedPercentage.toFixed(1)}%</strong>
                    </div>
                    <span className="monthly-non-fiscal-chart-bar-wrap" aria-label={`${monthLabel} IVA generata: ${generatedPercentage.toFixed(1)}% dell'incasso totale`}>
                        <span className="monthly-non-fiscal-chart-bar monthly-vat-generated-bar" style={{width: barWidth(generatedVat, income)}}/>
                    </span>
                    <span className="monthly-non-fiscal-chart-bar-wrap" aria-label={`${monthLabel} IVA versata: ${paidPercentage.toFixed(1)}% dell'incasso totale`}>
                        <span className="monthly-non-fiscal-chart-bar monthly-vat-paid-bar" style={{width: barWidth(paidVat, income)}}/>
                    </span>
                    <div className="monthly-income-expense-ratio-chart-values">
                        <span>IVA versata</span><small>{chartEuro(paidVat)}</small>
                        <strong>{paidPercentage.toFixed(1)}%</strong>
                    </div>
                </Link>;
            })}
        </div> : <p className="muted">Nessun mese disponibile per l’anno selezionato.</p>}
    </section>;
}

function MonthlyNetFiscalProfitRatioChart({months, year}: {
    months: Array<{ year: number; month: number; totals: any }>;
    year: number;
}) {
    const totalNetProfit = months.reduce((sum, month) => sum + month.totals.utileNetto, 0);
    const totalFiscalProfit = months.reduce((sum, month) => sum + month.totals.utileFiscale, 0);
    const totalGrossMargin = months.reduce((sum, month) => sum + month.totals.utileLordo, 0);
    const totalIncome = months.reduce((sum, month) => sum + month.totals.incassoTotale, 0);
    const incomeRatioLabel = (value: number, income: number) => {
        if (!income) return value ? 'n.d.' : '0.0%';
        return `${((value / Math.abs(income)) * 100).toFixed(1)}%`;
    };
    const profitBarClass = (value: number, kind: 'net' | 'fiscal') => [
        'monthly-non-fiscal-chart-bar',
        'monthly-profit-ratio-chart-bar',
        `monthly-profit-ratio-chart-${kind}-bar`,
        value < 0 ? 'tone-critical' : '',
        value === 0 ? 'money-zero' : ''
    ].filter(Boolean).join(' ');
    const profitBarStyle = (value: number, income: number) => {
        if (!income || value === 0) return {left: '25%', width: '0%'};
        const availableWidth = value < 0 ? 25 : 75;
        const width = Math.min(Math.max((Math.abs(value) / Math.abs(income)) * availableWidth, 2), availableWidth);
        return {
            left: value < 0 ? `${25 - width}%` : '25%',
            width: `${width}%`
        };
    };
    const grossMarginPercentage = (grossMargin: number, income: number) => income ? (grossMargin / income) * 100 : 0;
    const grossMarginBarClass = (grossMargin: number, income: number) => {
        const percentage = grossMarginPercentage(grossMargin, income);
        return [
            'monthly-non-fiscal-chart-bar',
            'monthly-income-expense-ratio-chart-bar',
            'monthly-profit-ratio-chart-bar',
            'monthly-profit-ratio-gross-margin-bar',
            grossMargin < 0 ? 'tone-critical' : '',
            grossMargin === 0 ? 'money-zero' : '',
            grossMargin > 0 && percentage < 25 ? 'tone-warning' : '',
            grossMargin === 0 ? 'is-empty' : ''
        ].filter(Boolean).join(' ');
    };
    const grossMarginBarStyle = (grossMargin: number, income: number) => {
        if (!income || grossMargin === 0) return {left: '25%', width: '0%'};
        const availableWidth = grossMargin < 0 ? 25 : 75;
        const width = Math.min(Math.max((Math.abs(grossMargin) / Math.abs(income)) * availableWidth, 2), availableWidth);
        return {
            left: grossMargin < 0 ? `${25 - width}%` : '25%',
            width: `${width}%`
        };
    };
    const totalGrossMarginPercentage = grossMarginPercentage(totalGrossMargin, totalIncome);

    return <section className="monthly-profit-ratio-chart-card">
        {months.length ? <div className="monthly-non-fiscal-chart-list">
            <div className="monthly-income-expense-ratio-year-row monthly-profit-ratio-year-row">
                <div className="monthly-non-fiscal-chart-month-row">
                    <div className="summary-text flex align-end flex-grow">
                        <span className="monthly-non-fiscal-chart-month flex-grow">{year}</span>
                        {/*<small className="">Margine lordo &nbsp;</small>*/}
                        {/*<strong className={moneyTone(totalGrossMargin)}>{chartEuro(totalGrossMargin)}</strong>*/}
                    </div>
                    {/*<div className="summary-text flex align-end">*/}
                    {/*    <div>*/}
                    {/*        <small>Netto &nbsp;</small>*/}
                    {/*        <strong className={moneyTone(totalNetProfit)}>{chartEuro(totalNetProfit)}</strong>*/}
                    {/*        &nbsp;&nbsp;&nbsp;&nbsp;*/}
                    {/*        <small>Fiscale &nbsp;</small>*/}
                    {/*        <strong className={moneyTone(totalFiscalProfit)}>{chartEuro(totalFiscalProfit)}</strong>*/}
                    {/*    </div>*/}
                    {/*</div>*/}
                </div>

                <div className="monthly-income-expense-ratio-chart-values monthly-profit-ratio-gross-margin-values">
                    <span>Margine Lordo</span>
                    <strong className={moneyTone(totalGrossMargin)}>{chartEuro(totalGrossMargin)}</strong>
                    <strong className="text-accent">{totalGrossMarginPercentage.toFixed(1)}%</strong>
                </div>
                <div className="monthly-profit-ratio-bar-stack" aria-label={`${year} margine lordo ${chartEuro(totalGrossMargin)} su incasso ${chartEuro(totalIncome)}, utile netto ${chartEuro(totalNetProfit)}, utile fiscale ${chartEuro(totalFiscalProfit)}`}>
                  <span className="monthly-non-fiscal-chart-bar-wrap monthly-profit-ratio-bar-wrap" aria-label={`${year} margine lordo: ${totalGrossMarginPercentage.toFixed(1)}% dell'incasso`}>
                    <span className={grossMarginBarClass(totalGrossMargin, totalIncome)} style={grossMarginBarStyle(totalGrossMargin, totalIncome)}/>
                  </span>
                    <br/>
                    <div className="monthly-income-expense-ratio-chart-values">
                        <span>Margine Netto</span>
                        <div>
                            <strong className={moneyTone(totalNetProfit)}>{chartEuro(totalNetProfit)}</strong>
                        </div>
                        <div>
                            <strong className="text-accent">{incomeRatioLabel(totalNetProfit, totalIncome)}</strong>
                        </div>
                    </div>
                    <span className="monthly-non-fiscal-chart-bar-wrap monthly-profit-ratio-bar-wrap">
                    <span className={profitBarClass(totalNetProfit, 'net')} style={profitBarStyle(totalNetProfit, totalIncome)}/>
                  </span>
                    <span className="monthly-non-fiscal-chart-bar-wrap monthly-profit-ratio-bar-wrap">
                    <span className={profitBarClass(totalFiscalProfit, 'fiscal')} style={profitBarStyle(totalFiscalProfit, totalIncome)}/>
                  </span>

                    <div className="monthly-income-expense-ratio-chart-values">
                        <span>Utile Fiscale</span>
                        <div>
                            <strong className={moneyTone(totalFiscalProfit)}>{chartEuro(totalFiscalProfit)}</strong>
                        </div>
                        <div>
                            <strong className="text-accent">{incomeRatioLabel(totalFiscalProfit, totalIncome)}</strong>
                        </div>
                    </div>
                </div>
            </div>
            {months.map(month => {
                const netProfit = month.totals.utileNetto;
                const fiscalProfit = month.totals.utileFiscale;
                const grossMargin = month.totals.utileLordo;
                const income = month.totals.incassoTotale;
                const grossPercentage = grossMarginPercentage(grossMargin, income);
                const monthLabel = capitalizedMonthName(month.month);

                return <Link
                    className="monthly-income-expense-ratio-chart-row monthly-profit-ratio-chart-row"
                    href={monthReportLink(month.year, month.month)}
                    key={`${month.year}-${month.month}`}>
                    <div className="monthly-non-fiscal-chart-month-row">
                        <span className="monthly-non-fiscal-chart-month">{monthLabel}</span>
                        <small>Incasso {chartEuro(income)}</small>
                    </div>
                    <div className="monthly-income-expense-ratio-chart-values monthly-profit-ratio-gross-margin-values">
                        <span>Margine lordo</span>
                        <small className={moneyTone(grossMargin)}>{chartEuro(grossMargin)}</small>
                        <strong>{grossPercentage.toFixed(1)}%</strong>
                    </div>
                    <span className="monthly-non-fiscal-chart-bar-wrap monthly-profit-ratio-bar-wrap"
                          aria-label={`${monthLabel} margine lordo: ${grossPercentage.toFixed(1)}% dell'incasso`}>
            <span className={grossMarginBarClass(grossMargin, income)}
                  style={grossMarginBarStyle(grossMargin, income)}/>
          </span>
                    <div className="monthly-income-expense-ratio-chart-values">
                        <span>Utile netto</span>
                        <small className={moneyTone(netProfit)}>{chartEuro(netProfit)}</small>
                        <strong>{incomeRatioLabel(netProfit, income)}</strong>
                    </div>
                    <span className="monthly-non-fiscal-chart-bar-wrap monthly-profit-ratio-bar-wrap"
                          aria-label={`${monthLabel} utile netto: ${chartEuro(netProfit)} su incasso ${chartEuro(income)}`}>
            <span className={profitBarClass(netProfit, 'net')} style={profitBarStyle(netProfit, income)}/>
          </span>

                    <span className="monthly-non-fiscal-chart-bar-wrap monthly-profit-ratio-bar-wrap"
                          aria-label={`${monthLabel} utile fiscale: ${chartEuro(fiscalProfit)} su incasso ${chartEuro(income)}`}>
            <span className={profitBarClass(fiscalProfit, 'fiscal')} style={profitBarStyle(fiscalProfit, income)}/>
          </span>
                    <div className="monthly-income-expense-ratio-chart-values">
                        <span>Utile fiscale</span>
                        <small className={moneyTone(fiscalProfit)}>{chartEuro(fiscalProfit)}</small>
                        <strong>{incomeRatioLabel(fiscalProfit, income)}</strong>
                    </div>

                </Link>;
            })}
        </div> : <p className="muted">Nessun mese disponibile per l’anno selezionato.</p>}
    </section>;
}

type DashboardMonth = {
    year: number;
    month: number;
    totals: any;
};

function MonthlyProfitComparisonChart({months, year}: { months: DashboardMonth[]; year: number }) {
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
    const zeroPosition = negativeExtent / totalExtent * 100;
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
        const width = Math.abs(boundedPercentage) / totalExtent * 100;
        return {
            left: percentage < 0 ? `${zeroPosition - width}%` : `${zeroPosition}%`,
            width: `${width}%`
        };
    };

    return <section className="card dashboard-insight-card monthly-profit-comparison-card">
        <div className="card-heading-row">
            <div>
                <h2>Andamento e report mensile</h2>
                <p className="muted">Entrate, uscite, utile netto e fiscale con dettaglio per ogni mese del {year}.</p>
            </div>
            <div className="dashboard-chart-main-totals">
                <div className="dashboard-chart-main-total">
                    <span>Entrate anno</span>
                    <strong>{chartEuro(totalIncome)}</strong>
                    <span className="dashboard-chart-main-total-percent text-muted">100%</span>
                </div>
                <div className="dashboard-chart-main-total">
                    <span className="">Utile netto anno · </span>
                    <strong className={moneyTone(totalNetProfit)}>{chartEuro(totalNetProfit)}</strong>
                    <span className="dashboard-chart-main-total-percent text-green">{annualRatio(totalNetProfit).toFixed(1)}%</span>
                </div>
                <div className="dashboard-chart-main-total">
                    <span className="">Utile fiscale anno · </span>
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
        </div> : <p className="muted">Nessun utile mensile disponibile per l’anno selezionato.</p>}
    </section>;
}

function ProfitabilityTrendChart({months, year}: { months: DashboardMonth[]; year: number }) {
    const ratio = (value: number, income: number) => income ? (value / Math.abs(income)) * 100 : 0;
    const series = [
        {label: 'Margine lordo', key: 'utileLordo', className: 'is-gross'},
        {label: 'Utile netto', key: 'utileNetto', className: 'is-net'},
        {label: 'Utile fiscale', key: 'utileFiscale', className: 'is-fiscal'}
    ] as const;
    const percentages = months.flatMap(month => series.map(item => ratio(month.totals[item.key], month.totals.incassoTotale)));
    const minValue = Math.min(0, ...percentages);
    const maxValue = Math.max(10, ...percentages);
    const range = Math.max(maxValue - minValue, 1);
    const width = 960;
    const height = 280;
    const left = 42;
    const right = 18;
    const top = 24;
    const bottom = 48;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const x = (index: number) => left + (chartWidth * index / Math.max(months.length - 1, 1));
    const y = (value: number) => top + ((maxValue - value) / range) * chartHeight;

    return <section className="card dashboard-insight-card full">
        <div className="card-heading-row">
            <div>
                <h2>Marginalità per mese</h2>
                <p className="muted">Percentuale rispetto alle entrate mensili nell’anno {year}.</p>
            </div>
            <div className="dashboard-chart-legend">
                {series.map(item =>
                    <span key={item.key}><i className={`legend-line ${item.className}`}/>{item.label}</span>)}
            </div>
        </div>
        {months.length ? <div className="dashboard-svg-chart-scroll">
            <svg className="dashboard-profitability-chart" viewBox={`0 0 ${width} ${height}`} role="img"
                 aria-label={`Marginalità mensile ${year}`}>
                {[minValue, 0, maxValue / 2, maxValue].filter((value, index, all) => all.indexOf(value) === index).map(value =>
                    <g key={value}>
                        <line className={value === 0 ? 'dashboard-chart-zero-line' : 'dashboard-chart-grid-line'}
                              x1={left} y1={y(value)} x2={width - right} y2={y(value)}/>
                        <text className="dashboard-chart-axis-label" x={left - 8} y={y(value) + 4} textAnchor="end">{value.toFixed(0)}%</text>
                    </g>
                )}
                {series.map(item => <polyline key={item.key} className={`dashboard-margin-line ${item.className}`}
                                              points={months.map((month, index) => `${x(index)},${y(ratio(month.totals[item.key], month.totals.incassoTotale))}`).join(' ')}/>)}
                {months.map((month, index) => <text key={month.month} className="dashboard-chart-month-label"
                                                    x={x(index)} y={height - 20} textAnchor="middle">
                    {capitalizedMonthName(month.month).slice(0, 3)}
                </text>)}
            </svg>
        </div> : <p className="muted">Nessun dato di marginalità disponibile.</p>}
    </section>;
}

type CashScheduleItem = { month: number; incoming: number; outgoing: number; overdue: number };

function CashScheduleChart({items, year}: { items: CashScheduleItem[]; year: number }) {
    const maxValue = Math.max(...items.flatMap(item => [item.incoming, item.outgoing, item.overdue]), 1);
    return <section id="scadenze" className="card dashboard-insight-card dashboard-anchor-section">
        <div className="card-heading-row">
            <div>
                <h2>Scadenzario incassi e pagamenti</h2>
                <p className="muted">Movimenti ancora aperti, raggruppati per data prevista nel {year}.</p>
            </div>
            <div className="dashboard-chart-legend">
                <span><i className="legend-income"/>Da incassare</span>
                <span><i className="legend-expense"/>Da pagare</span>
                <span><i className="legend-overdue"/>Scaduto</span>
            </div>
        </div>
        {items.some(item => item.incoming || item.outgoing) ? <div className="cash-schedule-list">
            {items.map(item => <div className="cash-schedule-row" key={item.month}>
                <strong>{capitalizedMonthName(item.month).slice(0, 3)}</strong>
                <div className="cash-schedule-bars">
                    <span aria-label={`${capitalizedMonthName(item.month)} da incassare ${chartEuro(item.incoming)}`}>
                        <i className="cash-schedule-income" style={{width: `${item.incoming / maxValue * 100}%`}}/>
                    </span>
                    <span aria-label={`${capitalizedMonthName(item.month)} da pagare ${chartEuro(item.outgoing)}`}>
                        <i className="cash-schedule-expense" style={{width: `${item.outgoing / maxValue * 100}%`}}/>
                        {item.overdue ?
                            <i className="cash-schedule-overdue" style={{width: `${item.overdue / maxValue * 100}%`}}/> : null}
                    </span>
                </div>
                <div className="cash-schedule-values">
                    <span>{chartEuro(item.incoming)}</span>
                    <span>{chartEuro(item.outgoing)}</span>
                </div>
            </div>)}
        </div> : <p className="muted">Non risultano incassi o pagamenti aperti con scadenza nel {year}.</p>}
    </section>;
}

function VatSituationCard({months, year}: { months: DashboardMonth[]; year: number }) {
    const quarters = [0, 1, 2, 3].map(index => {
        const quarterMonths = months.filter(month => Math.floor((month.month - 1) / 3) === index);
        const generated = quarterMonths.reduce((sum, month) => sum + month.totals.ivaGenerataIncassi, 0);
        const deductible = quarterMonths.reduce((sum, month) => sum + month.totals.ivaDetraibileSpese, 0);
        const settled = quarterMonths.reduce((sum, month) => sum + month.totals.ivaSaldoVersato, 0);
        return {index, generated, deductible, settled, balance: generated - deductible - settled};
    });
    let runningBalance = 0;
    const rows = quarters.map(quarter => ({...quarter, progressive: runningBalance += quarter.balance}));
    const generated = rows.reduce((sum, quarter) => sum + quarter.generated, 0);
    const deductible = rows.reduce((sum, quarter) => sum + quarter.deductible, 0);
    const settled = rows.reduce((sum, quarter) => sum + quarter.settled, 0);
    const balance = generated - deductible - settled;
    const fiscalIncome = months.reduce((sum, month) => sum + month.totals.incassoFiscale, 0);
    const effectiveRate = fiscalIncome ? generated / fiscalIncome * 100 : 0;
    const maxValue = Math.max(...rows.flatMap(row => [row.generated, row.deductible, row.settled]), 1);

    return <section id="iva" className="card dashboard-insight-card vat-situation-card dashboard-anchor-section">
        <div className="card-heading-row">
            <div>
                <h2>Situazione IVA</h2>
                <p className="muted">Stima ricavata dai movimenti fiscali registrati nel {year}.</p>
            </div>
            <span className={`vat-balance-badge ${balance > 0 ? 'is-debit' : balance < 0 ? 'is-credit' : ''}`}>
                {balance > 0 ? 'A debito' : balance < 0 ? 'A credito' : 'In equilibrio'}
            </span>
        </div>
        <div className="vat-kpi-grid">
            <div><span>IVA generata</span><strong>{chartEuro(generated)}</strong></div>
            <div><span>IVA detraibile</span><strong>{chartEuro(deductible)}</strong></div>
            <div><span>IVA già liquidata</span><strong>{chartEuro(settled)}</strong></div>
            <div className="is-primary"><span>Saldo IVA stimato</span><strong>{chartEuro(balance)}</strong></div>
            <div><span>Incidenza su incasso fiscale</span><strong>{effectiveRate.toFixed(1)}%</strong></div>
        </div>
        <div className="vat-quarter-chart">
            {rows.map(row => <div className="vat-quarter-column" key={row.index}>
                <div className="vat-quarter-bars">
                    <i className="vat-generated-column" style={{height: `${row.generated / maxValue * 100}%`}}>
                        <span>{chartEuro(row.generated)}</span>
                    </i>
                    <i className="vat-deductible-column" style={{height: `${row.deductible / maxValue * 100}%`}}>
                        <span>{chartEuro(row.deductible)}</span>
                    </i>
                    <i className="vat-settled-column" style={{height: `${row.settled / maxValue * 100}%`}}>
                        <span>{chartEuro(row.settled)}</span>
                    </i>
                </div>
                <strong>T{row.index + 1}</strong>
                <small className={moneyTone(row.balance)}>Saldo {chartEuro(row.balance)}</small>
            </div>)}
        </div>
        <div className="dashboard-chart-legend vat-chart-legend">
            <span><i className="legend-vat-generated"/>IVA generata</span>
            <span><i className="legend-vat-deductible"/>IVA detraibile</span>
            <span><i className="legend-vat-settled"/>IVA già liquidata</span>
        </div>
        <details className="vat-detail">
            <summary>Mostra dettaglio trimestrale</summary>
            <div className="table-scroll">
                <table className="dashboard-report-table vat-detail-table">
                    <thead>
                    <tr>
                        <th>Periodo</th>
                        <th>IVA generata</th>
                        <th className="text-wrap">Detraibile / liquidata</th>
                        <th>Già liquidata</th>
                        <th>Saldo</th>
                        <th>Progressivo</th>
                    </tr>
                    </thead>
                    <tbody>{rows.map(row => <tr key={row.index}>
                        <td><strong>T{row.index + 1}</strong></td>
                        <td>{chartEuro(row.generated)}</td>
                        <td>{chartEuro(row.deductible)}</td>
                        <td>{chartEuro(row.settled)}</td>
                        <td className={moneyTone(row.balance)}>{chartEuro(row.balance)}</td>
                        <td className={moneyTone(row.progressive)}>{chartEuro(row.progressive)}</td>
                    </tr>)}</tbody>
                </table>
            </div>
            <p className="muted vat-detail-note">Il progressivo considera solo i movimenti dell’anno selezionato e non eventuali crediti IVA provenienti da anni precedenti.</p>
        </details>
    </section>;
}

function IncomeExpenseBreakdownChart({
                                         totals,
                                         periods
                                     }: {
    totals: any;
    periods: Array<{ year: number; month: number }>;
}) {
    const items = [
        {
            label: 'Entrate fiscali',
            value: totals.incassoFiscale,
            href: periodLink('/incomes', periods, {fiscal: 'yes'}),
            tone: 'income-fiscal'
        },
        {
            label: 'Entrate non fiscali',
            value: totals.incassoNonFiscale,
            href: periodLink('/incomes', periods, {fiscal: 'no'}),
            tone: 'income-non-fiscal'
        },
        {
            label: 'Uscite fiscali',
            value: totals.usciteFiscali,
            href: periodLink('/expenses', periods, {declared: 'yes'}),
            tone: 'expense-fiscal'
        },
        {
            label: 'Uscite non fiscali',
            value: totals.usciteNonFiscali,
            href: periodLink('/expenses', periods, {declared: 'no'}),
            tone: 'expense-non-fiscal'
        }
    ];
    const max = Math.max(...items.map(item => item.value), 0);
    const total = items.reduce((sum, item) => sum + item.value, 0);

    return <section className="card income-expense-chart-card" aria-labelledby="income-expense-chart-title">
        <div className="card-heading-row">
            <div className="card-title-wrap">
                <h2 id="income-expense-chart-title">Grafico entrate / uscite</h2>
                <p className="muted">Ripartizione fiscale e non fiscale anno {periods[0]?.year ?? ''}.</p>
            </div>
            <div>
                <span className="badge">Totale {chartEuro(total)}</span>
            </div>
        </div>
        <div className="income-expense-chart-list">
            {items.map(item => {
                const percentage = total ? (item.value / total) * 100 : 0;
                const width = max ? Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0) : 0;

                return <Link className="income-expense-chart-row" href={item.href} key={item.label}>
                    <span className={`income-expense-chart-marker ${item.tone}`} aria-hidden="true"/>
                    <span className="income-expense-chart-label">
            <span>{item.label}</span>
            <span className="income-expense-chart-value">
              <strong className={moneyTone(item.value)}>{chartEuro(item.value)}</strong>
              <small>{percentage.toFixed(1)}%</small>
            </span>
          </span>
                    <span className="income-expense-chart-bar-wrap"
                          aria-label={`${item.label}: ${chartEuro(item.value)}`}>
            <span className={`income-expense-chart-bar ${item.tone}`} style={{width: `${width}%`}}/>
          </span>

                    <span className="income-expense-chart-value income-expense-chart-value-inline">
            <strong className={moneyTone(item.value)}>{chartEuro(item.value)}</strong>
            <small>{percentage.toFixed(1)}%</small>
          </span>
                </Link>;
            })}
        </div>
    </section>;
}

export default async function Dashboard({searchParams}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspace('/');
    const params = (await searchParams) ?? {};
    const now = new Date();
    const currentPeriod = yearMonthInTimeZone(current.company.timeZone, now);
    const currentYear = currentPeriod.year;
    const currentMonth = currentPeriod.month;
    const currentQuarterIndex = Math.floor((currentMonth - 1) / 3);
    const overviewMonthValue = Array.isArray(params.overviewMonth) ? params.overviewMonth[0] : params.overviewMonth;
    const overviewQuarterValue = Array.isArray(params.overviewQuarter) ? params.overviewQuarter[0] : params.overviewQuarter;
    const legacyTrendMonthValue = Array.isArray(params.trendMonth) ? params.trendMonth[0] : params.trendMonth;
    const legacyTrendQuarterValue = Array.isArray(params.trendQuarter) ? params.trendQuarter[0] : params.trendQuarter;
    const legacyFiscalMonthValue = Array.isArray(params.fiscalMonth) ? params.fiscalMonth[0] : params.fiscalMonth;
    const legacyFiscalQuarterValue = Array.isArray(params.fiscalQuarter) ? params.fiscalQuarter[0] : params.fiscalQuarter;
    const trendMonthValue = overviewMonthValue ?? legacyTrendMonthValue ?? legacyFiscalMonthValue;
    const trendQuarterValue = overviewQuarterValue ?? legacyTrendQuarterValue ?? legacyFiscalQuarterValue;
    const fiscalMonthValue = trendMonthValue;
    const fiscalQuarterValue = trendQuarterValue;
    const annualYearValue = Array.isArray(params.annualYear) ? params.annualYear[0] : params.annualYear;
    const annualYear = parseYearSelection(annualYearValue, currentYear);
    const defaultCompletedMonth = annualYear < currentYear
        ? {year: annualYear, month: 12}
        : annualYear === currentYear && currentMonth === 1
            ? {year: currentYear - 1, month: 12}
            : {year: annualYear, month: annualYear === currentYear ? currentMonth - 1 : 1};
    const defaultCompletedQuarter = annualYear < currentYear
        ? {year: annualYear, quarterIndex: 3}
        : annualYear === currentYear && currentQuarterIndex === 0
            ? {year: currentYear - 1, quarterIndex: 3}
            : {year: annualYear, quarterIndex: annualYear === currentYear ? currentQuarterIndex - 1 : 0};
    const rawSelectedTrendMonth = parseMonthSelection(trendMonthValue, defaultCompletedMonth.year, defaultCompletedMonth.month);
    const rawSelectedTrendQuarter = parseQuarterSelection(trendQuarterValue, defaultCompletedQuarter.year, defaultCompletedQuarter.quarterIndex);
    const rawSelectedMonth = parseMonthSelection(fiscalMonthValue, defaultCompletedMonth.year, defaultCompletedMonth.month);
    const rawSelectedQuarter = parseQuarterSelection(fiscalQuarterValue, defaultCompletedQuarter.year, defaultCompletedQuarter.quarterIndex);
    const selectedTrendMonth = trendMonthValue ? {...rawSelectedTrendMonth, year: annualYear} : rawSelectedTrendMonth;
    const selectedTrendQuarter = trendQuarterValue ? {
        ...rawSelectedTrendQuarter,
        year: annualYear
    } : rawSelectedTrendQuarter;
    const selectedMonth = fiscalMonthValue ? {...rawSelectedMonth, year: annualYear} : rawSelectedMonth;
    const selectedQuarter = fiscalQuarterValue ? {...rawSelectedQuarter, year: annualYear} : rawSelectedQuarter;
    const reportYear = annualYear;
    const trendQuarterPeriods = fiscalQuarterMonthsByIndex(selectedTrendQuarter.year, selectedTrendQuarter.quarterIndex);
    const scheduleFrom = new Date(Date.UTC(annualYear, 0, 1));
    const scheduleTo = new Date(Date.UTC(annualYear + 1, 0, 1));
    const [report, incomeChannelTrendRecords, expenseCategoryTrendRecords, monthlyTrendTotals, quarterlyTrendTotals, expenseCategories, banks, paymentMethods, suppliers, pendingIncomes, pendingExpenses] = await Promise.all([
        getAccountingDashboardReport(reportYear, now, selectedMonth, selectedQuarter, annualYear, current.workspace.id, current.company.id, current.company.timeZone),
        prisma.income.findMany({
            where: {
                workspaceId: current.workspace.id,
                companyId: current.company.id,
                creditDate: {
                    gte: zonedMidnightUtc(`${annualYear}-01-01`, current.company.timeZone),
                    lt: zonedMidnightUtc(`${annualYear + 1}-01-01`, current.company.timeZone)
                }
            },
            select: {amount: true, creditDate: true, salesChannelId: true, salesChannelRef: {select: {name: true, icon: true}}}
        }),
        prisma.expense.findMany({
            where: {
                workspaceId: current.workspace.id,
                companyId: current.company.id,
                receivedDate: {
                    gte: zonedMidnightUtc(`${annualYear}-01-01`, current.company.timeZone),
                    lt: zonedMidnightUtc(`${annualYear + 1}-01-01`, current.company.timeZone)
                }
            },
            select: {amount: true, receivedDate: true, expenseType: true, categoryId: true, category: {select: {name: true, icon: true}}}
        }),
        getOrderDateMonthSummary(selectedTrendMonth.year, selectedTrendMonth.month, current.workspace.id, current.company.id, current.company.timeZone),
        getOrderDatePeriodSummary(trendQuarterPeriods, current.workspace.id, current.company.id, current.company.timeZone),
        prisma.expenseCategory.findMany({where: {workspaceId: current.workspace.id}, orderBy: {id: 'asc'}}),
        prisma.bank.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.paymentMethod.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.supplier.findMany({
            where: {workspaceId: current.workspace.id},
            orderBy: {businessName: 'asc'},
            take: 100
        }),
        prisma.income.findMany({
            where: {
                workspaceId: current.workspace.id,
                companyId: current.company.id,
                isCredited: false,
                dueDate: {gte: scheduleFrom, lt: scheduleTo}
            },
            select: {amount: true, dueDate: true, credits: {select: {amount: true}}}
        }),
        prisma.expense.findMany({
            where: {
                workspaceId: current.workspace.id,
                companyId: current.company.id,
                isComplete: false,
                dueDate: {gte: scheduleFrom, lt: scheduleTo}
            },
            select: {
                amount: true,
                dueDate: true,
                payments: {select: {amount: true}}
            }
        })
    ]);
    const orderedExpenseCategories = orderExpenseCategories(expenseCategories);
    const incomeChannelTrend = aggregateIncomeChannelTrend(incomeChannelTrendRecords, annualYear, current.company.timeZone);
    const expenseCategoryTrend = aggregateExpenseCategoryTrend(expenseCategoryTrendRecords, annualYear, current.company.timeZone);
    const orderedBanks = orderBanks(banks);
    const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');
    const fiscalMonth = report.currentFiscalMonth.periods[0];
    const trendExpensesHref = dateRangeLink('/expenses', selectedTrendMonth.year, selectedTrendMonth.month);
    const trendUnpaidExpensesHref = dateRangeLink('/expenses', selectedTrendMonth.year, selectedTrendMonth.month, {paymentStatus: 'not_complete'});
    const trendOverdueExpensesHref = dateRangeLink('/expenses', selectedTrendMonth.year, selectedTrendMonth.month, {paymentStatus: 'overdue'});
    const trendIncomesHref = dateRangeLink('/incomes', selectedTrendMonth.year, selectedTrendMonth.month);
    const monthExpensesHref = periodLink('/expenses', report.currentFiscalMonth.periods);
    const monthUnpaidExpensesHref = periodLink('/expenses', report.currentFiscalMonth.periods, {
        paymentStatus: 'not_complete',
        declared: 'yes'
    });
    const monthOverdueExpensesHref = periodLink('/expenses', report.currentFiscalMonth.periods, {
        paymentStatus: 'overdue',
        declared: 'yes'
    });
    const monthIncomesHref = periodLink('/incomes', report.currentFiscalMonth.periods);
    const monthInvoicesNotSentHref = periodLink('/incomes', report.currentFiscalMonth.periods, {
        fiscal: 'yes',
        invoiceStatusMode: 'not_emitted'
    });
    const monthInvoicesNotReceivedHref = periodLink('/expenses', report.currentFiscalMonth.periods, {
        declared: 'yes',
        invoiceStatusMode: 'not_received'
    });
    const quarterExpensesHref = periodLink('/expenses', report.currentFiscalQuarter.periods);
    const quarterUnpaidExpensesHref = periodLink('/expenses', report.currentFiscalQuarter.periods, {
        paymentStatus: 'not_complete',
        declared: 'yes'
    });
    const quarterOverdueExpensesHref = periodLink('/expenses', report.currentFiscalQuarter.periods, {
        paymentStatus: 'overdue',
        declared: 'yes'
    });
    const quarterIncomesHref = periodLink('/incomes', report.currentFiscalQuarter.periods);
    const quarterInvoicesNotSentHref = periodLink('/incomes', report.currentFiscalQuarter.periods, {
        fiscal: 'yes',
        invoiceStatusMode: 'not_emitted'
    });
    const quarterInvoicesNotReceivedHref = periodLink('/expenses', report.currentFiscalQuarter.periods, {
        declared: 'yes',
        invoiceStatusMode: 'not_received'
    });
    const monthOptionYear = selectedMonth.year || currentYear;
    const quarterOptionYear = selectedQuarter.year || currentYear;
    const yearOptions = Array.from(new Set([currentYear + 1, currentYear, currentYear - 1, currentYear - 2, reportYear, annualYear, selectedTrendMonth.year, selectedTrendQuarter.year, monthOptionYear, quarterOptionYear])).sort((a, b) => b - a);
    const monthOptions = Array.from({length: 12}, (_, index) => ({year: monthOptionYear, month: index + 1}));
    const quarterOptions = Array.from({length: 4}, (_, index) => ({year: quarterOptionYear, quarterIndex: index}));
    const annualPeriods = Array.from({length: report.annualCompletedThroughMonth}, (_, index) => ({
        year: report.annualYear,
        month: index + 1
    }));
    const completedReportMonths = report.months.slice(0, report.reportCompletedThroughMonth);
    const consolidatedPeriodLabel = report.annualCompletedThroughMonth
        ? `${capitalizedMonthName(report.annualCompletedThroughMonth)} ${report.annualYear}`
        : null;
    const consolidatedPeriodCopy = consolidatedPeriodLabel
        ? `fino a ${consolidatedPeriodLabel}`
        : `senza mesi conclusi nel ${report.annualYear}`;
    const consolidatedRangeLabel = consolidatedPeriodLabel
        ? `${capitalizedMonthName(1)} – ${consolidatedPeriodLabel}`
        : `nessun mese concluso nel ${report.annualYear}`;
    const cashSchedule: CashScheduleItem[] = Array.from({length: 12}, (_, index) => ({
        month: index + 1,
        incoming: 0,
        outgoing: 0,
        overdue: 0
    }));
    pendingIncomes.forEach(income => {
        const scheduledDate = income.dueDate;
        if (!scheduledDate) return;
        const credited = income.credits.reduce((sum, credit) => sum + Number(credit.amount), 0);
        cashSchedule[scheduledDate.getUTCMonth()].incoming += Math.max(0, Number(income.amount) - credited);
    });
    pendingExpenses.forEach(expense => {
        if (!expense.dueDate) return;
        const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const residual = Math.max(Number(expense.amount) - paid, 0);
        const item = cashSchedule[expense.dueDate.getUTCMonth()];
        item.outgoing += residual;
        const dueDay = calendarDayNumber(expense.dueDate, current.company.timeZone, true);
        const todayDay = calendarDayNumber(now, current.company.timeZone);
        if (dueDay !== null && todayDay !== null && dueDay < todayDay) item.overdue += residual;
    });

    return <div className="grid dashboard-grid fixed">

        <NewExpensePanel
            categories={orderedExpenseCategories.map(c => ({
                id: c.id,
                code: c.code,
                name: c.name,
                icon: c.icon,
                isVatSettlementDefault: c.id === current.workspace.vatSettlementCategoryId
            }))}
            banks={orderedBanks.map(b => ({
                id: b.id,
                name: b.name,
                icon: b.icon,
                isFallback: b.isFallback,
                isPrimary: b.id === current.company.primaryBankId
            }))}
            paymentMethods={expensePaymentMethods.map(method => ({
                id: method.id,
                name: method.name,
                icon: method.icon,
                kind: method.kind,
                isFallback: method.isFallback,
                systemRole: method.systemRole
            }))}
            suppliers={suppliers.map(s => ({
                id: s.id,
                businessName: s.businessName,
                alias: s.alias,
                email: s.email,
                vatNumber: s.vatNumber,
                iban: s.iban,
                pec: s.pec,
                taxCodeSdi: s.taxCodeSdi,
                internalNotes: s.internalNotes,
                defaultExpenseCategoryId: s.defaultExpenseCategoryId,
                defaultVatRate: s.defaultVatRate?.toString() ?? null,
                systemRole: s.systemRole
            }))}
            initialOpen={(Array.isArray(params.new) ? params.new[0] : params.new) === '1'}
            showToolbar={false}
        />
        <div className="dashboard-actions toolbar-card dashboard-header-card">
            <div className="dashboard-title-block">
                <h2>Dashboard</h2>
                <p className="muted">Dati consolidati <strong>{consolidatedPeriodCopy}</strong>. Liquidità e scadenze sono aggiornate a oggi.</p>
            </div>
            <div className="actions-row dashboard-top-actions">
                <ExpenseNewTriggerButton className="btn btn-md btn-primary"><span
                    className="btn-icon">＋</span> Spesa
                </ExpenseNewTriggerButton>
                <Link className="btn btn-md btn-primary" href="/incomes?new=1"><span
                    className="btn-icon">＋</span> Incasso</Link>
                {/*<Link className="btn btn-lg btn-primary" href="/suppliers?new=1"><span className="btn-icon">＋</span> Fornitore</Link>*/}
            </div>
            <div>
                <form className="period-selector dashboard-year-selector" method="get">
                    <span className="selector-label">Anno fiscale</span>
                    <AutoSubmitSelect name="annualYear" defaultValue={String(report.annualYear)} aria-label="Anno fiscale dashboard">
                        {yearOptions.map(year => <option key={`top-annual-${year}`} value={year}>{year}</option>)}
                    </AutoSubmitSelect>
                </form>
            </div>
            {/*<div className="flex align-center justify-end dashboard-link-selector h100">*/}
            {/*    {fiscalMonth ?*/}
            {/*        <Link className="btn btn-sm btn-ghost dashboard-month-report-link" href={monthReportLink(fiscalMonth.year, fiscalMonth.month)}>*/}
            {/*        <span className="btn-icon" aria-hidden="true">*/}
            {/*            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"*/}
            {/*                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">*/}
            {/*                <rect x="3" y="5" width="18" height="16" rx="2"/>*/}
            {/*                <path d="M16 3v4M8 3v4M3 10h18"/>*/}
            {/*                <path d="M8 14h2M14 14h2M8 17h2M14 17h2"/>*/}
            {/*            </svg>*/}
            {/*        </span>*/}
            {/*            Vai al Report mensile*/}
            {/*        </Link> : null}*/}
            {/*</div>*/}
        </div>
        <div className="dashboard-body-wrapper">
            <DashboardSectionNav/>

            <div id="sintesi" className="dashboard-report-charts dashboard-anchor-section">
                <div className="charts-grid dashboard-overview-charts">
                    <ProfitabilitySummaryCard totals={report.totals} year={report.annualYear}
                                              periodLabel={consolidatedRangeLabel}/>
                    <ExpenseCompositionChart data={report.expensesByCategory} total={report.totals.speseTotali} incomeTotal={report.totals.incassoTotale}/>
                </div>
            </div>

            <div id="fiscale" className="dashboard-anchor-section">
                <FiscalNonFiscalOverview totals={report.totals} year={report.annualYear} periods={annualPeriods}/>
            </div>
            <MonthlyEconomicTrendChart data={completedReportMonths} year={report.annualYear}/>
            <IncomeSalesChannelTrendChart initialData={incomeChannelTrend} availableYears={[annualYear]}/>
            <ExpenseCategoryTrendChart data={expenseCategoryTrend}/>

            <div className="grid grid-2 dashboard-period-cards">
                <DashboardFiscalAjax
                    annualYear={report.annualYear}
                    monthOptions={monthOptions}
                    quarterOptions={quarterOptions}
                    initialTrend={{
                        year: selectedTrendMonth.year,
                        month: selectedTrendMonth.month,
                        totals: monthlyTrendTotals
                    }}
                    initialTrendQuarter={{periods: trendQuarterPeriods, totals: quarterlyTrendTotals}}
                    initialMonth={{
                        periods: report.currentFiscalMonth.periods,
                        totals: report.currentFiscalMonth.totals
                    }}
                    initialQuarter={{
                        periods: report.currentFiscalQuarter.periods,
                        totals: report.currentFiscalQuarter.totals
                    }}
                />
            </div>

            <div id="mensile" className="dashboard-monthly-section dashboard-anchor-section">
                <MonthlyProfitComparisonChart months={completedReportMonths} year={report.annualYear}/>

                <div className="card dashboard-report-card dashboard-monthly-legacy-report">
                    <div className="card-heading-row">
                        <div>
                            <h2>Report mensile {report.year}</h2>
                            <p className="muted">Mesi conclusi {consolidatedPeriodCopy}.</p>
                        </div>
                    </div>
                    <div className="table-scroll">
                        <table className="dashboard-report-table">
                            <thead>
                            <tr>
                                <th><span className="th-wrap">Mese</span></th>
                                <th className="highlight-column"><span className="th-wrap">Entrate<br/>totali</span>
                                </th>
                                <th><span className="th-wrap">Spesa<br/>Totale</span></th>
                                {/*<th><span className="th-wrap">Incasso<br />Fiscale</span></th>*/}
                                <th className="highlight-column"><span className="th-wrap">Margine<br/>lordo</span></th>
                                <th className="highlight-column"><span className="th-wrap">Utile<br/>netto</span></th>
                                <th className="highlight-column"><span className="th-wrap">Utile<br/>fiscale</span></th>
                                <th><span className="th-wrap">Incasso<br/>non fiscale</span></th>
                                <th><span className="th-wrap">Spese non<br/>fiscalizzate</span></th>
                                <th><span className="th-wrap">Spese non<br/>saldate</span></th>
                                {/*<th><span className="th-wrap">Pagamenti<br />scaduti</span></th>*/}
                                <th><span className="th-wrap">Debito<br/>IVA</span></th>
                            </tr>
                            </thead>
                            <tbody>{completedReportMonths.map(m => <tr key={m.month}>
                                <td>
                                    <Link className="badge" href={monthReportLink(m.year, m.month)}>{monthName(m.month)}</Link>
                                </td>
                                <td><Link href={periodLink('/incomes', [{year: m.year, month: m.month}])}><MoneyCell
                                    value={m.totals.incassoTotale} highlight/></Link></td>
                                <td><Link href={periodLink('/expenses', [{year: m.year, month: m.month}])}><MoneyCell
                                    value={m.totals.speseTotali}/></Link></td>
                                <td className="money-value-col">
                                    <PercentCell value={m.totals.utileLordo} total={m.totals.incassoTotale}/></td>
                                <td className="money-value-col"><MoneyCell value={m.totals.utileNetto} highlight/></td>
                                <td className="money-value-col"><MoneyCell value={m.totals.utileFiscale} highlight/>
                                </td>
                                {/*<td><Link href={periodLink('/incomes', [{ year: m.year, month: m.month }], { fiscal: 'yes' })}><MoneyCell value={m.totals.incassoFiscale} /></Link></td>*/}
                                <td><Link
                                    href={periodLink('/incomes', [{
                                        year: m.year,
                                        month: m.month
                                    }], {fiscal: 'no'})}><PercentCell
                                    value={m.totals.incassoNonFiscale} total={m.totals.incassoTotale}/></Link></td>
                                <td><Link href={periodLink('/expenses', [{
                                    year: m.year,
                                    month: m.month
                                }], {declared: 'no'})}><PercentCell value={m.totals.usciteNonFiscali}
                                                                    total={m.totals.speseTotali}
                                                                    tone={nonFiscalExpensePercentTone(m.totals.usciteNonFiscali, m.totals.speseTotali)}/></Link>
                                </td>
                                <td><Link href={periodLink('/expenses', [{
                                    year: m.year,
                                    month: m.month
                                }], {paymentStatus: 'not_complete'})}><MoneyCell value={m.totals.nonSaldato}/></Link>
                                </td>
                                {/*<td><Link className={m.totals.fattureScaduteCount > 0 ? 'count-critical' : 'count-muted'} href={periodLink('/expenses', [{ year: m.year, month: m.month }], { paymentStatus: 'overdue' })}>{m.totals.fattureScaduteCount}</Link></td>*/}
                                <td><MoneyCell value={m.totals.debitoIva}/></td>
                            </tr>)}</tbody>
                        </table>
                    </div>
                    <div className="dashboard-monthly-mobile" aria-label={`Report mensile ${report.year}`}>

                        {completedReportMonths.map(m =>
                            <div className="dashboard-monthly-mobile-row" key={`mobile-${m.month}`}>
                                <div className="dashboard-monthly-mobile-labels" aria-hidden="true">
                                    <span>Mese</span><span>Margine lordo</span><span>Utile netto</span><span>Utile fiscale</span>
                                </div>
                                <div className="dashboard-monthly-mobile-main">
                                    <Link className="dashboard-monthly-mobile-month" href={monthReportLink(m.year, m.month)}>
                                        <span className="dashboard-label-short">{capitalizedMonthName(m.month).slice(0, 3)}</span>
                                        <span className="dashboard-label">{capitalizedMonthName(m.month)}</span>
                                    </Link>
                                    <div className="dashboard-monthly-mobile-badge dashboard-monthly-mobile-percent">
                                        <MobilePercentCell value={m.totals.utileLordo} total={m.totals.incassoTotale}/>
                                    </div>
                                    <div><span className=""><MobileMoneyCell value={m.totals.utileNetto}/></span></div>
                                    <div><MobileMoneyCell value={m.totals.utileFiscale}/></div>
                                </div>
                                <div className="dashboard-monthly-mobile-secondary">
                                    <div>
                                        <span>Entrate</span>
                                        <Link href={periodLink('/incomes', [{year: m.year, month: m.month}])}>
                                            <MobileMoneyCellNoFormat value={m.totals.incassoTotale}/>
                                        </Link>
                                    </div>
                                    <div>
                                        <span>Uscite</span>
                                        <Link href={periodLink('/expenses', [{year: m.year, month: m.month}])}>
                                            <MobileMoneyCellNoFormat value={m.totals.speseTotali}/>
                                        </Link>
                                    </div>
                                    <div>
                                        <span>Entrate n.f.</span>
                                        <div className="dashboard-monthly-mobile-badge">
                                            <Link href={periodLink('/incomes', [{
                                                year: m.year,
                                                month: m.month
                                            }], {fiscal: 'no'})}>
                                                <MobilePercentCell value={m.totals.incassoNonFiscale} total={m.totals.incassoTotale}/>
                                            </Link>
                                        </div>
                                    </div>
                                    <div>
                                        <span>Spese n.f.</span>
                                        <div className="dashboard-monthly-mobile-badge"><Link
                                            href={periodLink('/expenses', [{
                                                year: m.year,
                                                month: m.month
                                            }], {declared: 'no'})}>
                                            <MobilePercentCell value={m.totals.usciteNonFiscali}
                                                               total={m.totals.speseTotali}
                                                               tone={nonFiscalExpensePercentTone(m.totals.usciteNonFiscali, m.totals.speseTotali)}/>
                                        </Link></div>
                                    </div>
                                </div>
                            </div>)}
                    </div>
                </div>
            </div>

            <div className="dashboard-report-charts">
                <div className="dashboard-insights-grid">
                    <CashScheduleChart items={cashSchedule} year={report.annualYear}/>
                    <VatSituationCard months={completedReportMonths} year={report.annualYear}/>
                </div>
            </div>
        </div>
    </div>;
}
