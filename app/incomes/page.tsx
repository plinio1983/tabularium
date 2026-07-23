import Link from 'next/link';
import BulkSelectionController from '@/components/BulkSelectionController';
import {prisma} from '@/lib/prisma';
import {euro, moneyTone} from '@/lib/money';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import IncomeFiltersDrawer from '@/components/IncomeFiltersDrawer';
import IncomeTrendSelectors from '@/components/IncomeTrendSelectors';
import MobileSortControl from '@/components/MobileSortControl';
import IncomesList from '@/components/IncomesList';
import {badgeClass, fiscalStyles, incomeCreditStatusStyles} from '@/lib/income-ui';
import {requireWorkspace} from '@/lib/auth';
import {orderBanks, orderPaymentMethods} from '@/lib/workspace-defaults';
import {stripFlashRecord, stripFlashSearchParams} from '@/lib/flash';
import {compareDate, compareNumber, compareText} from '@/lib/mobile-sort';
import SearchIcon from '@/components/SearchIcon';

const invoiceStatusOptions = [
    ['NON_INVIATA', 'Non inviata'],
    ['EMESSA', 'Emessa'],
    ['not_emitted', 'Non emesse']
];

const incomeMobileSortOptions = [
    {value: 'creditDate_desc', label: 'Data accredito recente'},
    {value: 'creditDate_asc', label: 'Data accredito meno recente'},
    {value: 'billingPeriod_desc', label: 'Periodo fatt. recente'},
    {value: 'billingPeriod_asc', label: 'Periodo fatt. meno recente'},
    {value: 'salesChannel_asc', label: 'Canale vendita (A-Z)'},
    {value: 'salesChannel_desc', label: 'Canale vendita (Z-A)'},
    {value: 'saleCategory_asc', label: 'Categoria vendita (A-Z)'},
    {value: 'saleCategory_desc', label: 'Categoria vendita (Z-A)'},
    {value: 'description_asc', label: 'Descrizione (A-Z)'},
    {value: 'description_desc', label: 'Descrizione (Z-A)'},
    {value: 'notes_asc', label: 'Note (A-Z)'},
    {value: 'amount_desc', label: 'Importo alto'},
    {value: 'amount_asc', label: 'Importo basso'},
    {value: 'paymentMethod_asc', label: 'Metodo pagamento (A-Z)'},
    {value: 'creditChannel_asc', label: 'Canale accredito (A-Z)'},
    {value: 'fiscal_desc', label: 'Fiscali prima'},
    {value: 'invoiceStatus_asc', label: 'Stato fattura (A-Z)'},
    {value: 'credited_desc', label: 'Accreditati prima'},
    {value: 'vatRate_desc', label: 'IVA alta'},
    // { value: 'createdAt_desc', label: 'Creazione recente' },
    // { value: 'updatedAt_desc', label: 'Aggiornamento recente' },
    // { value: 'id_desc', label: 'ID decrescente' },
    // { value: 'id_asc', label: 'ID crescente' }
];

