import Link from 'next/link';
import ExpensesList from '@/components/ExpensesList';
import NewExpensePanel from '@/components/NewExpensePanel';
import MonthReportMonthSelect from '@/components/MonthReportMonthSelect';
import YearNavigationSelect from '@/components/YearNavigationSelect';
import IncomesList from '@/components/IncomesList';
import MonthReportAccordionController from '@/components/MonthReportAccordionController';
import {prisma} from '@/lib/prisma';
import {getMonthlyReport, getOrderDatePeriodSummary, getPeriodReport, getPeriodSummary} from '@/lib/reports';
import {monthName} from '@/lib/money';
import {requireWorkspace} from '@/lib/auth';
import {yearMonthInTimeZone} from '@/lib/company-time';
import {orderBanks, orderExpenseCategories, orderPaymentMethods} from '@/lib/workspace-defaults';
import SearchIcon from '@/components/SearchIcon';
import {prepareIncomeList} from '@/lib/income-list';
import {sortExpensesByReceivedDateDesc} from '@/lib/expense-calculations';
import MonthComparisonPanel from '@/components/MonthComparisonPanel';
import {comparisonPeriod, type MonthComparisonKind} from '@/lib/month-comparison';

function capitalize(value: string) {
    return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function euroInt(value: number | string | null | undefined) {
    const n = Number(value ?? 0);
    return new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0}).format(n);
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
    const periodType: 'month' | 'quarter' = rawPeriodType === 'quarter' ? 'quarter' : 'month';
    const quarter = Math.floor((month - 1) / 3) + 1;
    const reportPeriods = periodType === 'quarter'
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
    const currentYear = currentPeriod.year;
    const currentMonth = currentPeriod.month;
    const [report, comparisonReport, fiscalTotals, categories, banks, paymentMethods, suppliers, salesChannels, customers, expenseYearBounds, incomeYearBounds] = await Promise.all([
        getPeriodReport(reportPeriods, current.workspace.id, mode, current.company.id, current.company.timeZone),
        getMonthlyReport(comparedPeriod.year, comparedPeriod.month, current.workspace.id, mode, current.company.id, current.company.timeZone),
        mode === 'fiscal'
            ? getPeriodSummary(reportPeriods, {workspaceId: current.workspace.id, companyId: current.company.id, timeZone: current.company.timeZone})
            : getOrderDatePeriodSummary(reportPeriods, current.workspace.id, current.company.id, current.company.timeZone),
        prisma.expenseCategory.findMany({where: {workspaceId: current.workspace.id}, orderBy: {id: 'asc'}}),
        prisma.bank.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.paymentMethod.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.supplier.findMany({
            where: {workspaceId: current.workspace.id},
            orderBy: {businessName: 'asc'},
            take: 100
        }),
        prisma.incomeSalesChannel.findMany({where: {workspaceId: current.workspace.id}, orderBy: [{sortOrder: 'asc'}, {name: 'asc'}]}),
        prisma.customer.findMany({where: {workspaceId: current.workspace.id}, orderBy: {businessName: 'asc'}}),
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
    const incomePaymentMethods = orderPaymentMethods(paymentMethods, 'INCOME');
    const periodQuery = periodType === 'quarter' ? '&period=quarter' : '';
    const currentReportHref = `/months/${year}/${month}?mode=${mode}${periodQuery}&returnTo=${encodeURIComponent(backHref)}`;
    const returnTo = encodeURIComponent(currentReportHref);
    const supplierQuickValue = Array.isArray(query.supplierQuick) ? query.supplierQuick[0] ?? '' : query.supplierQuick ?? '';
    const supplierQuick = supplierQuickValue.trim().toLocaleLowerCase('it');
    const filteredExpenses = report.expenses.filter(expense => !supplierQuick || (expense.supplier?.businessName ?? '').toLocaleLowerCase('it').includes(supplierQuick));
    const mobileExpenses = sortExpensesByReceivedDateDesc(filteredExpenses);
    const customerQuickValue = Array.isArray(query.customerQuick) ? query.customerQuick[0] ?? '' : query.customerQuick ?? '';
    const customerQuick = customerQuickValue.trim().toLocaleLowerCase('it');
    const filteredIncomes = report.incomes.filter(income => !customerQuick || (income.customer?.businessName ?? '').toLocaleLowerCase('it').includes(customerQuick));
    const {standardIncomes: listedIncomes, cashRegisterGroups} = prepareIncomeList(filteredIncomes);
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
            const navMonth = periodType === 'quarter'
                ? Math.min((quarter - 1) * 3 + 1, navYear === currentYear ? (Math.floor((currentMonth - 1) / 3) * 3 + 1) : 10)
                : (navYear === currentYear ? Math.min(month, currentMonth) : month);
            return {
                year: navYear,
                href: `/months/${navYear}/${navMonth}?mode=${mode}${periodQuery}&returnTo=${encodeURIComponent(backHref)}`
            };
        });
    const quarterChartMaximum = Math.max(1, ...report.monthlyBreakdown.flatMap(item => [item.totals.incassoTotale, item.totals.speseTotali]));

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
            initialExpense={{month: periodType === 'quarter' ? (year === currentYear && quarter === Math.floor((currentMonth - 1) / 3) + 1 ? currentMonth : quarter * 3) : month, year}}
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
                    <Link className={periodType === 'month' ? 'trend-mode-button is-active' : 'trend-mode-button'} href={`/months/${year}/${month}?mode=${mode}&returnTo=${encodeURIComponent(backHref)}`}>Mese</Link>
                    <Link className={periodType === 'quarter' ? 'trend-mode-button is-active' : 'trend-mode-button'} href={`/months/${year}/${(quarter - 1) * 3 + 1}?mode=${mode}&period=quarter&returnTo=${encodeURIComponent(backHref)}`}>Trimestre</Link>
                </div>
                <YearNavigationSelect options={yearNavOptions} year={year}/>
                <MonthReportMonthSelect
                    options={periodType === 'month' ? monthNavOptions : quarterNavOptions.map(option => ({...option, selectLabel: option.label}))}
                    value={currentReportHref}
                    ariaLabel={periodType === 'month' ? 'Seleziona mese' : 'Seleziona trimestre'}
                />
                <div className="month-report-month-nav" aria-label={periodType === 'month' ? 'Seleziona mese' : 'Seleziona trimestre'}>
                    {(periodType === 'month' ? monthNavOptions : quarterNavOptions).map((option) => {
                        const optionValue = 'month' in option ? option.month : option.quarter;
                        const isActive = optionValue === (periodType === 'month' ? month : quarter);
                        return option.disabled
                            ? <button className="btn-xs btn-action month-report-month-button" type="button" disabled key={optionValue}>{option.label}</button>
                            : <Link className={isActive ? 'btn-xs btn-action btn-active month-report-month-button' : 'btn-xs btn-action month-report-month-button'} href={option.href} key={optionValue}>{option.label}</Link>;
                    })}
                </div>
            </div>

            <div className="month-report-title">
                <div>
                    <p>{periodType === 'month' ? 'Dettaglio mensile' : 'Dettaglio trimestrale'}</p>
                    <h2>{periodType === 'month' ? `${capitalize(monthName(month))} ${year}` : `${quarter}° trimestre ${year} · ${capitalize(monthName(reportPeriods[0].month))}–${capitalize(monthName(reportPeriods[2].month))}`}</h2>
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
            <div className="grid grid-4 month-report-metrics">
                <div className="month-report-value"><span>Entrate</span><strong
                    className="month-report-positive">{euroInt(report.totals.totalRevenue)}</strong></div>
                <div className="month-report-value">
                    <span>Uscite</span><strong>{euroInt(report.totals.totalExpenses)}</strong></div>
                <div className="month-report-value"><span>Utile lordo</span><strong
                    className="month-report-positive">{euroInt(report.totals.grossProfit)}</strong></div>
                <div className="month-report-value"><span>Netto previsto</span><strong
                    className="month-report-positive">{euroInt(report.totals.estimatedNetProfit)}</strong></div>
            </div>
        </section>

        {periodType === 'month' ? null : <section className="card quarter-report-trend" aria-labelledby="quarter-report-trend-title">
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
                <div className="month-report-value"><span>Fatture non ricevute</span><strong
                    className="month-report-warning">{fiscalTotals.fattureNonRicevute}</strong></div>
                <div className="month-report-value"><span>Fatture da inviare</span><strong
                    className="month-report-warning">{fiscalTotals.fattureNonInviate}</strong></div>
                <div className="month-report-value"><span>Uscite non fiscali</span><strong
                    className="month-report-muted-value">{euroInt(fiscalTotals.usciteNonFiscali)}</strong></div>
            </div>
        </section>

        <div className="grid grid-2 month-report-panels">
            <section className="card month-report-section"><h3>IVA</h3>
                <table>
                    <tbody>
                    <tr>
                        <td>IVA vendite</td>
                        <td>{euroInt(report.totals.vatToPay)}</td>
                    </tr>
                    <tr>
                        <td>IVA spese</td>
                        <td>{euroInt(report.totals.paidVat)}</td>
                    </tr>
                    <tr>
                        <td>IVA da versare</td>
                        <td>{euroInt(report.totals.remainingVat)}</td>
                    </tr>
                    </tbody>
                </table>
            </section>
            <section className="card month-report-section"><h3>Entrate</h3>
                <table>
                    <tbody>
                    <tr>
                        <td>Totale incassi</td>
                        <td>{euroInt(report.totals.totalRevenue)}</td>
                    </tr>
                    <tr>
                        <td>Incassi fiscali</td>
                        <td>{euroInt(fiscalTotals.incassoFiscale)}</td>
                    </tr>
                    <tr>
                        <td>Incassi non fiscali</td>
                        <td>{euroInt(fiscalTotals.incassoNonFiscale)}</td>
                    </tr>
                    </tbody>
                </table>
            </section>
        </div>
        {periodType === 'month' ? <MonthComparisonPanel
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
        <div className="month-report-accordion" data-month-report-accordion>
        <MonthReportAccordionController />
        <details className="month-report-section month-report-expenses month-report-collapsible" open>
            <summary className="month-report-section-heading">
                <h3>Spese del {periodType === 'month' ? 'mese' : 'trimestre'}</h3>
                <div className="month-report-value month-report-inline-total"><span>Spese non saldate</span><strong
                    className="money-warning">{euroInt(fiscalTotals.nonSaldato)}</strong></div>
            </summary>
            <form className="entity-quick-search app-quick-search-form" action={`/months/${year}/${month}`} method="get" role="search">
                <input type="hidden" name="mode" value={mode}/>
                {periodType === 'quarter' ? <input type="hidden" name="period" value="quarter"/> : null}
                <input type="hidden" name="returnTo" value={backHref}/>
                {customerQuickValue ? <input type="hidden" name="customerQuick" value={customerQuickValue}/> : null}
                <label className="app-form-field-label" htmlFor="monthExpenseSupplierQuickSearch"><span className="app-form-field-icon" aria-hidden="true">⌕</span><span>Ricerca fornitore</span></label>
                <div className="entity-quick-search-field app-quick-search-field input-group">
                    <input id="monthExpenseSupplierQuickSearch" name="supplierQuick" defaultValue={supplierQuickValue} placeholder="Nome o ragione sociale" autoComplete="off"/>
                    <button className="btn btn-sm btn-main" type="submit" aria-label="Cerca fornitore"><SearchIcon /></button>
                </div>
            </form>
            {supplierQuickValue ? <div className="recurring-active-filters"><div><span className="recurring-active-filters-title">Filtri attivi</span><div className="recurring-active-filter-tags"><span className="badge"><strong>Fornitore:</strong> {supplierQuickValue}</span></div></div><Link className="btn btn-xs btn-neutral recurring-active-filters-reset" href={`/months/${year}/${month}?mode=${mode}${periodQuery}&returnTo=${encodeURIComponent(backHref)}${customerQuickValue ? `&customerQuick=${encodeURIComponent(customerQuickValue)}` : ''}`}>× Reset</Link></div> : null}
            <ExpensesList
                timeZone={current.company.timeZone}
                expenses={filteredExpenses}
                mobileExpenses={mobileExpenses}
                returnTo={returnTo}
                showSupplierColumn
                selectable
                formId="monthExpenseBulkForm"
                categories={orderedCategories.map(category => ({
                    id: category.id,
                    code: category.code,
                    name: category.name,
                    icon: category.icon,
                    isVatSettlementDefault: category.id === current.workspace.vatSettlementCategoryId
                }))}
                banks={orderedBanks.map(bank => ({id: bank.id, name: bank.name, icon: bank.icon, isFallback: bank.isFallback, isPrimary: bank.id === current.company.primaryBankId}))}
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
                mobileLabel={`Lista spese del ${periodType === 'month' ? 'mese' : 'trimestre'} mobile`}
                emptyMessage={`Nessuna spesa trovata in questo ${periodType === 'month' ? 'mese' : 'trimestre'}.`}
            />
        </details>
        <details className="month-report-section month-report-incomes month-report-collapsible">
            <summary className="month-report-section-heading">
                <h3>Incassi del {periodType === 'month' ? 'mese' : 'trimestre'}</h3>
                <div className="month-report-value month-report-inline-total flex-grow"><span>Totale incassi</span><strong
                    className="month-report-positive">{euroInt(report.totals.totalRevenue)}</strong></div>
            </summary>
            <form className="entity-quick-search app-quick-search-form" action={`/months/${year}/${month}`} method="get" role="search">
                <input type="hidden" name="mode" value={mode}/>
                {periodType === 'quarter' ? <input type="hidden" name="period" value="quarter"/> : null}
                <input type="hidden" name="returnTo" value={backHref}/>
                {supplierQuickValue ? <input type="hidden" name="supplierQuick" value={supplierQuickValue}/> : null}
                <label className="app-form-field-label" htmlFor="monthIncomeCustomerQuickSearch"><span className="app-form-field-icon" aria-hidden="true">⌕</span><span>Ricerca cliente</span></label>
                <div className="entity-quick-search-field app-quick-search-field input-group">
                    <input id="monthIncomeCustomerQuickSearch" name="customerQuick" defaultValue={customerQuickValue} placeholder="Nome o ragione sociale" autoComplete="off"/>
                    <button className="btn btn-sm btn-main" type="submit" aria-label="Cerca cliente"><SearchIcon/></button>
                </div>
            </form>
            {customerQuickValue ? <div className="recurring-active-filters"><div><span className="recurring-active-filters-title">Filtri attivi</span><div className="recurring-active-filter-tags"><span className="badge"><strong>Cliente:</strong> {customerQuickValue}</span></div></div><Link className="btn btn-xs btn-neutral recurring-active-filters-reset" href={`/months/${year}/${month}?mode=${mode}${periodQuery}&returnTo=${encodeURIComponent(backHref)}${supplierQuickValue ? `&supplierQuick=${encodeURIComponent(supplierQuickValue)}` : ''}`}>× Reset</Link></div> : null}
            <div className="--card record-list-card"><IncomesList
                timeZone={current.company.timeZone}
                incomes={listedIncomes}
                cashRegisterGroups={cashRegisterGroups}
                returnTo={returnTo}
                banks={orderedBanks.map(bank => ({id: bank.id, name: bank.name, icon: bank.icon, isFallback: bank.isFallback, isPrimary: bank.id === current.company.primaryBankId}))}
                paymentMethods={incomePaymentMethods.map(method => ({id: method.id, name: method.name, icon: method.icon, kind: method.kind, isFallback: method.isFallback}))}
                salesChannels={salesChannels}
                customers={customers}
            /></div>
        </details>
        </div>
    </div>;
}
