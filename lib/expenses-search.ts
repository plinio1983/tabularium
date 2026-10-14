import type {Prisma} from '@/generated/prisma/client';
import {calendarDateInput, civilDateInTimeZone, dateInputInTimeZone} from './company-time';
import {isExpensePastDue} from './expense-calculations';
import {expenseAffectsFiscalProfit} from './reports';
import {isExpenseInvoiceNotReceived} from './expense-invoice';
import {matchesExpenseMerchantSearch, matchesExpenseQuickSearch, matchesExpenseType} from './expense-list-filters';

export type SearchParams = Record<string, string | string[] | undefined>;
export const expensesSearchInclude = {category: true, supplier: true, taxAuthority: {select: {name: true}}, employee: true, payments: {include: {bank: true, paymentMethod: true}, orderBy: {id: 'asc'}}, attachments: true} as const satisfies Prisma.ExpenseInclude;
type ExpenseSearchRecord = Prisma.ExpenseGetPayload<{include: typeof expensesSearchInclude}>;

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

    if (quarterMatch) {
        return fiscalQuarterRange(year, Number(quarterMatch[1]) - 1);
    }

    if (value === 'previous_month') {
        return {
            from: toDateInputValue(new Date(year, month - 1, 1)),
            to: toDateInputValue(new Date(year, month, 0))
        };
    }

    if (value === 'two_months_ago') {
        return {
            from: toDateInputValue(new Date(year, month - 2, 1)),
            to: toDateInputValue(new Date(year, month - 1, 0))
        };
    }

    if (value === 'current_quarter') {
        return fiscalQuarterRange(year, currentQuarter);
    }

    if (value === 'last_quarter') {
        const lastQuarter = currentQuarter - 1;
        return lastQuarter >= 0
            ? fiscalQuarterRange(year, lastQuarter)
            : fiscalQuarterRange(year - 1, 3);
    }

    if (value === 'previous_quarter') {
        const previousQuarter = currentQuarter - 1;
        return previousQuarter >= 0
            ? fiscalQuarterRange(year, previousQuarter)
            : fiscalQuarterRange(year - 1, 3);
    }

    if (value === 'year_to_date') {
        return {
            from: toDateInputValue(new Date(year, 0, 1)),
            to: toDateInputValue(new Date(year, 11, 31))
        };
    }

    return {
        from: toDateInputValue(new Date(year, month, 1)),
        to: toDateInputValue(new Date(year, month + 1, 0))
    };
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

    if (value === 'previous_month') {
        return {from: toMonthInputValue(year, month - 1), to: toMonthInputValue(year, month - 1)};
    }

    if (value === 'current_quarter') {
        return {from: toMonthInputValue(year, currentQuarter * 3), to: toMonthInputValue(year, currentQuarter * 3 + 2)};
    }

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

export function matchesIsoDate(value: Date | null | undefined, from: string, to: string) {
    const formatted = value ? calendarDateInput(value) : '';
    if (from && (!formatted || formatted < from)) return false;
    if (to && (!formatted || formatted > to)) return false;
    return true;
}

