import Link from 'next/link';
import NewExpensePanel from '@/components/NewExpensePanel';
import MonthReportMonthSelect from '@/components/MonthReportMonthSelect';
import YearNavigationSelect from '@/components/YearNavigationSelect';
import {prisma} from '@/lib/prisma';
import {completedReportPeriods, getMonthlyReport, getPeriodReport} from '@/lib/reports';
import {moneyTone, monthName} from '@/lib/money';
import {requireWorkspace} from '@/lib/auth';
import {lastCompletedMonthInTimeZone, yearMonthInTimeZone} from '@/lib/company-time';
import {orderBanks, orderExpenseCategories, orderPaymentMethods} from '@/lib/workspace-defaults';
import MonthComparisonPanel from '@/components/MonthComparisonPanel';
import PeriodVatOverview from '@/components/PeriodVatOverview';
import PeriodReportCharts from '@/components/PeriodReportCharts';
import MonthlyEconomicTrendChart from '@/components/MonthlyEconomicTrendChart';
import {comparisonPeriod, type MonthComparisonKind} from '@/lib/month-comparison';

function capitalize(value: string) {
    return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function euroInt(value: number | string | null | undefined, fractionDigits = 2) {
    const n = Number(value ?? 0);
    return new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits}).format(n);
}

function revenuePercentage(value: number, revenue: number) {
    return revenue ? `${(value / revenue * 100).toFixed(1).replace('.', ',')}%` : '—';
}

