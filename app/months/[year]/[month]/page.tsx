import Link from 'next/link';
import NewExpensePanel from '@/components/NewExpensePanel';
import MonthReportMonthSelect from '@/components/MonthReportMonthSelect';
import YearNavigationSelect from '@/components/YearNavigationSelect';
import {prisma} from '@/lib/prisma';
import {getMonthlyReport, getOrderDatePeriodSummary, getPeriodReport, getPeriodSummary} from '@/lib/reports';
import {monthName} from '@/lib/money';
import {requireWorkspace} from '@/lib/auth';
import {lastCompletedMonthInTimeZone, yearMonthInTimeZone} from '@/lib/company-time';
import {orderBanks, orderExpenseCategories, orderPaymentMethods} from '@/lib/workspace-defaults';
import MonthComparisonPanel from '@/components/MonthComparisonPanel';
import PeriodVatOverview from '@/components/PeriodVatOverview';
import {comparisonPeriod, type MonthComparisonKind} from '@/lib/month-comparison';

function capitalize(value: string) {
    return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function euroInt(value: number | string | null | undefined) {
    const n = Number(value ?? 0);
    return new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0}).format(n);
}

function revenuePercentage(value: number, revenue: number) {
    return revenue ? `${(value / revenue * 100).toFixed(1).replace('.', ',')}%` : '—';
}