export function resolveExpenseSearch(filters: SearchParams, timeZone: string, now = new Date()) {
    const companyNow = civilDateInTimeZone(timeZone, now);
    const hasFiscalPeriodFilter = Boolean(inputDefault(filters, 'billingPeriodFrom') || inputDefault(filters, 'billingPeriodTo') || inputDefault(filters, 'period') || inputDefault(filters, 'billingPeriodQuick'));
    const hasOrderDateFilter = Boolean(inputDefault(filters, 'orderDateFrom') || inputDefault(filters, 'orderDateTo') || inputDefault(filters, 'dateQuick'));
    const dateYearFilter = inputDefault(filters, 'dateYear');
    const billingPeriodYearFilter = inputDefault(filters, 'billingPeriodYear');
    const viewFilter = inputDefault(filters, 'view');
    const useFiscalPeriodFilter = viewFilter === 'fiscale' || (viewFilter !== 'andamento' && hasFiscalPeriodFilter);
    const useOrderDateFilter = !useFiscalPeriodFilter;
    const rawDateQuickFilter = useOrderDateFilter ? inputDefault(filters, 'dateQuick') : '';
    const hasCustomOrderDateFilter = useOrderDateFilter && !rawDateQuickFilter && Boolean(inputDefault(filters, 'orderDateFrom') || inputDefault(filters, 'orderDateTo'));
    const quickDateFilter = useOrderDateFilter ? (rawDateQuickFilter || (!hasOrderDateFilter ? 'last_90_days' : '')) : '';
    const dateQuickSelectorValue = hasCustomOrderDateFilter ? 'custom' : quickDateFilter;
    const quickDateRange = quickDateFilter ? getQuickDateRange(quickDateFilter, dateYearFilter, companyNow) : null;
    const orderDateFromDefault = useOrderDateFilter ? (quickDateRange?.from || inputDefault(filters, 'orderDateFrom')) : '';
    const orderDateToDefault = useOrderDateFilter ? (quickDateRange?.to || inputDefault(filters, 'orderDateTo')) : '';
    const quickBillingPeriodFilter = useFiscalPeriodFilter ? (inputDefault(filters, 'billingPeriodQuick') || (
        !inputDefault(filters, 'billingPeriodFrom') && !inputDefault(filters, 'billingPeriodTo') && !inputDefault(filters, 'period')
            ? 'last_90_days'
            : ''
    )) : '';
    const quickBillingPeriodRange = quickBillingPeriodFilter ? getQuickBillingPeriodRange(quickBillingPeriodFilter, billingPeriodYearFilter, companyNow) : null;
    const billingPeriodFromFilter = useFiscalPeriodFilter ? (quickBillingPeriodRange?.from || inputDefault(filters, 'billingPeriodFrom') || inputDefault(filters, 'period')) : '';
    const billingPeriodToFilter = useFiscalPeriodFilter ? (quickBillingPeriodRange?.to || inputDefault(filters, 'billingPeriodTo') || inputDefault(filters, 'period')) : '';
    const rawBillingPeriodFromKey = monthInputToKey(billingPeriodFromFilter);
    const rawBillingPeriodToKey = monthInputToKey(billingPeriodToFilter);
    const {
        fromKey: billingPeriodFromKey,
        toKey: billingPeriodToKey
    } = normalizePeriodRange(rawBillingPeriodFromKey, rawBillingPeriodToKey);
    const orderDateFromFilter = useOrderDateFilter ? orderDateFromDefault : '';
    const orderDateToFilter = useOrderDateFilter ? orderDateToDefault : '';
    const categoryFilter = inputDefault(filters, 'category');
    const expenseTypeFilter = inputDefault(filters, 'expenseType');
    const merchantFilter = normalize(inputDefault(filters, 'merchant'));
    const supplierQuickFilter = normalize(inputDefault(filters, 'supplierQuick'));
    const productFilter = normalize(inputDefault(filters, 'product'));
    const amountFilterRaw = inputDefault(filters, 'amount');
    const amountFilterValue = parseAmountFilter(amountFilterRaw);
    const paymentStatusFilter = inputDefault(filters, 'paymentStatus');
    const residualFilter = inputDefault(filters, 'residual');
    const electronicInvoiceFilter = inputDefault(filters, 'electronicInvoice');
    const invoiceStatusFilter = inputDefault(filters, 'invoiceStatus');
    const invoiceStatusModeFilter = inputDefault(filters, 'invoiceStatusMode');
    const declaredFilter = inputDefault(filters, 'declared');
    const attachmentsFilter = inputDefault(filters, 'attachments');
    return {
        hasFiscalPeriodFilter, hasOrderDateFilter, dateYearFilter, billingPeriodYearFilter,
        viewFilter, useFiscalPeriodFilter, useOrderDateFilter, rawDateQuickFilter,
        hasCustomOrderDateFilter, quickDateFilter, dateQuickSelectorValue, quickDateRange,
        orderDateFromDefault, orderDateToDefault, quickBillingPeriodFilter, quickBillingPeriodRange,
        billingPeriodFromFilter, billingPeriodToFilter, rawBillingPeriodFromKey, rawBillingPeriodToKey,
        orderDateFromFilter, orderDateToFilter, categoryFilter, expenseTypeFilter,
        merchantFilter, supplierQuickFilter, productFilter, amountFilterRaw,
        amountFilterValue, paymentStatusFilter, residualFilter, electronicInvoiceFilter,
        invoiceStatusFilter, invoiceStatusModeFilter, declaredFilter, attachmentsFilter,
        billingPeriodFromKey, billingPeriodToKey, timeZone, now
    };
}