function monthValue(period: {year: number; month: number}) {
    return `${period.year}-${String(period.month).padStart(2, '0')}`;
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
    const selectedPeriods = periodType === 'year'
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
    const now = new Date();
    const currentPeriod = yearMonthInTimeZone(current.company.timeZone, now);
    const lastCompletedMonth = lastCompletedMonthInTimeZone(current.company.timeZone, now);
    const reportPeriods = periodType === 'month' ? selectedPeriods : completedReportPeriods(selectedPeriods, now, current.company.timeZone);
    const lastReportPeriod = reportPeriods.at(-1);
    const currentYear = currentPeriod.year;
    const currentMonth = currentPeriod.month;
    const [report, comparisonReport, categories, banks, paymentMethods, suppliers, expenseYearBounds, incomeYearBounds, paymentYearBounds, creditYearBounds] = await Promise.all([
        getPeriodReport(reportPeriods, current.workspace.id, mode, current.company.id, current.company.timeZone, {year, month}),
        periodType === 'month' ? getMonthlyReport(comparedPeriod.year, comparedPeriod.month, current.workspace.id, mode, current.company.id, current.company.timeZone) : Promise.resolve(null),
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
        }),
        prisma.expensePayment.aggregate({
            where: {expense: {workspaceId: current.workspace.id, companyId: current.company.id}},
            _min: {paymentDate: true}
        }),
        prisma.incomeCredit.aggregate({
            where: {income: {workspaceId: current.workspace.id, companyId: current.company.id}},
            _min: {creditDate: true}
        }),
    ]);
    const orderedCategories = orderExpenseCategories(categories);
    const orderedBanks = orderBanks(banks);
    const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');
    const periodQuery = periodType === 'month' ? '' : `&period=${periodType}`;
    const currentReportHref = `/months/${year}/${month}?mode=${mode}${periodQuery}&returnTo=${encodeURIComponent(backHref)}`;
    const periodLabel = periodType === 'month' ? 'mese' : periodType === 'quarter' ? 'trimestre' : 'anno';
    const periodTitle = periodType === 'year' ? 'dell’anno' : `del ${periodLabel}`;
    const recordListQuery = reportPeriods.length ? new URLSearchParams({
        billingPeriodFrom: monthValue(reportPeriods[0]),
        billingPeriodTo: monthValue(reportPeriods[reportPeriods.length - 1])
    }).toString() : '';
    const fiscalTotals = report.summary;
    const metrics: Array<{label: string; value: number; className?: string}> = [
        {label: mode === 'overall' ? 'Entrate' : 'Entrate fiscali', value: report.totals.totalRevenue, className: 'is-gross'},
        {label: mode === 'overall' ? 'Uscite' : 'Uscite fiscali', value: report.totals.totalExpenses, className: 'is-fiscal'},
        ...(mode === 'overall' ? [
            {label: 'Margine lordo', value: report.totals.grossProfit, className: 'is-gross'},
            {label: 'Risultato al netto IVA', value: report.totals.estimatedNetProfit, className: 'is-net'},
        ] : [
            {label: 'Utile fiscale', value: report.totals.declaredProfit, className: 'is-fiscal'},
            {label: 'Margine lordo', value: report.totals.grossProfit, className: 'is-gross'},
        ]),
    ];
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
            incomeYearBounds._min.orderDate?.getUTCFullYear(),
            paymentYearBounds._min.paymentDate?.getUTCFullYear(),
            creditYearBounds._min.creditDate ? yearMonthInTimeZone(current.company.timeZone, creditYearBounds._min.creditDate).year : null,
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
    const chartMonths = selectedPeriods.map(period => ({
        ...period,
        totals: report.monthlyBreakdown.find(item => item.year === period.year && item.month === period.month)?.totals
            ?? {incassoTotale: 0, speseTotali: 0, utileFiscale: 0, utileLordo: 0},
    }));
    const quarterChartMaximum = Math.max(1, ...chartMonths.flatMap(item => [item.totals.incassoTotale, item.totals.speseTotali]));

    return <div className="grid month-report-page">
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
                {/*<span>*/}
                {/*    <Link className="btn btn-sm btn-default" href={backHref}>*/}
                {/*        <span className="btn-icon">↩</span><span className="hidden-mobile"> Indietro</span>*/}
                {/*    </Link>*/}
                {/*</span>*/}

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
                {periodType !== 'year' ? <div className={periodType === 'quarter' ? 'btn-group month-report-month-nav month-report-quarter-nav' : 'btn-group month-report-month-nav'} aria-label={periodType === 'month' ? 'Seleziona mese' : 'Seleziona trimestre'}>
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
                    <h2>{periodType === 'month' ? `${capitalize(monthName(month))} ${year}` : periodType === 'quarter' ? `${quarter}° trimestre ${year} · ${capitalize(monthName(selectedPeriods[0].month))}–${capitalize(monthName(selectedPeriods[2].month))}` : `${year}`}</h2>
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
            {periodType !== 'month' ? <span className="muted">{lastReportPeriod
                ? `Dati fino a ${monthName(lastReportPeriod.month)} ${lastReportPeriod.year}. Sono inclusi soltanto i mesi conclusi.`
                : 'Nessun mese concluso nel periodo.'}</span> : null}
            <span className="muted">{mode === 'overall'
                ? 'Accrediti e pagamenti effettivi del periodo, inclusi i movimenti non fiscali. Il risultato al netto IVA rettifica il margine lordo per l’IVA sugli incassi e sulle spese pagate, senza contare due volte i versamenti IVA.'
                : 'Entrate e uscite fiscali del periodo di fatturazione, indipendentemente dalle date di accredito e pagamento. L’utile fiscale esclude l’IVA; i versamenti IVA sono separati dai costi.'}</span>
            <div className={`month-report-metrics month-report-metrics-${mode}`}>
                {metrics.map(metric => <article className={`profitability-summary-kpi ${metric.className}`} key={metric.label}>
                    <span>{metric.label}</span>
                    <strong className={moneyTone(metric.value)}>{euroInt(metric.value)}</strong>
                    <div className={moneyTone(metric.value, 'profitability-summary-percentage')} aria-label={`Percentuale ${metric.label.toLowerCase()} sulle entrate`}>
                        <b>{revenuePercentage(metric.value, report.totals.totalRevenue)}</b>
                        <small>sugli incassi</small>
                    </div>
                </article>)}
            </div>
        </section>

        {periodType === 'month' ? null : <section className={periodType === 'year' ? 'card quarter-report-trend year-report-trend' : 'card quarter-report-trend'} aria-labelledby="quarter-report-trend-title">
            <div className="quarter-report-trend-heading">
                <p className="muted">Andamento del periodo</p>
                <h3 id="quarter-report-trend-title">Entrate, uscite e margine lordo mensile</h3>
            </div>
            <div className="quarter-report-legend" aria-hidden="true"><span className="is-income">Entrate</span><span className="is-expense">Uscite</span></div>
            <div className="quarter-report-chart">
                {chartMonths.map(item => {
                    const result = mode === 'fiscal' ? item.totals.utileFiscale : item.totals.utileLordo;
                    return <Link className="quarter-report-month" key={item.month} href={`/months/${item.year}/${item.month}?mode=${mode}&returnTo=${encodeURIComponent(currentReportHref)}`}>
                        <div className="quarter-report-bars" aria-label={`Entrate ${euroInt(item.totals.incassoTotale, 0)}, uscite ${euroInt(item.totals.speseTotali, 0)}`}>
                            <i className="is-income" style={{height: `${item.totals.incassoTotale ? Math.max(3, item.totals.incassoTotale / quarterChartMaximum * 100) : 0}%`, minHeight: item.totals.incassoTotale ? undefined : 0}}/>
                            <i className="is-expense" style={{height: `${item.totals.speseTotali ? Math.max(3, item.totals.speseTotali / quarterChartMaximum * 100) : 0}%`, minHeight: item.totals.speseTotali ? undefined : 0}}/>
                        </div>
                        <div className="quarter-report-label flex justify-evenly">
                            <span>{capitalize(monthName(item.month))}</span>
                            <strong className={result < 0 ? 'is-negative' : 'is-positive'}>{euroInt(result, 0)}</strong>
                        </div>
                    </Link>;
                })}
            </div>
        </section>}

        {periodType !== 'month' ? <MonthlyEconomicTrendChart
            key={`${year}-${quarter}-${periodType}-${mode}`}
            data={report.monthlyBreakdown}
            year={year}
            periodLabel={periodType === 'quarter' ? `${quarter}° trimestre ${year}` : `anno ${year}`}
            mode={mode}
            returnTo={currentReportHref}
        /> : null}

        <div className="grid grid-2 month-report-panels">
            <section className="card month-report-section"><h3>IVA</h3>
                <dl className="month-report-summary-grid">
                    <div><dt>IVA vendite</dt><dd>{euroInt(report.totals.vatToPay)}</dd></div>
                    <div><dt>IVA detraibile sulle spese</dt><dd>{euroInt(report.totals.totalVatOnExpenses)}</dd></div>
                    <div><dt>Versamenti IVA registrati</dt><dd>{euroInt(report.totals.paidVat)}</dd></div>
                    <div><dt>{report.totals.remainingVat > 0 ? 'Saldo IVA a debito' : report.totals.remainingVat < 0 ? 'Saldo IVA a credito' : 'Saldo IVA'}</dt><dd>{euroInt(Math.abs(report.totals.remainingVat))}</dd></div>
                </dl>
                {/*{mode === 'overall' ? <p className="muted">IVA riferita ai movimenti di cassa del periodo. Per il riepilogo per periodo contabile consulta la modalità Fiscale.</p> : null}*/}
                {mode === 'overall' && periodType !== 'month' ? <Link
                    className="month-report-vat-detail-link"
                    href={`/months/${year}/${month}?mode=fiscal${periodQuery}&returnTo=${encodeURIComponent(backHref)}#iva`}
                >Apri il prospetto IVA dettagliato in modalità Fiscale →</Link> : null}
            </section>
            <section className="card month-report-section"><h3>{mode === 'fiscal' ? 'Indicatori fiscali' : 'Composizione dei movimenti'}</h3>
                <dl className="month-report-summary-grid">
                    {mode === 'fiscal' ? <>
                        <div><dt>Imponibile entrate</dt><dd>{euroInt(report.totals.taxableIncome)}</dd></div>
                        <div><dt>Fatture non ricevute</dt><dd className="month-report-warning">{fiscalTotals.fattureNonRicevute}</dd></div>
                        <div><dt>Tot. in attesa di fattura</dt><dd className="month-report-warning">{euroInt(fiscalTotals.totaleInAttesaFattura)}</dd></div>
                        <div><dt>Fatture da inviare</dt><dd className="month-report-warning">{fiscalTotals.fattureNonInviate}</dd></div>
                    </> : <>
                        <div><dt>Totale incassi</dt><dd>{euroInt(report.totals.totalRevenue)}</dd></div>
                        <div><dt>Incassi fiscali</dt><dd>{euroInt(fiscalTotals.incassoFiscale)}</dd></div>
                        <div><dt>Incassi non fiscali</dt><dd>{euroInt(fiscalTotals.incassoNonFiscale)}</dd></div>
                        <div><dt>Uscite non fiscali</dt><dd>{euroInt(fiscalTotals.usciteNonFiscali)}</dd></div>
                    </>}
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
        {reportPeriods.length > 0 ? <nav className="month-report-record-links" aria-label={`Movimenti ${periodTitle}`}>
            <Link className="card month-report-record-link is-expense" href={`/expenses?${recordListQuery}`}>
                <span>Spese {periodTitle}</span><strong aria-hidden="true">→</strong>
            </Link>
            <Link className="card month-report-record-link is-income" href={`/incomes?${recordListQuery}`}>
                <span>Incassi {periodTitle}</span><strong aria-hidden="true">→</strong>
            </Link>
        </nav> : null}
        {periodType !== 'month' && reportPeriods.length > 0 ? <PeriodReportCharts report={report} timeZone={current.company.timeZone}
            period={{type: periodType, quarter, mode, returnTo: currentReportHref}}/> : null}
        {mode === 'fiscal' && periodType !== 'month' && reportPeriods.length > 0 ? <PeriodVatOverview
            months={report.monthlyBreakdown}
            periodType={periodType}
        /> : null}
    </div>;
}
