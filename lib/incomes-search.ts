import type {Prisma} from '@/generated/prisma/client';
import {calendarDateInput, civilDateInTimeZone, dateInputInTimeZone} from './company-time';
import {incomeCreditState} from './income-status';
import {matchesIncomeTask} from './dashboard-tasks';
import {matchesEntityQuickSearch} from './entity-quick-search';

export type SearchParams = Record<string, string | string[] | undefined>;
export const incomesSearchInclude = {paymentMethodRef: true, creditBank: true, salesChannelRef: true, customer: true, credits: true, attachments: true} as const satisfies Prisma.IncomeInclude;
type IncomeSearchRecord = Prisma.IncomeGetPayload<{include: typeof incomesSearchInclude}>;

type AmountFilter =
    | { mode: 'exact'; value: number }
    | { mode: 'gte'; value: number }
    | { mode: 'lte'; value: number }
    | { mode: 'gt'; value: number }
    | { mode: 'lt'; value: number }
    | { mode: 'range'; min: number; max: number };
export function inputDefault(searchParams: Record<string, string | string[] | undefined>, key: string) {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export function normalize(value: unknown) {
    return String(value ?? '').trim().toLowerCase();
}

export function parseLocaleNumber(value: string) {
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

export function parseAmountFilter(value: string): AmountFilter | null {
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

export function amountMatchesFilter(amount: number, filterValue: AmountFilter | null) {
    if (filterValue === null) return true;
    const cents = Math.round(amount * 100);
    if (filterValue.mode === 'exact') return cents === Math.round(filterValue.value * 100);
    if (filterValue.mode === 'gte') return amount >= filterValue.value;
    if (filterValue.mode === 'lte') return amount <= filterValue.value;
    if (filterValue.mode === 'gt') return amount > filterValue.value;
    if (filterValue.mode === 'lt') return amount < filterValue.value;
    return amount >= filterValue.min && amount <= filterValue.max;
}

export function toDateInputValue(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function fiscalQuarterRange(year: number, quarterIndex: number) {
    const startMonth = quarterIndex * 3;
    return {
        from: toDateInputValue(new Date(year, startMonth, 1)),
        to: toDateInputValue(new Date(year, startMonth + 3, 0))
    };
}

export function getQuickDateRange(value: string, selectedYear: string | undefined, now: Date) {
    if (value === 'all') return {from: '', to: ''};
    const parsedYear = Number(selectedYear);
    const year = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : now.getFullYear();
    const month = now.getMonth();
    const currentQuarter = Math.floor(month / 3);
    const monthMatch = String(value).match(/^month_(\d{2})$/);
    const quarterMatch = String(value).match(/^quarter_(\d)$/);

    if (value === 'last_30_days' || value === 'last_90_days') {
        const days = value === 'last_30_days' ? 30 : 90;
        return {
            from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))),
            to: toDateInputValue(now)
        };
    }

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

export function toMonthInputValue(year: number, monthIndexZeroBased: number) {
    const date = new Date(year, monthIndexZeroBased, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getQuickBillingPeriodRange(value: string, selectedYear: string | undefined, now: Date) {
    const parsedYear = Number(selectedYear);
    const year = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : now.getFullYear();
    const month = now.getMonth();
    const currentQuarter = Math.floor(month / 3);
    const monthMatch = String(value).match(/^month_(\d{2})$/);
    const quarterMatch = String(value).match(/^quarter_(\d)$/);

    if (value === 'last_30_days' || value === 'last_90_days') {
        const days = value === 'last_30_days' ? 30 : 90;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
        return {from: toMonthInputValue(start.getFullYear(), start.getMonth()), to: toMonthInputValue(now.getFullYear(), now.getMonth())};
    }

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

export function monthInputToKey(value: string) {
    const match = String(value ?? '').trim().match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!year || month < 1 || month > 12) return null;
    return year * 12 + month;
}

export function normalizePeriodRange(fromKey: number | null, toKey: number | null) {
    if (fromKey !== null && toKey !== null && fromKey > toKey) {
        return {fromKey: toKey, toKey: fromKey};
    }
    return {fromKey, toKey};
}

export function recordPeriodKey(month: number, year: number) {
    return Number(year) * 12 + Number(month);
}

export function matchesBillingPeriod(month: number, year: number, fromKey: number | null, toKey: number | null) {
    const key = recordPeriodKey(month, year);
    if (fromKey !== null && key < fromKey) return false;
    if (toKey !== null && key > toKey) return false;
    return true;
}

export function matchesIsoDate(value: Date | null | undefined, from: string, to: string, timeZone: string, civilDate = false) {
    const formatted = value ? (civilDate ? calendarDateInput(value) : dateInputInTimeZone(timeZone, value)) : '';
    if (from && (!formatted || formatted < from)) return false;
    if (to && (!formatted || formatted > to)) return false;
    return true;
}

export function resolveIncomeSearch(filters: SearchParams, timeZone: string, now = new Date(), incomePaymentMethods: Array<{id: number; name: string}>, orderedBanks: Array<{id: number; name: string}>) {
    const companyNow = civilDateInTimeZone(timeZone, now);
    const hasFiscalPeriodFilter = Boolean(inputDefault(filters, 'billingPeriodFrom') || inputDefault(filters, 'billingPeriodTo') || inputDefault(filters, 'billingPeriod') || inputDefault(filters, 'billingPeriodQuick'));
    const hasCreditDateFilter = Boolean(inputDefault(filters, 'creditDateFrom') || inputDefault(filters, 'creditDateTo') || inputDefault(filters, 'dateQuick'));
    const dateYearFilter = inputDefault(filters, 'dateYear');
    const billingPeriodYearFilter = inputDefault(filters, 'billingPeriodYear');
    const viewFilter = inputDefault(filters, 'view');
    const useFiscalPeriodFilter = viewFilter === 'fiscale' || (viewFilter !== 'andamento' && hasFiscalPeriodFilter);
    const useCreditDateFilter = !useFiscalPeriodFilter;
    const rawDateQuickFilter = useCreditDateFilter ? inputDefault(filters, 'dateQuick') : '';
    const hasCustomCreditDateFilter = useCreditDateFilter && !rawDateQuickFilter && Boolean(inputDefault(filters, 'creditDateFrom') || inputDefault(filters, 'creditDateTo'));
    const quickDateFilter = useCreditDateFilter ? (rawDateQuickFilter || (!hasCreditDateFilter ? 'last_90_days' : '')) : '';
    const dateQuickSelectorValue = hasCustomCreditDateFilter ? 'custom' : quickDateFilter;
    const quickDateRange = quickDateFilter ? getQuickDateRange(quickDateFilter, dateYearFilter, companyNow) : null;
    const creditDateFromDefault = useCreditDateFilter ? (quickDateRange?.from || inputDefault(filters, 'creditDateFrom')) : '';
    const creditDateToDefault = useCreditDateFilter ? (quickDateRange?.to || inputDefault(filters, 'creditDateTo')) : '';
    const quickBillingPeriodFilter = useFiscalPeriodFilter ? (inputDefault(filters, 'billingPeriodQuick') || (
        !inputDefault(filters, 'billingPeriodFrom') && !inputDefault(filters, 'billingPeriodTo') && !inputDefault(filters, 'billingPeriod')
            ? 'last_90_days'
            : ''
    )) : '';
    const quickBillingPeriodRange = quickBillingPeriodFilter ? getQuickBillingPeriodRange(quickBillingPeriodFilter, billingPeriodYearFilter, companyNow) : null;
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
    const amountFilterRaw = inputDefault(filters, 'amount');
    const amountFilterValue = parseAmountFilter(amountFilterRaw);
    const paymentMethodFilter = inputDefault(filters, 'paymentMethod');
    const creditChannelFilter = inputDefault(filters, 'creditChannel');
    const customerQuickFilter = normalize(inputDefault(filters, 'customerQuick'));
    const fiscalFilter = inputDefault(filters, 'fiscal');
    const invoiceStatusFilter = inputDefault(filters, 'invoiceStatus');
    const invoiceStatusModeFilter = inputDefault(filters, 'invoiceStatusMode');
    const vatRateFilter = inputDefault(filters, 'vatRate');
    const dueDateFromFilter = inputDefault(filters, 'dueDateFrom');
    const dueDateToFilter = inputDefault(filters, 'dueDateTo');
    const orderDateFromFilter = inputDefault(filters, 'orderDateFrom');
    const orderDateToFilter = inputDefault(filters, 'orderDateTo');
    const creditStatusFilter = inputDefault(filters, 'creditStatus');
    return {
        hasFiscalPeriodFilter, hasCreditDateFilter, dateYearFilter, billingPeriodYearFilter,
        viewFilter, useFiscalPeriodFilter, useCreditDateFilter, rawDateQuickFilter,
        hasCustomCreditDateFilter, quickDateFilter, dateQuickSelectorValue, quickDateRange,
        creditDateFromDefault, creditDateToDefault, quickBillingPeriodFilter, quickBillingPeriodRange,
        creditDateFromFilter, creditDateToFilter, billingPeriodFromFilter, billingPeriodToFilter,
        rawBillingPeriodFromKey, rawBillingPeriodToKey, hasBillingPeriodRange, salesChannelFilter,
        amountFilterRaw, amountFilterValue, paymentMethodFilter, creditChannelFilter,
        customerQuickFilter, fiscalFilter, invoiceStatusFilter, invoiceStatusModeFilter,
        vatRateFilter, dueDateFromFilter, dueDateToFilter, orderDateFromFilter,
        orderDateToFilter, creditStatusFilter, billingPeriodFromKey, billingPeriodToKey,
        timeZone, now, incomePaymentMethods, orderedBanks
    };
}

export function matchesIncomeSearch(income: IncomeSearchRecord, search: ReturnType<typeof resolveIncomeSearch>) {
    const {
        useFiscalPeriodFilter, creditDateFromFilter, creditDateToFilter, salesChannelFilter,
        amountFilterValue, paymentMethodFilter, creditChannelFilter, customerQuickFilter,
        fiscalFilter, invoiceStatusFilter, invoiceStatusModeFilter, vatRateFilter,
        dueDateFromFilter, dueDateToFilter, orderDateFromFilter, orderDateToFilter,
        creditStatusFilter, billingPeriodFromKey, billingPeriodToKey, incomePaymentMethods,
        orderedBanks
    } = search;
    if (!matchesIsoDate(income.creditDate, creditDateFromFilter, creditDateToFilter, search.timeZone, true)) return false;
    if (!matchesIsoDate(income.orderDate, orderDateFromFilter, orderDateToFilter, search.timeZone, true)) return false;
    if (!matchesBillingPeriod(income.billingMonth, income.billingYear, billingPeriodFromKey, billingPeriodToKey)) return false;
    if (useFiscalPeriodFilter && !income.isFiscal) return false;
    if (salesChannelFilter && income.salesChannelRef.name !== salesChannelFilter) return false;
    if (!amountMatchesFilter(Number(income.amount.toString()), amountFilterValue)) return false;
    if (paymentMethodFilter && !income.credits.some(credit => credit.paymentMethodId === incomePaymentMethods.find(method => method.name === paymentMethodFilter)?.id)) return false;
    if (creditChannelFilter && !income.credits.some(credit => credit.bankId === orderedBanks.find(bank => bank.name === creditChannelFilter)?.id)) return false;
    if (!matchesEntityQuickSearch(customerQuickFilter, income.customer?.businessName, income.description)) return false;
    if (fiscalFilter === 'yes' && !income.isFiscal) return false;
    if (fiscalFilter === 'no' && income.isFiscal) return false;
    if (invoiceStatusModeFilter === 'not_emitted' && !matchesIncomeTask(income, 'missing_invoice')) return false;
    if (invoiceStatusFilter === 'not_emitted' && !matchesIncomeTask(income, 'missing_invoice')) return false;
    if (invoiceStatusFilter && invoiceStatusFilter !== 'not_emitted' && income.invoiceStatus !== invoiceStatusFilter) return false;
    if (vatRateFilter && Number(income.vatRate.toString()) !== Number(vatRateFilter)) return false;
    if (!matchesIsoDate(income.dueDate, dueDateFromFilter, dueDateToFilter, search.timeZone, true)) return false;
    if (creditStatusFilter === 'not_complete' && !matchesIncomeTask(income, 'uncredited')) return false;
    if (creditStatusFilter && creditStatusFilter !== 'not_complete' && incomeCreditState(income, search.now, search.timeZone) !== creditStatusFilter) return false;
    return true;
}