export function matchesExpenseSearch(expense: ExpenseSearchRecord, search: ReturnType<typeof resolveExpenseSearch>) {
    const {
        useFiscalPeriodFilter, orderDateFromFilter, orderDateToFilter, categoryFilter,
        expenseTypeFilter, merchantFilter, supplierQuickFilter, productFilter,
        amountFilterValue, paymentStatusFilter, residualFilter, electronicInvoiceFilter,
        invoiceStatusFilter, invoiceStatusModeFilter, declaredFilter, attachmentsFilter,
        billingPeriodFromKey, billingPeriodToKey
    } = search;
    const amount = Number(expense.amount.toString());
    const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
    const residual = Math.max(0, amount - paid);
    const affectsFiscalResult = expenseAffectsFiscalProfit(expense);

    if (!matchesBillingPeriod(expense.month, expense.year, billingPeriodFromKey, billingPeriodToKey)) return false;
    if (!matchesIsoDate(expense.receivedDate, orderDateFromFilter, orderDateToFilter)) return false;
    if (useFiscalPeriodFilter && !affectsFiscalResult) return false;
    if (categoryFilter && expense.category?.name !== categoryFilter) return false;
    if (!matchesExpenseType(expense, expenseTypeFilter)) return false;
    if (!matchesExpenseMerchantSearch(expense, merchantFilter)) return false;
    if (!matchesExpenseQuickSearch(expense, supplierQuickFilter)) return false;
    if (productFilter && !normalize(expense.description).includes(productFilter)) return false;
    if (!amountMatchesFilter(amount, amountFilterValue)) return false;
    if (paymentStatusFilter === 'not_complete' && expense.paymentStatus === 'COMPLETATO') return false;
    if (paymentStatusFilter === 'overdue' && !isExpensePastDue(expense, search.now, search.timeZone)) return false;
    if (paymentStatusFilter && !['not_complete', 'overdue'].includes(paymentStatusFilter) && expense.paymentStatus !== paymentStatusFilter) return false;
    if (residualFilter === 'open' && residual <= 0) return false;
    if (residualFilter === 'closed' && residual > 0) return false;
    if (electronicInvoiceFilter === 'yes' && !expense.hasElectronicInvoice) return false;
    if (electronicInvoiceFilter === 'no' && expense.hasElectronicInvoice) return false;
    if (invoiceStatusModeFilter === 'not_received' && !isExpenseInvoiceNotReceived(expense)) return false;
    if (invoiceStatusFilter === 'not_received' && !isExpenseInvoiceNotReceived(expense)) return false;
    if (invoiceStatusFilter && invoiceStatusFilter !== 'not_received' && expense.invoiceStatus !== invoiceStatusFilter) return false;
    if (declaredFilter === 'yes' && !affectsFiscalResult) return false;
    if (declaredFilter === 'no' && affectsFiscalResult) return false;
    if (attachmentsFilter === 'with' && expense.attachments.length === 0) return false;
    if (attachmentsFilter === 'without' && expense.attachments.length > 0) return false;

    return true;
}