function monthValue(period: {year: number; month: number}) {
    return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

function periodListHref(path: '/expenses' | '/incomes', periods: Array<{year: number; month: number}>, mode: 'overall' | 'fiscal') {
    const first = periods[0];
    const last = periods[periods.length - 1];
    const query = new URLSearchParams();
    if (mode === 'fiscal') {
        query.set('billingPeriodFrom', monthValue(first));
        query.set('billingPeriodTo', monthValue(last));
    } else {
        const from = `${monthValue(first)}-01`;
        const lastDay = new Date(Date.UTC(last.year, last.month, 0)).getUTCDate();
        const to = `${monthValue(last)}-${String(lastDay).padStart(2, '0')}`;
        query.set(path === '/expenses' ? 'orderDateFrom' : 'creditDateFrom', from);
        query.set(path === '/expenses' ? 'orderDateTo' : 'creditDateTo', to);
    }
    return `${path}?${query}`;
}

function safeReturnTo(value: string | string[] | undefined) {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

const monthNavLabels = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const monthSelectLabels = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default async function MonthPage({params, searchParams}: { params: Promise<{ year: string; month: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const current = await requireWorkspace('/months');
    const resolvedParams = await params;
    const query = (await searchParams) ?? {};
    const year = Number(resolvedParams.year);
    const month = Number(resolvedParams.month);
    const rawPeriodType = Array.isArray(query.period) ? query.period[0] : query.period;
    const periodType: 'month' | 'quarter' | 'year' = rawPeriodType === 'quarter' || rawPeriodType === 'year' ? rawPeriodType : 'month';
    const quarter = Math.floor((month - 1) / 3) + 1;
    const reportPeriods = periodType === 'year'
        ? Array.from({length: 12}, (_, index) => ({year, month: index + 1}))
        : periodType === 'quarter'
            ? Array.from({length: 3}, (_, index) => ({year, month: (quarter - 1) * 3 + index + 1}))
            : [{year, month}];
    const rawMode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
    const mode: 'overall' | 'fiscal' = rawMode === 'fiscal' ? 'fiscal' : 'overall';
    const rawComparisonKind = Array.isArray(query.compare) ? query.compare[0] : query.compare;
    const comparisonKind: MonthComparisonKind = rawComparisonKind === 'year' || rawComparisonKind === 'custom'
        ? rawComparisonKind
        : 'previous';
    const rawComparisonMonth = Array.isArray(query.compareMonth) ? query.compareMonth[0] : query.compareMonth;
    const comparedPeriod = comparisonPeriod({year, month}, comparisonKind, rawComparisonMonth);
    const backHref = safeReturnTo(query.returnTo);
    const currentPeriod = yearMonthInTimeZone(current.company.timeZone);
    const lastCompletedMonth = lastCompletedMonthInTimeZone(current.company.timeZone);
    const currentYear = currentPeriod.year;
    const currentMonth = currentPeriod.month;
    const [report, comparisonReport, fiscalTotals, categories, banks, paymentMethods, suppliers, expenseYearBounds, incomeYearBounds] = await Promise.all([
        getPeriodReport(reportPeriods, current.workspace.id, mode, current.company.id, current.company.timeZone),
        periodType === 'month' ? getMonthlyReport(comparedPeriod.year, comparedPeriod.month, current.workspace.id, mode, current.company.id, current.company.timeZone) : Promise.resolve(null),
        mode === 'fiscal'
            ? getPeriodSummary(reportPeriods, {workspaceId: current.workspace.id, companyId: current.company.id, timeZone: current.company.timeZone, fiscalOnly: true})
            : getOrderDatePeriodSummary(reportPeriods, current.workspace.id, current.company.id, current.company.timeZone),
        prisma.expenseCategory.findMany({where: {workspaceId: current.workspace.id}, orderBy: {id: 'asc'}}),
        prisma.bank.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.paymentMethod.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.supplier.findMany({
            where: {workspaceId: current.workspace.id},
            orderBy: {businessName: 'asc'},
            take: 100
        }),
        prisma.expense.aggregate({
            where: {workspaceId: current.workspace.id, companyId: current.company.id},
            _min: {year: true, receivedDate: true}
        }),
        prisma.income.aggregate({
            where: {workspaceId: current.workspace.id, companyId: current.company.id},
            _min: {billingYear: true, orderDate: true}
        })
    ]);
    const orderedCategories = orderExpenseCategories(categories);
    const orderedBanks = orderBanks(banks);
    const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');
    const periodQuery = periodType === 'month' ? '' : `&period=${periodType}`;
    const currentReportHref = `/months/${year}/${month}?mode=${mode}${periodQuery}&returnTo=${encodeURIComponent(backHref)}`;
    const periodLabel = periodType === 'month' ? 'mese' : periodType === 'quarter' ? 'trimestre' : 'anno';
    const expensesHref = periodListHref('/expenses', reportPeriods, mode);
    const incomesHref = periodListHref('/incomes', reportPeriods, mode);
    const monthNavOptions = monthNavLabels.map((label, index) => {
        const navMonth = index + 1;
        const href = `/months/${year}/${navMonth}?mode=${mode}&returnTo=${encodeURIComponent(backHref)}`;
        return {
            label,
            selectLabel: monthSelectLabels[index],
            href,
            month: navMonth,
            disabled: year > currentYear || (year === currentYear && navMonth > currentMonth)
        };
    });
    const quarterNavOptions = Array.from({length: 4}, (_, index) => {
        const navQuarter = index + 1;
        const navMonth = index * 3 + 1;
        return {
            quarter: navQuarter,
            label: `Tri ${navQuarter}`,
            href: `/months/${year}/${navMonth}?mode=${mode}&period=quarter&returnTo=${encodeURIComponent(backHref)}`,
            disabled: year > currentYear || (year === currentYear && navQuarter > Math.floor((currentMonth - 1) / 3) + 1)
        };
    });
    const firstAvailableYear = Math.min(
        year,
        currentYear,
        ...[
            expenseYearBounds._min.year,
            expenseYearBounds._min.receivedDate?.getUTCFullYear(),
            incomeYearBounds._min.billingYear,
            incomeYearBounds._min.orderDate?.getUTCFullYear()
        ].filter((value): value is number => Number.isInteger(value))
    );
    const lastAvailableYear = Math.max(year, currentYear);
    const yearNavOptions = Array.from({length: lastAvailableYear - firstAvailableYear + 1}, (_, index) => lastAvailableYear - index)
        .map(navYear => {
            const navMonth = periodType === 'year'
                ? 1
                : periodType === 'quarter'
                    ? Math.min((quarter - 1) * 3 + 1, navYear === currentYear ? (Math.floor((currentMonth - 1) / 3) * 3 + 1) : 10)
                    : (navYear === currentYear ? Math.min(month, currentMonth) : month);
            return {
                year: navYear,
                href: `/months/${navYear}/${navMonth}?mode=${mode}${periodQuery}&returnTo=${encodeURIComponent(backHref)}`
            };
        });
    const quarterChartMaximum = Math.max(1, ...report.monthlyBreakdown.flatMap(item => [item.totals.incassoTotale, item.totals.speseTotali]));

    return <div className="grid month-report-page fixed">
        <NewExpensePanel
            categories={orderedCategories.map(category => ({
                id: category.id,
                code: category.code,
                name: category.name,
                icon: category.icon,
                isVatSettlementDefault: category.id === current.workspace.vatSettlementCategoryId
            }))}
            banks={orderedBanks.map(bank => ({
                id: bank.id,
                name: bank.name,
                icon: bank.icon,
                isFallback: bank.isFallback, isPrimary: bank.id === current.company.primaryBankId
            }))}
            paymentMethods={expensePaymentMethods.map(method => ({
                id: method.id,
                name: method.name,
                icon: method.icon,
                kind: method.kind,
                isFallback: method.isFallback,
                systemRole: method.systemRole
            }))}
            suppliers={suppliers.map(supplier => ({
                id: supplier.id,
                businessName: supplier.businessName,
                alias: supplier.alias,
                email: supplier.email,
                vatNumber: supplier.vatNumber,
                iban: supplier.iban,
                pec: supplier.pec,
                taxCodeSdi: supplier.taxCodeSdi,
                systemRole: supplier.systemRole,
                internalNotes: supplier.internalNotes,
                defaultExpenseCategoryId: supplier.defaultExpenseCategoryId,
                defaultVatRate: supplier.defaultVatRate?.toString() ?? null
            }))}
            initialExpense={{month: periodType === 'year' ? (year === currentYear ? currentMonth : 12) : periodType === 'quarter' ? (year === currentYear && quarter === Math.floor((currentMonth - 1) / 3) + 1 ? currentMonth : quarter * 3) : month, year}}
            showToolbar={false}
        />
        <section className="month-report-header">
            <div className="month-report-navigation">
                <span>
                    <Link className="btn btn-sm btn-default" href={backHref}>
                        <span className="btn-icon">↩</span><span className="hidden-mobile"> Indietro</span>
                    </Link>
                </span>

                <div className="trend-mode-toggle report-period-type-toggle" role="group" aria-label="Tipo di periodo">
                    <Link className={periodType === 'month' ? 'trend-mode-button is-active' : 'trend-mode-button'} href={`/months/${lastCompletedMonth.year}/${lastCompletedMonth.month}?mode=${mode}&returnTo=${encodeURIComponent(backHref)}`}>Mese</Link>
                    <Link className={periodType === 'quarter' ? 'trend-mode-button is-active' : 'trend-mode-button'} href={`/months/${year}/${(quarter - 1) * 3 + 1}?mode=${mode}&period=quarter&returnTo=${encodeURIComponent(backHref)}`}>Trimestre</Link>
                    <Link className={periodType === 'year' ? 'trend-mode-button is-active' : 'trend-mode-button'} href={`/months/${year}/1?mode=${mode}&period=year&returnTo=${encodeURIComponent(backHref)}`}>Anno</Link>
                </div>
                <YearNavigationSelect options={yearNavOptions} year={year}/>
                {periodType === 'month' ? <MonthReportMonthSelect
                    options={monthNavOptions}
                    value={currentReportHref}
                    ariaLabel="Seleziona mese"
                /> : null}
                {periodType !== 'year' ? <div className={periodType === 'quarter' ? 'btn-group month-report-month-nav month-report-quarter-nav' : 'month-report-month-nav'} aria-label={periodType === 'month' ? 'Seleziona mese' : 'Seleziona trimestre'}>
                    {(periodType === 'month' ? monthNavOptions : quarterNavOptions).map((option) => {
                        const optionValue = 'month' in option ? option.month : option.quarter;
                        const isActive = optionValue === (periodType === 'month' ? month : quarter);
                        return option.disabled
                            ? <button className="btn-sm btn-action month-report-month-button" type="button" disabled key={optionValue}>{option.label}</button>
                            : <Link className={isActive ? 'btn-sm btn-action btn-active month-report-month-button' : 'btn-sm btn-action month-report-month-button'} href={option.href} aria-current={isActive ? 'page' : undefined} key={optionValue}>{option.label}</Link>;
                    })}
                </div> : null}
            </div>

            <div className="month-report-title">
                <div>
                    <p>{periodType === 'month' ? 'Dettaglio mensile' : periodType === 'quarter' ? 'Dettaglio trimestrale' : 'Dettaglio annuale'}</p>
                    <h2>{periodType === 'month' ? `${capitalize(monthName(month))} ${year}` : periodType === 'quarter' ? `${quarter}° trimestre ${year} · ${capitalize(monthName(reportPeriods[0].month))}–${capitalize(monthName(reportPeriods[2].month))}` : `${year}`}</h2>
                </div>
                <div className="trend-mode-toggle month-report-mode-toggle" role="group" aria-label="Tipo andamento mensile">
                    <Link
                        className={mode === 'overall' ? 'trend-mode-button is-active' : 'trend-mode-button'}
                        href={`/months/${year}/${month}?mode=overall${periodQuery}&returnTo=${encodeURIComponent(backHref)}`}
                    >Complessivo</Link>
                    <Link
                        className={mode === 'fiscal' ? 'trend-mode-button is-active' : 'trend-mode-button'}
                        href={`/months/${year}/${month}?mode=fiscal${periodQuery}&returnTo=${encodeURIComponent(backHref)}`}
                    >Fiscale</Link>
                </div>
            </div>
            <div className="month-report-metrics">
                <div className="month-report-value"><span>{mode === 'fiscal' ? 'Entrate fiscali' : 'Entrate'}</span><strong
                    className="month-report-positive">{euroInt(report.totals.totalRevenue)} <small
                    className="month-report-metric-percentage"
                    aria-label="Base percentuale degli incassi">{report.totals.totalRevenue ? '100,0%' : '—'}</small></strong></div>
                <div className="month-report-value">
                    <span>{mode === 'fiscal' ? 'Uscite rilevanti' : 'Uscite'}</span><strong>{euroInt(report.totals.totalExpenses)} <small
                    className="month-report-metric-percentage"
                    aria-label="Percentuale delle uscite sugli incassi">{revenuePercentage(report.totals.totalExpenses, report.totals.totalRevenue)}</small></strong></div>
                <div className="month-report-value"><span>Margine lordo</span><strong
                    className="month-report-positive">{euroInt(report.totals.grossProfit)} <small
                    className="month-report-metric-percentage"
                    aria-label="Percentuale del margine lordo sugli incassi">{revenuePercentage(report.totals.grossProfit, report.totals.totalRevenue)}</small></strong></div>
                <div className="month-report-value"><span>Utile netto</span><strong
                    className="month-report-positive">{euroInt(report.totals.estimatedNetProfit)} <small
                    className="month-report-metric-percentage"
                    aria-label="Percentuale dell'utile netto sugli incassi">{revenuePercentage(report.totals.estimatedNetProfit, report.totals.totalRevenue)}</small></strong></div>
                <div className="month-report-value"><span>Utile fiscale</span><strong
                    className="month-report-positive">{euroInt(report.totals.declaredProfit)} <small
                    className="month-report-metric-percentage"
                    aria-label="Percentuale dell'utile fiscale sugli incassi">{revenuePercentage(report.totals.declaredProfit, report.totals.totalRevenue)}</small></strong></div>
                <div className="month-report-value"><span>Imposte previste</span><strong
                    className="month-report-positive">{euroInt(report.totals.estimatedTax)} <small
                    className="month-report-metric-percentage"
                    aria-label="Percentuale delle imposte previste sugli incassi">{revenuePercentage(report.totals.estimatedTax, report.totals.totalRevenue)}</small></strong></div>
            </div>
        </section>

        {periodType === 'month' ? null : <section className={periodType === 'year' ? 'card quarter-report-trend year-report-trend' : 'card quarter-report-trend'} aria-labelledby="quarter-report-trend-title">
            <div className="quarter-report-trend-heading">
                <p className="muted">Andamento del periodo</p>
                <h3 id="quarter-report-trend-title">Entrate, uscite e risultato mensile</h3>
            </div>
            <div className="quarter-report-legend" aria-hidden="true"><span className="is-income">Entrate</span><span className="is-expense">Uscite</span></div>
            <div className="quarter-report-chart">
                {report.monthlyBreakdown.map(item => {
                    const result = item.totals.incassoTotale - item.totals.speseTotali;
                    return <Link className="quarter-report-month" key={item.month} href={`/months/${item.year}/${item.month}?mode=${mode}&returnTo=${encodeURIComponent(currentReportHref)}`}>
                        <div className="quarter-report-bars" aria-label={`Entrate ${euroInt(item.totals.incassoTotale)}, uscite ${euroInt(item.totals.speseTotali)}`}>
                            <i className="is-income" style={{height: `${Math.max(3, item.totals.incassoTotale / quarterChartMaximum * 100)}%`}}/>
                            <i className="is-expense" style={{height: `${Math.max(3, item.totals.speseTotali / quarterChartMaximum * 100)}%`}}/>
                        </div>
                        <span>{capitalize(monthName(item.month))}</span>
                        <strong className={result < 0 ? 'is-negative' : 'is-positive'}>{euroInt(result)}</strong>
                    </Link>;
                })}
            </div>
        </section>}

        <section className="month-report-section">
            <h3>Indicatori fiscali</h3>
            <div className="month-report-fiscal-metrics">
                <div className="month-report-value"><span>Utile fiscale</span><strong
                    className="month-report-positive">{euroInt(fiscalTotals.utileFiscale)}</strong></div>
                <div className="month-report-value"><span>Imponibile</span><strong
                    className="month-report-positive">{euroInt(report.totals.taxableIncome)}</strong></div>
                <div className="month-report-value"><span>Fatture non ricevute</span><strong
                    className="month-report-warning">{fiscalTotals.fattureNonRicevute}</strong></div>
                <div className="month-report-value"><span>Fatture da inviare</span><strong
                    className="month-report-warning">{fiscalTotals.fattureNonInviate}</strong></div>
                {mode === 'overall' ? <div className="month-report-value"><span>Uscite non fiscali</span><strong
                    className="month-report-muted-value">{euroInt(fiscalTotals.usciteNonFiscali)}</strong></div> : null}
            </div>
        </section>

        <div className="grid grid-2 month-report-panels">
            <section className="card month-report-section"><h3>IVA</h3>
                <dl className="month-report-summary-grid">
                    <div><dt>IVA vendite</dt><dd>{euroInt(report.totals.vatToPay)}</dd></div>
                    <div><dt>IVA spese</dt><dd>{euroInt(report.totals.paidVat)}</dd></div>
                    <div><dt>IVA da versare</dt><dd>{euroInt(report.totals.remainingVat)}</dd></div>
                </dl>
                {mode === 'overall' && periodType !== 'month' ? <Link
                    className="month-report-vat-detail-link"
                    href={`/months/${year}/${month}?mode=fiscal${periodQuery}&returnTo=${encodeURIComponent(backHref)}#iva`}
                >Apri il prospetto IVA dettagliato in modalità Fiscale →</Link> : null}
            </section>
            <section className="card month-report-section"><h3>Entrate</h3>
                <dl className="month-report-summary-grid">
                    <div><dt>Totale incassi</dt><dd>{euroInt(report.totals.totalRevenue)}</dd></div>
                    <div><dt>Incassi fiscali</dt><dd>{euroInt(fiscalTotals.incassoFiscale)}</dd></div>
                    {mode === 'overall' ? <div><dt>Incassi non fiscali</dt><dd>{euroInt(fiscalTotals.incassoNonFiscale)}</dd></div> : null}
                </dl>
            </section>
        </div>
        {periodType === 'month' && comparisonReport ? <MonthComparisonPanel
            current={{
                year,
                month,
                totals: report.totals,
                hasMovements: report.expenses.length > 0 || report.incomes.length > 0
            }}
            comparison={{
                year: comparedPeriod.year,
                month: comparedPeriod.month,
                totals: comparisonReport.totals,
                hasMovements: comparisonReport.expenses.length > 0 || comparisonReport.incomes.length > 0
            }}
            kind={comparisonKind}
            mode={mode}
            returnTo={backHref}
            isCurrentMonth={year === currentYear && month === currentMonth}
        /> : null}
        <nav className="month-report-record-links" aria-label={`Movimenti del ${periodLabel}`}>
            <Link className="card month-report-record-link is-expense" href={expensesHref}>
                <span>Spese del {periodLabel}</span><strong aria-hidden="true">→</strong>
            </Link>
            <Link className="card month-report-record-link is-income" href={incomesHref}>
                <span>Incassi del {periodLabel}</span><strong aria-hidden="true">→</strong>
            </Link>
        </nav>
        {mode === 'fiscal' && periodType !== 'month' ? <PeriodVatOverview
            months={report.monthlyBreakdown}
            periodType={periodType}
        /> : null}
    </div>;
}