function dateLabel(value?: Date | null) {
    return value
        ? new Intl.DateTimeFormat('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(value)
        : '-';
}

function mobileDateLabel(value?: Date | null) {
    return value
        ? new Intl.DateTimeFormat('it-IT', {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC'
        }).format(value).replace('.', '')
        : '-';
}

function dateSortValue(value?: Date | null) {
    return value ? String(new Date(value).getTime()) : '';
}

function formatDateInputLabel(value: string) {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
}

function reportMonthFromRange(monthFrom: string, monthTo: string, dateFrom: string, dateTo: string) {
    if (monthFrom && monthFrom === monthTo) {
        const [year, month] = monthFrom.split('-').map(Number);
        if (year && month >= 1 && month <= 12) return {year, month};
    }
    if (dateFrom && dateTo) {
        const [fromYear, fromMonth] = dateFrom.split('-').map(Number);
        const [toYear, toMonth] = dateTo.split('-').map(Number);
        if (fromYear === toYear && fromMonth === toMonth && fromYear && fromMonth >= 1 && fromMonth <= 12) {
            return {year: fromYear, month: fromMonth};
        }
    }
    return null;
}

function formatDateTextInputLabel(value: string) {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return value;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const label = new Intl.DateTimeFormat('it-IT', {day: 'numeric', month: 'long', year: 'numeric'}).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatMonthInputLabel(value: string) {
    if (!value) return '';
    const [year, month] = value.split('-');
    if (!year || !month) return value;
    const date = new Date(Number(year), Number(month) - 1, 1);
    const monthName = new Intl.DateTimeFormat('it-IT', {month: 'long'}).format(date);
    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

function periodTotalsLabel({
                               useFiscalPeriodFilter,
                               billingPeriodFromFilter,
                               billingPeriodToFilter,
                               creditDateFromDefault,
                               creditDateToDefault,
                           }: {
    useFiscalPeriodFilter: boolean;
    billingPeriodFromFilter: string;
    billingPeriodToFilter: string;
    creditDateFromDefault: string;
    creditDateToDefault: string;
}) {
    if (useFiscalPeriodFilter) {
        if (billingPeriodFromFilter && billingPeriodToFilter && billingPeriodFromFilter !== billingPeriodToFilter) {
            return `Totali periodo fiscale dal ${formatMonthInputLabel(billingPeriodFromFilter)} al ${formatMonthInputLabel(billingPeriodToFilter)}`;
        }
        const value = billingPeriodFromFilter || billingPeriodToFilter;
        return value ? `Totali periodo fiscale ${formatMonthInputLabel(value)}` : 'Totali periodo fiscale selezionato';
    }

    if (creditDateFromDefault && creditDateToDefault && creditDateFromDefault !== creditDateToDefault) {
        return `Andamento complessivo\n dal ${formatDateTextInputLabel(creditDateFromDefault)} al ${formatDateTextInputLabel(creditDateToDefault)}`;
    }
    const value = creditDateFromDefault || creditDateToDefault;
    return value ? `Andamento complessivo ${formatDateTextInputLabel(value)}` : 'Totali andamento date selezionate';
}

function inputDefault(searchParams: Record<string, string | string[] | undefined>, key: string) {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function normalize(value: unknown) {
    return String(value ?? '').trim().toLowerCase();
}

type AmountFilter =
    | { mode: 'exact'; value: number }
    | { mode: 'gte'; value: number }
    | { mode: 'lte'; value: number }
    | { mode: 'gt'; value: number }
    | { mode: 'lt'; value: number }
    | { mode: 'range'; min: number; max: number };

function parseLocaleNumber(value: string) {
    const raw = String(value ?? '').trim().replace(/€/g, '').replace(/\s/g, '');
    if (!raw) return null;
    let normalized = raw;
    if (raw.includes(',') && raw.includes('.')) {
        normalized = raw.lastIndexOf(',') > raw.lastIndexOf('.')
            ? raw.replace(/\./g, '').replace(',', '.')
            : raw.replace(/,/g, '');
    } else if (raw.includes(',')) {
        normalized = raw.replace(/\./g, '').replace(',', '.');
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseAmountFilter(value: string): AmountFilter | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;

    const rangeMatch = raw.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (rangeMatch) {
        const min = parseLocaleNumber(rangeMatch[1]);
        const max = parseLocaleNumber(rangeMatch[2]);
        if (min !== null && max !== null) return {mode: 'range', min: Math.min(min, max), max: Math.max(min, max)};
    }

    const operatorMatch = raw.match(/^(>=|<=|>|<)\s*(.+)$/);
    if (operatorMatch) {
        const value = parseLocaleNumber(operatorMatch[2]);
        if (value !== null) {
            const operator = operatorMatch[1];
            if (operator === '>=') return {mode: 'gte', value};
            if (operator === '<=') return {mode: 'lte', value};
            if (operator === '>') return {mode: 'gt', value};
            if (operator === '<') return {mode: 'lt', value};
        }
    }

    const parsed = parseLocaleNumber(raw);
    return parsed === null ? null : {mode: 'exact', value: parsed};
}

function amountMatchesFilter(amount: number, filterValue: AmountFilter | null) {
    if (filterValue === null) return true;
    const cents = Math.round(amount * 100);
    if (filterValue.mode === 'exact') return cents === Math.round(filterValue.value * 100);
    if (filterValue.mode === 'gte') return amount >= filterValue.value;
    if (filterValue.mode === 'lte') return amount <= filterValue.value;
    if (filterValue.mode === 'gt') return amount > filterValue.value;
    if (filterValue.mode === 'lt') return amount < filterValue.value;
    return amount >= filterValue.min && amount <= filterValue.max;
}

function toDateInputValue(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currentMonthQuickValue() {
    const now = new Date();
    return `month_${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fiscalQuarterRange(year: number, quarterIndex: number) {
    const startMonth = quarterIndex * 3;
    return {
        from: toDateInputValue(new Date(year, startMonth, 1)),
        to: toDateInputValue(new Date(year, startMonth + 3, 0))
    };
}

function getQuickDateRange(value: string, selectedYear?: string) {
    const now = new Date();
    const parsedYear = Number(selectedYear);
    const year = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : now.getFullYear();
    const month = now.getMonth();
    const currentQuarter = Math.floor(month / 3);
    const monthMatch = String(value).match(/^month_(\d{2})$/);
    const quarterMatch = String(value).match(/^quarter_(\d)$/);

    if (monthMatch) {
        const selectedMonth = Number(monthMatch[1]) - 1;
        return {
            from: toDateInputValue(new Date(year, selectedMonth, 1)),
            to: toDateInputValue(new Date(year, selectedMonth + 1, 0))
        };
    }
    if (quarterMatch) return fiscalQuarterRange(year, Number(quarterMatch[1]) - 1);
    if (value === 'previous_month') return {
        from: toDateInputValue(new Date(year, month - 1, 1)),
        to: toDateInputValue(new Date(year, month, 0))
    };
    if (value === 'two_months_ago') return {
        from: toDateInputValue(new Date(year, month - 2, 1)),
        to: toDateInputValue(new Date(year, month - 1, 0))
    };
    if (value === 'current_quarter') return fiscalQuarterRange(year, currentQuarter);
    if (value === 'last_quarter') return currentQuarter > 0 ? fiscalQuarterRange(year, currentQuarter - 1) : fiscalQuarterRange(year - 1, 3);
    if (value === 'previous_quarter') return currentQuarter > 0 ? fiscalQuarterRange(year, currentQuarter - 1) : fiscalQuarterRange(year - 1, 3);
    if (value === 'year_to_date') {
        return {
            from: toDateInputValue(new Date(year, 0, 1)),
            to: toDateInputValue(new Date(year, 11, 31))
        };
    }
    return {from: toDateInputValue(new Date(year, month, 1)), to: toDateInputValue(new Date(year, month + 1, 0))};
}

const monthQuickOptions = [
    ['month_01', 'Gennaio'],
    ['month_02', 'Febbraio'],
    ['month_03', 'Marzo'],
    ['month_04', 'Aprile'],
    ['month_05', 'Maggio'],
    ['month_06', 'Giugno'],
    ['month_07', 'Luglio'],
    ['month_08', 'Agosto'],
    ['month_09', 'Settembre'],
    ['month_10', 'Ottobre'],
    ['month_11', 'Novembre'],
    ['month_12', 'Dicembre']
];

const quarterQuickOptions = [
    ['quarter_1', 'T.1 [ Gen - Mar ]'],
    ['quarter_2', 'T.2 [ Apr - Giu ]'],
    ['quarter_3', 'T.3 [ Lug - Set ]'],
    ['quarter_4', 'T.4 [ Ott - Dic ]']
];

const quickDateOptions = [
    ['year_to_date', 'Anno intero'],
    ...monthQuickOptions,
    ...quarterQuickOptions
];

function toMonthInputValue(year: number, monthIndexZeroBased: number) {
    const date = new Date(year, monthIndexZeroBased, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getQuickBillingPeriodRange(value: string, selectedYear?: string) {
    const now = new Date();
    const parsedYear = Number(selectedYear);
    const year = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : now.getFullYear();
    const month = now.getMonth();
    const currentQuarter = Math.floor(month / 3);
    const monthMatch = String(value).match(/^month_(\d{2})$/);
    const quarterMatch = String(value).match(/^quarter_(\d)$/);

    if (monthMatch) {
        const selectedMonth = Number(monthMatch[1]) - 1;
        return {from: toMonthInputValue(year, selectedMonth), to: toMonthInputValue(year, selectedMonth)};
    }
    if (quarterMatch) {
        const quarter = Number(quarterMatch[1]) - 1;
        return {from: toMonthInputValue(year, quarter * 3), to: toMonthInputValue(year, quarter * 3 + 2)};
    }
    if (value === 'previous_month') return {
        from: toMonthInputValue(year, month - 1),
        to: toMonthInputValue(year, month - 1)
    };
    if (value === 'current_quarter') return {
        from: toMonthInputValue(year, currentQuarter * 3),
        to: toMonthInputValue(year, currentQuarter * 3 + 2)
    };
    if (value === 'previous_quarter') {
        const quarter = currentQuarter - 1;
        return quarter >= 0
            ? {from: toMonthInputValue(year, quarter * 3), to: toMonthInputValue(year, quarter * 3 + 2)}
            : {from: toMonthInputValue(year - 1, 9), to: toMonthInputValue(year - 1, 11)};
    }
    if (value === 'year_to_date') {
        return {
            from: toMonthInputValue(year, 0),
            to: toMonthInputValue(year, 11)
        };
    }
    return {from: toMonthInputValue(year, month), to: toMonthInputValue(year, month)};
}

const quickBillingPeriodOptions = [
    ['year_to_date', 'Anno intero'],
    ...monthQuickOptions,
    ...quarterQuickOptions
];


function vatAmountFromGross(amount: number, vatRate: number) {
    if (!vatRate) return 0;
    return amount * (vatRate / (100 + vatRate));
}

function formatPeriod(month: number, year: number) {
    const monthName = new Intl.DateTimeFormat('it-IT', {month: 'short'}).format(new Date(year, month - 1, 1));
    const normalized = monthName.charAt(0).toUpperCase() + monthName.slice(1).replace('.', '');
    return `${normalized} ${year}`;
}

function periodInputValue(month: number, year: number) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

function monthInputToKey(value: string) {
    const match = String(value ?? '').trim().match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!year || month < 1 || month > 12) return null;
    return year * 12 + month;
}

function normalizePeriodRange(fromKey: number | null, toKey: number | null) {
    if (fromKey !== null && toKey !== null && fromKey > toKey) {
        return {fromKey: toKey, toKey: fromKey};
    }
    return {fromKey, toKey};
}

function recordPeriodKey(month: number, year: number) {
    return Number(year) * 12 + Number(month);
}

function matchesBillingPeriod(month: number, year: number, fromKey: number | null, toKey: number | null) {
    const key = recordPeriodKey(month, year);
    if (fromKey !== null && key < fromKey) return false;
    if (toKey !== null && key > toKey) return false;
    return true;
}

function matchesIsoDate(value: Date | null | undefined, from: string, to: string) {
    const formatted = value ? localDateKey(value) : '';
    if (from && (!formatted || formatted < from)) return false;
    if (to && (!formatted || formatted > to)) return false;
    return true;
}

function localDateKey(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function isIncomeCreditOverdue(income: { isCredited: boolean; creditDate: Date | null }) {
    return !income.isCredited && Boolean(income.creditDate) && localDateKey(income.creditDate!) < localDateKey(new Date());
}

function incomeCreditStatus(income: { isCredited: boolean; creditDate: Date | null }) {
    if (income.isCredited) return incomeCreditStatusStyles.ACCREDITATO;
    return isIncomeCreditOverdue(income) ? incomeCreditStatusStyles.SCADUTO : incomeCreditStatusStyles.DA_ACCREDITARE;
}

function fiscalBadge(value: boolean) {
    const item = value ? fiscalStyles.yes : fiscalStyles.no;
    const label = value ? '✓ DF' : '✕ NF';
    return <span className={`${badgeClass(item.className)} income-badge-compact`}>{label}</span>;
}

function ActiveFilterSummary({items}: { items: Array<{ label: string; value: string }> }) {
    return <div className="active-filter-summary">
        <span className="active-filter-summary-title">Filtri attivi:</span>
        {items.length ? items.map(item =>
                <span className="active-filter-chip" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>) :
            <span className="active-filter-empty">nessun filtro impostato</span>}
        <Link className="btn btn-md btn-default reset-btn" href="/incomes"><span className="btn-icon">↺</span> Reset</Link>
    </div>;
}

function optionLabel(options: Array<string[]>, value: string) {
    return options.find(option => option[0] === value)?.[1] ?? value;
}


function IncomeBreakdownChart({title, description, data}: {
    title: string;
    description: string;
    data: Array<{ name: string; code: string; total: number }>
}) {
    const max = Math.max(...data.map(item => item.total), 0);
    const total = data.reduce((sum, item) => sum + item.total, 0);

    return <div className="card expense-category-chart-card embedded-chart-card income-chart">
        <div className="card-heading-row">
            <div>
                <h2>{title}</h2>
                <p className="muted">{description}</p>
            </div>
            <span className="badge">Totale {euro(total)}</span>
        </div>
        {data.length ? <div className="category-chart-list">
            {data.map(item => {
                const percentage = total ? (item.total / total) * 100 : 0;
                const width = max ? Math.max((item.total / max) * 100, 4) : 0;
                return <div className="category-chart-row" key={`${item.code}-${item.name}`}>
                    <div className="category-chart-label">
                        <strong>{item.code}</strong>
                        <span>{item.name}</span>
                        {/*<div className="category-chart-value">*/}
                        {/*  <span className={moneyTone(item.total)}>{euro(item.total)}</span>*/}
                        {/*  <small>{percentage.toFixed(1)}%</small>*/}
                        {/*</div>*/}
                    </div>
                    <div className="category-chart-bar-wrap" aria-label={`${item.name}: ${euro(item.total)}`}>
                        <div className="category-chart-bar" style={{width: `${width}%`}}/>
                    </div>
                    <div className="category-chart-value">
                        <strong className={moneyTone(item.total)}>{euro(item.total)}</strong><small>{percentage.toFixed(1)}%</small>
                    </div>
                </div>;
            })}
        </div> : <p className="muted">Nessun incasso presente nei risultati filtrati.</p>}
    </div>;
}

const incomePieChartColors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0f766e', '#db2777', '#64748b'];

function IncomePieBreakdownChart({title, data}: {
    title: string;
    data: Array<{ name: string; code: string; total: number }>
}) {
    const total = data.reduce((sum, item) => sum + item.total, 0);
    let cursor = 0;
    const segments = data.map((item, index) => {
        const start = total ? (cursor / total) * 100 : 0;
        cursor += item.total;
        const end = total ? (cursor / total) * 100 : 0;
        return `${incomePieChartColors[index % incomePieChartColors.length]} ${start.toFixed(3)}% ${end.toFixed(3)}%`;
    });
    const background = segments.length ? `conic-gradient(${segments.join(', ')})` : undefined;

    return <section className="expense-category-chart-card expense-impact-pie-card expense-page-category-pie-chart income-chart">
        <div className="card-heading-row">
            <div>
                <h2>{title}</h2>
            </div>
            {/*<div className="text-right chart-total"><span className="badge">Totale {euro(total)}</span></div>*/}
        </div>
        {data.length && total > 0 ? <div className="expense-impact-pie-layout">
            <div className="expense-impact-pie" style={{background}} aria-label={title}>
                <div>
                    <span>Incassi</span>
                    <strong className="main-label">{euro(total)}</strong>
                </div>
            </div>
            <div className="expense-impact-pie-legend">
                {data.map((item, index) => {
                    const percentage = total ? (item.total / total) * 100 : 0;
                    return <div className="expense-impact-pie-row-wrap" key={`${item.code}-${item.name}`}>
                        <div className="expense-impact-pie-legend-row">
                            <span className="expense-impact-pie-dot" style={{background: incomePieChartColors[index % incomePieChartColors.length]}}/>
                            <div><strong>{item.code}</strong><span>{item.name}</span></div>
                            <div>
                                <strong className={moneyTone(item.total)}>{euro(item.total)}</strong><small>{percentage.toFixed(1)}%</small>
                            </div>
                        </div>
                        <div className="expense-impact-pie-bar" style={{
                            width: `${percentage.toFixed(1)}%`,
                            background: incomePieChartColors[index % incomePieChartColors.length]
                        }}/>
                    </div>;
                })}
            </div>
        </div> : <p className="muted">Nessun incasso presente nei risultati filtrati.</p>}
    </section>;
}

function IncomeVerticalBarChart({title, description, data}: {
    title: string;
    description: string;
    data: Array<{ name: string; code: string; total: number }>
}) {
    const max = Math.max(...data.map(item => item.total), 0);
    const total = data.reduce((sum, item) => sum + item.total, 0);

    return <div className="income-sales-channel-chart" aria-label={title}>
        <div className="card-heading-row">
            <div>
                <h2>{title}</h2>
                <p className="muted">{description}</p>
            </div>
            <span className="badge">Totale {euro(total)}</span>
        </div>
        {data.length ? <div className="income-vertical-chart" role="list">
            {data.map(item => {
                const percentage = total ? (item.total / total) * 100 : 0;
                const height = max ? Math.max((item.total / max) * 100, 6) : 0;
                return <div className="income-vertical-chart-item" key={`${item.code}-${item.name}`} role="listitem">
                    <div className="income-vertical-chart-value">
                        <strong className={moneyTone(item.total)}>{euro(item.total)}</strong>
                        <small>{percentage.toFixed(1)}%</small>
                    </div>
                    <div className="income-vertical-chart-bar-wrap" aria-label={`${item.name}: ${euro(item.total)}`}>
                        <div className="income-vertical-chart-bar" style={{height: `${height}%`}}/>
                    </div>
                    <div className="income-vertical-chart-label" title={item.name}>
                        <strong>{item.code}</strong>
                        <span>{item.name}</span>
                    </div>
                </div>;
            })}
        </div> : <p className="muted">Nessun incasso presente nei risultati filtrati.</p>}
    </div>;
}

export default async function IncomesPage({searchParams}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspace('/incomes');
    const rawFilters = (await searchParams) ?? {};
    const filters = stripFlashRecord(rawFilters);
    const currentQuery = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) value.forEach(item => item && currentQuery.append(key, item));
        else if (value) currentQuery.set(key, value);
    });
    stripFlashSearchParams(currentQuery);
    const currentQueryString = currentQuery.toString();
    const listHref = `/incomes${currentQueryString ? `?${currentQueryString}` : ''}`;
    const returnTo = encodeURIComponent(listHref);
    const hasAnyFilter = Object.keys(filters).length > 0;
    const hasFiscalPeriodFilter = Boolean(inputDefault(filters, 'billingPeriodFrom') || inputDefault(filters, 'billingPeriodTo') || inputDefault(filters, 'billingPeriod') || inputDefault(filters, 'billingPeriodQuick'));
    const hasCreditDateFilter = Boolean(inputDefault(filters, 'creditDateFrom') || inputDefault(filters, 'creditDateTo') || inputDefault(filters, 'dateQuick'));
    const dateYearFilter = inputDefault(filters, 'dateYear');
    const billingPeriodYearFilter = inputDefault(filters, 'billingPeriodYear');
    const useFiscalPeriodFilter = hasFiscalPeriodFilter;
    const useCreditDateFilter = !useFiscalPeriodFilter;
    const rawDateQuickFilter = useCreditDateFilter ? inputDefault(filters, 'dateQuick') : '';
    const hasCustomCreditDateFilter = useCreditDateFilter && !rawDateQuickFilter && Boolean(inputDefault(filters, 'creditDateFrom') || inputDefault(filters, 'creditDateTo'));
    const quickDateFilter = useCreditDateFilter ? (rawDateQuickFilter || (!hasAnyFilter && !hasCreditDateFilter ? currentMonthQuickValue() : '')) : '';
    const dateQuickSelectorValue = hasCustomCreditDateFilter ? 'custom' : quickDateFilter;
    const quickDateRange = quickDateFilter ? getQuickDateRange(quickDateFilter, dateYearFilter) : null;
    const creditDateFromDefault = useCreditDateFilter ? (quickDateRange?.from || inputDefault(filters, 'creditDateFrom')) : '';
    const creditDateToDefault = useCreditDateFilter ? (quickDateRange?.to || inputDefault(filters, 'creditDateTo')) : '';
    const quickBillingPeriodFilter = useFiscalPeriodFilter ? (inputDefault(filters, 'billingPeriodQuick') || '') : '';
    const quickBillingPeriodRange = quickBillingPeriodFilter ? getQuickBillingPeriodRange(quickBillingPeriodFilter, billingPeriodYearFilter) : null;

    const [incomes, expensesForVat, banks, paymentMethods, incomeCategories, salesChannels, customers] = await Promise.all([
        prisma.income.findMany({
            where: {workspaceId: current.workspace.id},
            include: {
                paymentMethodRef: true,
                creditBank: true,
                incomeCategory: true,
                salesChannelRef: true,
                customer: true
            },
            orderBy: [{creditDate: 'desc'}, {id: 'desc'}],
            take: 500
        }),
        prisma.expense.findMany({where: {workspaceId: current.workspace.id}, include: {payments: true}, take: 5000}),
        prisma.bank.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.paymentMethod.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.incomeCategory.findMany({where: {workspaceId: current.workspace.id}, orderBy: {name: 'asc'}}),
        prisma.incomeSalesChannel.findMany({where: {workspaceId: current.workspace.id}, orderBy: {name: 'asc'}}),
        prisma.customer.findMany({where: {workspaceId: current.workspace.id}, orderBy: {businessName: 'asc'}})
    ]);
    const orderedBanks = orderBanks(banks);
    const incomePaymentMethods = orderPaymentMethods(paymentMethods, 'INCOME');

    const creditDateFromFilter = useCreditDateFilter ? creditDateFromDefault : '';
    const creditDateToFilter = useCreditDateFilter ? creditDateToDefault : '';
    const billingPeriodFromFilter = useFiscalPeriodFilter ? (quickBillingPeriodRange?.from || inputDefault(filters, 'billingPeriodFrom') || inputDefault(filters, 'billingPeriod')) : '';
    const billingPeriodToFilter = useFiscalPeriodFilter ? (quickBillingPeriodRange?.to || inputDefault(filters, 'billingPeriodTo') || inputDefault(filters, 'billingPeriod')) : '';
    const rawBillingPeriodFromKey = monthInputToKey(billingPeriodFromFilter);
    const rawBillingPeriodToKey = monthInputToKey(billingPeriodToFilter);
    const {
        fromKey: billingPeriodFromKey,
        toKey: billingPeriodToKey
    } = normalizePeriodRange(rawBillingPeriodFromKey, rawBillingPeriodToKey);
    const hasBillingPeriodRange = billingPeriodFromKey !== null || billingPeriodToKey !== null;
    const salesChannelFilter = inputDefault(filters, 'salesChannel');
    const saleCategoryFilter = inputDefault(filters, 'saleCategory');
    const amountFilterRaw = inputDefault(filters, 'amount');
    const amountFilterValue = parseAmountFilter(amountFilterRaw);
    const paymentMethodFilter = inputDefault(filters, 'paymentMethod');
    const creditChannelFilter = inputDefault(filters, 'creditChannel');
    const customerQuickFilter = normalize(inputDefault(filters, 'customerQuick'));
    const fiscalFilter = inputDefault(filters, 'fiscal');
    const invoiceStatusFilter = inputDefault(filters, 'invoiceStatus');
    const invoiceStatusModeFilter = inputDefault(filters, 'invoiceStatusMode');
    const vatRateFilter = inputDefault(filters, 'vatRate');
    const totalsFilterHref = (extraFilters: Record<string, string>) => {
        const query = new URLSearchParams();
        if (useFiscalPeriodFilter) {
            if (billingPeriodFromFilter) query.set('billingPeriodFrom', billingPeriodFromFilter);
            if (billingPeriodToFilter) query.set('billingPeriodTo', billingPeriodToFilter);
        } else {
            if (creditDateFromDefault) query.set('creditDateFrom', creditDateFromDefault);
            if (creditDateToDefault) query.set('creditDateTo', creditDateToDefault);
        }
        Object.entries(extraFilters).forEach(([key, value]) => {
            if (value) query.set(key, value);
        });
        const queryString = query.toString();
        return `/incomes${queryString ? `?${queryString}` : ''}`;
    };
    const fiscalTotalsHref = totalsFilterHref({fiscal: 'yes'});
    const nonFiscalTotalsHref = totalsFilterHref({fiscal: 'no'});
    const invoicesNotSentHref = totalsFilterHref({invoiceStatus: 'NON_INVIATA'});
    const reportMonth = reportMonthFromRange(
        billingPeriodFromFilter,
        billingPeriodToFilter,
        creditDateFromDefault,
        creditDateToDefault
    );
    const monthlyReportHref = reportMonth
        ? `/months/${reportMonth.year}/${reportMonth.month}?returnTo=${encodeURIComponent(listHref)}`
        : null;

    const periodIncomes = incomes.filter(income => {
        if (!matchesIsoDate(income.creditDate, creditDateFromFilter, creditDateToFilter)) return false;
        if (!matchesBillingPeriod(income.billingMonth, income.billingYear, billingPeriodFromKey, billingPeriodToKey)) return false;
        return true;
    });

    const filteredIncomes = periodIncomes.filter(income => {
        if (!matchesIsoDate(income.creditDate, creditDateFromFilter, creditDateToFilter)) return false;
        if (!matchesBillingPeriod(income.billingMonth, income.billingYear, billingPeriodFromKey, billingPeriodToKey)) return false;
        if (salesChannelFilter && income.salesChannelRef.name !== salesChannelFilter) return false;
        if (saleCategoryFilter && income.incomeCategory.name !== saleCategoryFilter) return false;
        if (!amountMatchesFilter(Number(income.amount.toString()), amountFilterValue)) return false;
        if (paymentMethodFilter && income.paymentMethodRef.name !== paymentMethodFilter) return false;
        if (creditChannelFilter && income.creditBank.name !== creditChannelFilter) return false;
        if (customerQuickFilter && !normalize(income.customer?.businessName).includes(customerQuickFilter)) return false;
        if (fiscalFilter === 'yes' && !income.isFiscal) return false;
        if (fiscalFilter === 'no' && income.isFiscal) return false;
        if (invoiceStatusModeFilter === 'not_emitted' && income.invoiceStatus === 'EMESSA') return false;
        if (invoiceStatusFilter === 'not_emitted' && income.invoiceStatus === 'EMESSA') return false;
        if (invoiceStatusFilter && invoiceStatusFilter !== 'not_emitted' && income.invoiceStatus !== invoiceStatusFilter) return false;
        if (vatRateFilter && Number(income.vatRate.toString()) !== Number(vatRateFilter)) return false;
        return true;
    });

    const summarizeIncomes = (list: typeof incomes) => list.reduce((acc, income) => {
        const amount = Number(income.amount.toString());
        const vatRate = Number(income.vatRate.toString());
        const vatDebt = income.isFiscal ? vatAmountFromGross(amount, vatRate) : 0;
        acc.total += amount;
        acc.vatDebt += vatDebt;
        if (income.isFiscal) {
            acc.fiscal += amount;
            acc.taxable += amount - vatDebt;
            if (income.invoiceStatus !== 'EMESSA') acc.invoicesNotSent += 1;
        } else acc.nonFiscal += amount;
        return acc;
    }, {total: 0, fiscal: 0, nonFiscal: 0, taxable: 0, vatDebt: 0, invoicesNotSent: 0});

    const totals = summarizeIncomes(filteredIncomes);
    const totalsPeriodLabel = periodTotalsLabel({
        useFiscalPeriodFilter,
        billingPeriodFromFilter,
        billingPeriodToFilter,
        creditDateFromDefault,
        creditDateToDefault
    });
    const flashMessages = {
        savedMessages: {
            created: 'Incasso creato.',
            updated: 'Incasso aggiornato.',
            deleted: 'Incasso rimosso.',
            bulk_updated: 'Incassi aggiornati.',
            bulk_deleted: 'Incassi rimossi.'
        },
        errorMessages: {
            invalid: 'Controlla i campi dell’incasso.',
            not_found: 'Incasso non trovato.',
            in_use: 'L’incasso è collegato ad altri movimenti.'
        }
    };

    const incomesBySaleCategoryAndChannel = Array.from(filteredIncomes.reduce((map, income) => {
        const saleCategory = income.incomeCategory.name;
        const salesChannel = income.salesChannelRef.name;
        const name = `${saleCategory} / ${salesChannel}`;
        const code = `${String(saleCategory).split(/\s+/).map(part => part[0]).join('')}${String(salesChannel).split(/\s+/).map(part => part[0]).join('')}`.slice(0, 6).toUpperCase() || 'CATCAN';
        const key = `${saleCategory}-${salesChannel}`;
        const current = map.get(key) ?? {name, code, total: 0};
        current.total += Number(income.amount.toString());
        map.set(key, current);
        return map;
    }, new Map<string, { name: string; code: string; total: number }>()).values()).sort((a, b) => b.total - a.total);

    const incomesByFiscalStatus = Array.from(filteredIncomes.reduce((map, income) => {
        const name = income.isFiscal ? 'Dichiarato' : 'Non dichiarato';
        const code = income.isFiscal ? 'FISC' : 'NFISC';
        const key = `${code}-${name}`;
        const current = map.get(key) ?? {name, code, total: 0};
        current.total += Number(income.amount.toString());
        map.set(key, current);
        return map;
    }, new Map<string, { name: string; code: string; total: number }>()).values()).sort((a, b) => b.total - a.total);

    let recoverableExpenseVat: number | null = null;
    if (hasBillingPeriodRange) {
        recoverableExpenseVat = expensesForVat.reduce((sum, expense) => {
            if (!matchesBillingPeriod(expense.month, expense.year, billingPeriodFromKey, billingPeriodToKey)) return sum;
            const amount = Number(expense.amount.toString());
            const paid = Math.min(amount, expense.payments.reduce((partial, payment) => partial + Number(payment.amount.toString()), 0));
            if (expense.expenseType === 'VAT_SETTLEMENT') return sum + paid;
            if (!expense.isDeclared) return sum;
            const vatRate = Number(expense.vatRate.toString());
            return sum + vatAmountFromGross(paid, vatRate);
        }, 0);
    }
    const residualVatDebt = recoverableExpenseVat === null ? null : totals.vatDebt - recoverableExpenseVat;

    const activeFilterItems = [
        creditDateFromDefault && {label: 'Data accredito da', value: formatDateInputLabel(creditDateFromDefault)},
        creditDateToDefault && {label: 'Data accredito a', value: formatDateInputLabel(creditDateToDefault)},
        billingPeriodFromFilter && {label: 'Periodo fatt. da', value: billingPeriodFromFilter},
        billingPeriodToFilter && {label: 'Periodo fatt. a', value: billingPeriodToFilter},
        salesChannelFilter && {label: 'Canale vendita', value: salesChannelFilter},
        saleCategoryFilter && {label: 'Categoria vendita', value: saleCategoryFilter},
        amountFilterRaw && {label: 'Importo', value: amountFilterRaw},
        paymentMethodFilter && {label: 'Metodo pagamento', value: paymentMethodFilter},
        creditChannelFilter && {label: 'Canale accredito', value: creditChannelFilter},
        customerQuickFilter && {label: 'Cliente', value: inputDefault(filters, 'customerQuick')},
        fiscalFilter && {label: 'Fiscale', value: fiscalFilter === 'yes' ? 'Si' : 'No'},
        (invoiceStatusFilter || invoiceStatusModeFilter) && {
            label: 'Stato fattura',
            value: optionLabel(invoiceStatusOptions, invoiceStatusFilter || invoiceStatusModeFilter)
        },
        vatRateFilter && {label: 'IVA', value: `${vatRateFilter}%`}
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    const mobileSort = inputDefault(filters, 'mobileSort') || incomeMobileSortOptions[0].value;
    const mobileSortedIncomes = [...filteredIncomes].sort((a, b) => {
        const billingA = ((a.billingYear ?? 0) * 100) + (a.billingMonth ?? 0);
        const billingB = ((b.billingYear ?? 0) * 100) + (b.billingMonth ?? 0);
        const paymentA = a.paymentMethodRef.name;
        const paymentB = b.paymentMethodRef.name;
        const creditA = a.creditBank.name;
        const creditB = b.creditBank.name;

        switch (mobileSort) {
            case 'creditDate_asc':
                return compareDate(a.creditDate, b.creditDate, 'asc');
            case 'billingPeriod_desc':
                return compareNumber(billingA, billingB, 'desc');
            case 'billingPeriod_asc':
                return compareNumber(billingA, billingB, 'asc');
            case 'salesChannel_asc':
                return compareText(a.salesChannelRef.name, b.salesChannelRef.name, 'asc');
            case 'salesChannel_desc':
                return compareText(a.salesChannelRef.name, b.salesChannelRef.name, 'desc');
            case 'saleCategory_asc':
                return compareText(a.incomeCategory.name, b.incomeCategory.name, 'asc');
            case 'saleCategory_desc':
                return compareText(a.incomeCategory.name, b.incomeCategory.name, 'desc');
            case 'description_asc':
                return compareText(a.description, b.description, 'asc');
            case 'description_desc':
                return compareText(a.description, b.description, 'desc');
            case 'notes_asc':
                return compareText(a.notes, b.notes, 'asc');
            case 'amount_desc':
                return compareNumber(a.amount, b.amount, 'desc');
            case 'amount_asc':
                return compareNumber(a.amount, b.amount, 'asc');
            case 'paymentMethod_asc':
                return compareText(paymentA, paymentB, 'asc');
            case 'creditChannel_asc':
                return compareText(creditA, creditB, 'asc');
            case 'fiscal_desc':
                return compareNumber(Number(a.isFiscal), Number(b.isFiscal), 'desc');
            case 'invoiceStatus_asc':
                return compareText(a.invoiceStatus, b.invoiceStatus, 'asc');
            case 'credited_desc':
                return compareNumber(Number(a.isCredited), Number(b.isCredited), 'desc');
            case 'vatRate_desc':
                return compareNumber(a.vatRate, b.vatRate, 'desc');
            case 'createdAt_desc':
                return compareDate(a.createdAt, b.createdAt, 'desc');
            case 'updatedAt_desc':
                return compareDate(a.updatedAt, b.updatedAt, 'desc');
            case 'id_desc':
                return compareNumber(a.id, b.id, 'desc');
            case 'id_asc':
                return compareNumber(a.id, b.id, 'asc');
            default:
                return compareDate(a.creditDate, b.creditDate, 'desc');
        }
    });

    return <div className="grid">
        <div className="toolbar-card">
            <div>
                <h2>Incassi</h2>
                <p className="muted">Gestione delle entrate fiscali e non fiscali.</p>
            </div>
            <button className="btn btn-md btn-primary income-add-btn" type="button" data-income-new>
                <span className="btn-icon">+</span>Inserisci incasso
            </button>
        </div>

        <ActionFeedbackBanner
            searchParams={rawFilters}
            savedMessages={flashMessages.savedMessages}
            errorMessages={flashMessages.errorMessages}
            defaultSavedMessage="Operazione completata."
            defaultErrorMessage="Impossibile completare l’operazione."
        />

        <div className="card expenses-list-card">
            <div className="filter-drawer-wrapper">
                <IncomeFiltersDrawer
                    filters={filters}
                    quickDateFilter={quickDateFilter}
                    creditDateFromDefault={creditDateFromDefault}
                    creditDateToDefault={creditDateToDefault}
                    quickBillingPeriodFilter={quickBillingPeriodFilter}
                    billingPeriodFromFilter={billingPeriodFromFilter}
                    billingPeriodToFilter={billingPeriodToFilter}
                    banks={orderedBanks.map(bank => ({id: bank.id, name: bank.name, icon: bank.icon}))}
                    paymentMethods={incomePaymentMethods.map(method => ({
                        id: method.id,
                        name: method.name,
                        icon: method.icon
                    }))}
                    incomeCategories={incomeCategories}
                    salesChannels={salesChannels}
                />
            </div>
            <IncomeTrendSelectors
                dateQuick={dateQuickSelectorValue}
                billingPeriodQuick={quickBillingPeriodFilter}
                dateYear={dateYearFilter}
                billingPeriodYear={billingPeriodYearFilter}
                useFiscalPeriodFilter={useFiscalPeriodFilter}
            />
            {/*<p className="totals-period-note">{totalsPeriodLabel}</p>*/}
            <div className="income-summary-row">
                <div className="dashboard-statement-panel list-totals-statement">
                    <h2>{totalsPeriodLabel}</h2>
                    <table className="dashboard-statement-table list-totals-table" aria-label="Totali incassi filtrati">
                        <tbody>
                        <tr>
                            <td>Entrate totali</td>
                            <td><strong className={badgeClass()}>{euro(totals.total)}</strong></td>
                        </tr>
                        <tr>
                            <td>Incasso fiscale</td>
                            <td>
                                <Link href={fiscalTotalsHref}><strong className={moneyTone(totals.fiscal)}>{euro(totals.fiscal)}</strong></Link>
                            </td>
                        </tr>
                        <tr>
                            <td>Imponibile</td>
                            <td><strong className={moneyTone(totals.taxable)}>{euro(totals.taxable)}</strong></td>
                        </tr>
                        <tr>
                            <td>Incasso non fiscale</td>
                            <td>
                                <Link href={nonFiscalTotalsHref}><strong className={moneyTone(totals.nonFiscal)}>{euro(totals.nonFiscal)}</strong></Link>
                            </td>
                        </tr>
                        <tr>
                            <td>Debito IVA prodotto</td>
                            <td><strong className={moneyTone(totals.vatDebt)}>{euro(totals.vatDebt)}</strong></td>
                        </tr>
                        {/*<tr><td>Debito IVA residuo</td><td><strong>{residualVatDebt === null ? <span className="total-placeholder">Seleziona periodo fiscale</span> : <span className={moneyTone(residualVatDebt)}>{euro(residualVatDebt)}</span>}</strong></td></tr>*/}
                        <tr>
                            <td>Fatture non inviate</td>
                            <td><Link href={invoicesNotSentHref}><strong>{totals.invoicesNotSent}</strong></Link></td>
                        </tr>
                        </tbody>
                    </table>
                    {monthlyReportHref ? <div className="dashboard-statement-actions">
                        <Link className="btn btn-sm btn-ghost" href={monthlyReportHref}>
              <span className="btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="16" rx="2"/>
                  <path d="M16 3v4M8 3v4M3 10h18"/>
                  <path d="M8 14h2M14 14h2M8 17h2M14 17h2"/>
                </svg>
              </span>
                            <span>Report mensile</span>
                        </Link>
                    </div> : null}
                </div>
                <IncomePieBreakdownChart title="Entrate per categoria / canale di vendita" data={incomesBySaleCategoryAndChannel}/>
            </div>
        </div>
        <div className="card expenses-list-card">
            <div className="list-heading recurring-list-heading">
                <div>
                    <h2>Lista incassi</h2>
                    <p className="muted">Risultati mostrati: {filteredIncomes.length}</p>
                </div>
                <div>
                    <IncomeFiltersDrawer
                        filters={filters}
                        quickDateFilter={quickDateFilter}
                        creditDateFromDefault={creditDateFromDefault}
                        creditDateToDefault={creditDateToDefault}
                        quickBillingPeriodFilter={quickBillingPeriodFilter}
                        billingPeriodFromFilter={billingPeriodFromFilter}
                        billingPeriodToFilter={billingPeriodToFilter}
                        banks={orderedBanks.map(bank => ({id: bank.id, name: bank.name, icon: bank.icon}))}
                        paymentMethods={incomePaymentMethods.map(method => ({
                            id: method.id,
                            name: method.name,
                            icon: method.icon
                        }))}
                        incomeCategories={incomeCategories}
                        salesChannels={salesChannels}/>
                </div>
            </div>
            <form className="supplier-quick-search" action="/incomes" method="get" role="search">
                <label htmlFor="incomeCustomerQuickSearch">Ricerca rapida</label>
                <div className="supplier-quick-search-field">
                    <input id="incomeCustomerQuickSearch" name="customerQuick" defaultValue={inputDefault(filters, 'customerQuick')} placeholder="Nome o ragione sociale" autoComplete="off"/>
                    <button className="btn btn-sm btn-primary" type="submit" aria-label="Cerca cliente"><SearchIcon/>
                    </button>
                </div>
            </form>

            {activeFilterItems.length ? <div className="recurring-active-filters">
                <div>
                    <span className="recurring-active-filters-title">Filtri attivi</span>
                    <div className="recurring-active-filter-tags">
                        {activeFilterItems.map(item =>
                            <span className="badge" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>)}
                    </div>
                </div>
                <Link className="btn btn-xs btn-neutral recurring-active-filters-reset" href="/incomes"><span className="btn-icon">×</span> Reset</Link>
            </div> : null}

            <BulkSelectionController/>

            <script dangerouslySetInnerHTML={{
                __html: `
                document.addEventListener('click', function(event) {
                  const row = event.target.closest && event.target.closest('[data-row-href]');
                  if (!row) return;
                  if (window.matchMedia && !window.matchMedia('(min-width: 761px)').matches) return;
                  if (event.target.closest('a, button, input, select, textarea, label, summary, details')) return;
                  const href = row.getAttribute('data-row-href');
                  if (href) window.location.href = href;
                });
                document.addEventListener('keydown', function(event) {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  const row = event.target && event.target.matches && event.target.matches('[data-row-href]') ? event.target : null;
                  if (!row) return;
                  if (window.matchMedia && !window.matchMedia('(min-width: 761px)').matches) return;
                  event.preventDefault();
                  const href = row.getAttribute('data-row-href');
                  if (href) window.location.href = href;
                });
                (() => {
                  const storageKey = 'dmsAccounting.incomes.filters';
                  const filterMaxAgeMs = 24 * 60 * 60 * 1000;
                  const resetLink = document.querySelector('a[href="/incomes"].reset-button');
                  const readStoredFilter = () => {
                    const raw = localStorage.getItem(storageKey);
                    if (!raw) return '';
                    try {
                      const parsed = JSON.parse(raw);
                      if (!parsed || typeof parsed.value !== 'string' || typeof parsed.savedAt !== 'number') {
                        localStorage.removeItem(storageKey);
                        return '';
                      }
                      if (Date.now() - parsed.savedAt > filterMaxAgeMs) {
                        localStorage.removeItem(storageKey);
                        return '';
                      }
                      return parsed.value;
                    } catch (error) {
                      localStorage.removeItem(storageKey);
                      return '';
                    }
                  };
                  const writeStoredFilter = (value) => localStorage.setItem(storageKey, JSON.stringify({ value, savedAt: Date.now() }));
                  const sanitizedSearch = (search) => {
                    const params = new URLSearchParams(search || '');
                    ['new', 'saved', 'error', 'usage'].forEach(key => params.delete(key));
                    const clean = params.toString();
                    return clean ? '?' + clean : '';
                  };
                  if (resetLink) resetLink.addEventListener('click', () => localStorage.removeItem(storageKey));
                  const query = sanitizedSearch(window.location.search);
                  const form = document.querySelector('form.expense-filters');
                  if (query && query !== '?') writeStoredFilter(query);
                  else {
                    const saved = sanitizedSearch(readStoredFilter());
                    if (saved) {
                      writeStoredFilter(saved);
                      window.location.replace('/incomes' + saved);
                    } else {
                      localStorage.removeItem(storageKey);
                    }
                  }
                  if (form) form.addEventListener('submit', () => {
                    const billingFields = ['billingPeriodFrom', 'billingPeriodTo', 'billingPeriodQuick', 'billingPeriodYear'].map(name => form.elements.namedItem(name)).filter(Boolean);
                    const dateFields = ['creditDateFrom', 'creditDateTo', 'dateQuick', 'dateYear'].map(name => form.elements.namedItem(name)).filter(Boolean);
                    const hasBilling = billingFields.some(field => field.value);
                    const hasDate = dateFields.some(field => field.value);
                    if (hasBilling) dateFields.forEach(field => { field.value = ''; });
                    else if (hasDate) billingFields.forEach(field => { field.value = ''; });
                    setTimeout(() => {
                      const clean = sanitizedSearch(window.location.search);
                      if (clean) writeStoredFilter(clean);
                      else localStorage.removeItem(storageKey);
                    }, 0);
                  });
                })();
        
                (() => {
                  const quick = document.getElementById('incomeBillingPeriodQuick');
                  const from = document.getElementById('incomeBillingPeriodFrom');
                  const to = document.getElementById('incomeBillingPeriodTo');
                  if (!quick || !from || !to) return;
                  const computeRange = (value) => {
                    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
                    const fmt = (year, monthIndex) => { const date = new Date(year, monthIndex, 1); return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'); };
                    const currentQuarter = Math.floor(m / 3);
                    const monthMatch = String(value).match(/^month_(\d{2})$/);
                    const quarterMatch = String(value).match(/^quarter_(\d)$/);
                    if (monthMatch) { const selectedMonth = Number(monthMatch[1]) - 1; return { from: fmt(y, selectedMonth), to: fmt(y, selectedMonth) }; }
                    if (quarterMatch) { const quarter = Number(quarterMatch[1]) - 1; return { from: fmt(y, quarter * 3), to: fmt(y, quarter * 3 + 2) }; }
                    if (value === 'previous_month') return { from: fmt(y, m - 1), to: fmt(y, m - 1) };
                    if (value === 'current_quarter') return { from: fmt(y, currentQuarter * 3), to: fmt(y, currentQuarter * 3 + 2) };
                    if (value === 'previous_quarter') return currentQuarter > 0 ? { from: fmt(y, (currentQuarter - 1) * 3), to: fmt(y, (currentQuarter - 1) * 3 + 2) } : { from: fmt(y - 1, 9), to: fmt(y - 1, 11) };
                    if (value === 'year_to_date') return { from: fmt(y, 0), to: fmt(y, 11) };
                    if (value === 'this_month') return { from: fmt(y, m), to: fmt(y, m) };
                    return null;
                  };
                  quick.addEventListener('change', () => { const range = computeRange(quick.value); if (!range) return; from.value = range.from; to.value = range.to; ['creditDateFrom','creditDateTo','incomeDateQuick'].forEach(id => { const field = document.getElementById(id); if (field) field.value = ''; }); });
                  [from, to].forEach((field) => field.addEventListener('change', () => { quick.value = ''; ['creditDateFrom','creditDateTo','incomeDateQuick'].forEach(id => { const f = document.getElementById(id); if (f) f.value = ''; }); }));
                })();
                document.addEventListener('submit', function(event) { const form = event.target; if (form && form.classList && form.classList.contains('confirm-delete-form')) { const message = form.getAttribute('data-confirm') || 'Confermi la rimozione?'; if (!confirm(message)) event.preventDefault(); } });
                document.addEventListener('submit', function(event) { const form = event.target; if (form && form.classList && form.classList.contains('confirm-bulk-form')) { const selected = form.querySelectorAll('input[name="ids"]:checked').length || document.querySelectorAll('input[form="' + form.id + '"][name="ids"]:checked').length; if (!selected) { alert('Seleziona almeno una riga.'); event.preventDefault(); return; } const submitter = event.submitter; const action = submitter && submitter.getAttribute ? submitter.getAttribute('value') : ''; if (!action) { alert('Seleziona un’azione bulk.'); event.preventDefault(); return; } const label = submitter && submitter.textContent ? submitter.textContent.trim() : 'questa azione'; const message = 'Confermi di eseguire "' + label + '" sui record selezionati?'; if (!confirm(message)) event.preventDefault(); } });
                (() => {
                  const syncBulkMenus = () => {
                    document.querySelectorAll('[data-bulk-menu]').forEach(menu => {
                      const formId = menu.getAttribute('data-bulk-form');
                      const selected = formId ? document.querySelectorAll('input[form="' + formId + '"][name="ids"]:checked').length : 0;
                      menu.classList.toggle('bulk-action-menu-disabled', selected === 0);
                      if (selected === 0) menu.removeAttribute('open');
                    });
                    document.querySelectorAll('[data-bulk-direct-actions]').forEach(group => {
                      const formId = group.getAttribute('data-bulk-form');
                      const selectedInputs = formId ? Array.from(document.querySelectorAll('input[form="' + formId + '"][name="ids"]:checked')) : [];
                      const selected = selectedInputs.length;
                      const firstId = selectedInputs[0] ? selectedInputs[0].value : '';
                      const returnTo = group.getAttribute('data-return-to') || '';
                      const edit = group.querySelector('[data-bulk-edit]');
                      const copy = group.querySelector('[data-bulk-copy]');
                      const del = group.querySelector('[data-bulk-delete]');
                      const singleEnabled = selected === 1;
                      const anyEnabled = selected > 0;
                      if (edit) {
                        edit.classList.toggle('is-disabled', !singleEnabled);
                        edit.setAttribute('aria-disabled', singleEnabled ? 'false' : 'true');
                        edit.href = '#';
                        if (singleEnabled) edit.setAttribute('data-income-edit-id', firstId);
                        else edit.removeAttribute('data-income-edit-id');
                      }
                      if (copy) {
                        copy.classList.toggle('is-disabled', !singleEnabled);
                        copy.setAttribute('aria-disabled', singleEnabled ? 'false' : 'true');
                        copy.href = '#';
                        if (singleEnabled) copy.setAttribute('data-income-copy-id', firstId);
                        else copy.removeAttribute('data-income-copy-id');
                      }
                      if (del) del.disabled = !anyEnabled;
                    });
                  };
                  document.addEventListener('change', function(event) {
                    const target = event.target;
                    if (target && target.classList && target.classList.contains('bulk-select-all')) {
                      const formId = target.getAttribute('data-bulk-target');
                      if (!formId) return;
                      document.querySelectorAll('input[form="' + formId + '"][name="ids"]').forEach(input => { input.checked = target.checked; });
                    }
                    if (target && target.matches && (target.matches('input[name="ids"]') || target.classList.contains('bulk-select-all'))) syncBulkMenus();
                  });
                  document.addEventListener('click', function(event) {
                    document.querySelectorAll('[data-bulk-menu][open]').forEach(menu => {
                      if (!menu.contains(event.target)) menu.removeAttribute('open');
                    });
                  });
                  document.addEventListener('click', function(event) {
                    const link = event.target.closest && event.target.closest('.bulk-direct-link.is-disabled');
                    if (link) event.preventDefault();
                  });
                  document.addEventListener('toggle', function(event) {
                    const menu = event.target;
                    if (menu && menu.matches && menu.matches('[data-bulk-menu][open]')) {
                      const formId = menu.getAttribute('data-bulk-form');
                      const selected = formId ? document.querySelectorAll('input[form="' + formId + '"][name="ids"]:checked').length : 0;
                      if (!selected) menu.removeAttribute('open');
                    }
                  }, true);
                  syncBulkMenus();
                })();
                (() => {
                  const quick = document.getElementById('incomeDateQuick');
                  const from = document.getElementById('creditDateFrom');
                  const to = document.getElementById('creditDateTo');
                  if (!quick || !from || !to) return;
                  const computeRange = (value) => {
                    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
                    const fmt = (date) => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
                    const fiscalQuarterRange = (yy, quarter) => ({ from: fmt(new Date(yy, quarter * 3, 1)), to: fmt(new Date(yy, quarter * 3 + 3, 0)) });
                    const currentQuarter = Math.floor(m / 3);
                    const monthMatch = String(value).match(/^month_(\d{2})$/);
                    const quarterMatch = String(value).match(/^quarter_(\d)$/);
                    if (monthMatch) { const selectedMonth = Number(monthMatch[1]) - 1; return { from: fmt(new Date(y, selectedMonth, 1)), to: fmt(new Date(y, selectedMonth + 1, 0)) }; }
                    if (quarterMatch) return fiscalQuarterRange(y, Number(quarterMatch[1]) - 1);
                    if (value === 'previous_month') return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
                    if (value === 'two_months_ago') return { from: fmt(new Date(y, m - 2, 1)), to: fmt(new Date(y, m - 1, 0)) };
                    if (value === 'current_quarter') return fiscalQuarterRange(y, currentQuarter);
                    if (value === 'last_quarter') return currentQuarter > 0 ? fiscalQuarterRange(y, currentQuarter - 1) : fiscalQuarterRange(y - 1, 3);
                    if (value === 'year_to_date') return { from: fmt(new Date(y, 0, 1)), to: fmt(new Date(y, 11, 31)) };
                    if (value === 'this_month') return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
                    return null;
                  };
                  quick.addEventListener('change', () => { const range = computeRange(quick.value); if (!range) return; from.value = range.from; to.value = range.to; ['incomeBillingPeriodFrom','incomeBillingPeriodTo','incomeBillingPeriodQuick'].forEach(id => { const field = document.getElementById(id); if (field) field.value = ''; }); });
                  [from, to].forEach((field) => field.addEventListener('change', () => { quick.value = ''; ['incomeBillingPeriodFrom','incomeBillingPeriodTo','incomeBillingPeriodQuick'].forEach(id => { const f = document.getElementById(id); if (f) f.value = ''; }); }));
                  ['incomeBillingPeriodFrom','incomeBillingPeriodTo','incomeBillingPeriodQuick'].forEach((id) => { const field = document.getElementById(id); if (field) field.addEventListener('change', () => { ['creditDateFrom','creditDateTo','incomeDateQuick'].forEach(otherId => { const other = document.getElementById(otherId); if (other) other.value = ''; }); }); });
                })();
              `
            }}/>

            <MobileSortControl action="/incomes" currentValue={mobileSort} options={incomeMobileSortOptions} searchParams={filters}/>

            <IncomesList
                incomes={filteredIncomes}
                mobileIncomes={mobileSortedIncomes}
                returnTo={returnTo}
                banks={orderedBanks.map(bank => ({
                    id: bank.id,
                    name: bank.name,
                    icon: bank.icon,
                    isFallback: bank.isFallback
                }))}
                paymentMethods={incomePaymentMethods.map(method => ({
                    id: method.id,
                    name: method.name,
                    icon: method.icon,
                    kind: method.kind,
                    isFallback: method.isFallback
                }))}
                incomeCategories={incomeCategories}
                salesChannels={salesChannels}
                customers={customers}
                initialOpen={inputDefault(filters, 'new') === '1'}
                emptyMessage="Nessun incasso trovato con i filtri selezionati."
            />
        </div>
        {/*<div className="card expenses-list-card">*/}
        {/*  <div className="charts-grid">*/}
        {/*    <IncomePieBreakdownChart title="Entrate per categoria / canale di vendita" data={incomesBySaleCategoryAndChannel} />*/}
        {/*    <IncomeBreakdownChart title="Grafico entrate dichiarate" description="Distribuzione degli incassi fiscali e non fiscali sui risultati filtrati." data={incomesByFiscalStatus} />*/}
        {/*  </div>*/}
        {/*</div>*/}
    </div>;
}
