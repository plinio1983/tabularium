import Link from 'next/link';
import BulkSelectionController from '@/components/BulkSelectionController';
import BulkChangeCategoryModal from '@/components/BulkChangeCategoryModal';
import DeleteActionButton from '@/components/DeleteActionButton';
import { prisma } from '@/lib/prisma';
import { euro, moneyTone } from '@/lib/money';
import NewIncomePanel from '@/components/NewIncomePanel';
import IncomeEditModalController from '@/components/IncomeEditModalController';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import IncomeFiltersDrawer from '@/components/IncomeFiltersDrawer';
import IncomeTrendSelectors from '@/components/IncomeTrendSelectors';
import {
  badgeClass,
  creditChannelStyles,
  fiscalStyles,
  incomeCreditStatusStyles,
  incomeInvoiceStatusStyles,
  paymentMethodStyles,
  saleCategoryStyles,
  salesChannelStyles
} from '@/lib/income-ui';
import { vatStyles } from '@/lib/expense-ui';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderPaymentMethods } from '@/lib/workspace-defaults';
import { stripFlashRecord, stripFlashSearchParams } from '@/lib/flash';

const salesChannelOptions = ['Shop', 'Online Shop', 'Altro Canale'];
const saleCategoryOptions = ['B2C', 'B2B', 'Altro'];
const invoiceStatusOptions = [
  ['NON_INVIATA', 'Non inviata'],
  ['EMESSA', 'Emessa'],
  ['not_emitted', 'Non emesse']
];

function dateLabel(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(value)
    : '-';
}

function mobileDateLabel(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(value).replace('.', '')
    : '-';
}

function formatDateInputLabel(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDateTextInputLabel(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const label = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatMonthInputLabel(value: string) {
  if (!value) return '';
  const [year, month] = value.split('-');
  if (!year || !month) return value;
  const date = new Date(Number(year), Number(month) - 1, 1);
  const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(date);
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
    if (min !== null && max !== null) return { mode: 'range', min: Math.min(min, max), max: Math.max(min, max) };
  }

  const operatorMatch = raw.match(/^(>=|<=|>|<)\s*(.+)$/);
  if (operatorMatch) {
    const value = parseLocaleNumber(operatorMatch[2]);
    if (value !== null) {
      const operator = operatorMatch[1];
      if (operator === '>=') return { mode: 'gte', value };
      if (operator === '<=') return { mode: 'lte', value };
      if (operator === '>') return { mode: 'gt', value };
      if (operator === '<') return { mode: 'lt', value };
    }
  }

  const parsed = parseLocaleNumber(raw);
  return parsed === null ? null : { mode: 'exact', value: parsed };
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
    return { from: toDateInputValue(new Date(year, selectedMonth, 1)), to: toDateInputValue(new Date(year, selectedMonth + 1, 0)) };
  }
  if (quarterMatch) return fiscalQuarterRange(year, Number(quarterMatch[1]) - 1);
  if (value === 'previous_month') return { from: toDateInputValue(new Date(year, month - 1, 1)), to: toDateInputValue(new Date(year, month, 0)) };
  if (value === 'two_months_ago') return { from: toDateInputValue(new Date(year, month - 2, 1)), to: toDateInputValue(new Date(year, month - 1, 0)) };
  if (value === 'current_quarter') return fiscalQuarterRange(year, currentQuarter);
  if (value === 'last_quarter') return currentQuarter > 0 ? fiscalQuarterRange(year, currentQuarter - 1) : fiscalQuarterRange(year - 1, 3);
  if (value === 'previous_quarter') return currentQuarter > 0 ? fiscalQuarterRange(year, currentQuarter - 1) : fiscalQuarterRange(year - 1, 3);
  if (value === 'year_to_date') {
    const isCurrentYear = year === now.getFullYear();
    return {
      from: toDateInputValue(new Date(year, 0, 1)),
      to: toDateInputValue(isCurrentYear ? now : new Date(year, 11, 31))
    };
  }
  return { from: toDateInputValue(new Date(year, month, 1)), to: toDateInputValue(new Date(year, month + 1, 0)) };
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
  ['year_to_date', 'Da inizio anno'],
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
    return { from: toMonthInputValue(year, selectedMonth), to: toMonthInputValue(year, selectedMonth) };
  }
  if (quarterMatch) {
    const quarter = Number(quarterMatch[1]) - 1;
    return { from: toMonthInputValue(year, quarter * 3), to: toMonthInputValue(year, quarter * 3 + 2) };
  }
  if (value === 'previous_month') return { from: toMonthInputValue(year, month - 1), to: toMonthInputValue(year, month - 1) };
  if (value === 'current_quarter') return { from: toMonthInputValue(year, currentQuarter * 3), to: toMonthInputValue(year, currentQuarter * 3 + 2) };
  if (value === 'previous_quarter') {
    const quarter = currentQuarter - 1;
    return quarter >= 0
      ? { from: toMonthInputValue(year, quarter * 3), to: toMonthInputValue(year, quarter * 3 + 2) }
      : { from: toMonthInputValue(year - 1, 9), to: toMonthInputValue(year - 1, 11) };
  }
  if (value === 'year_to_date') {
    const isCurrentYear = year === now.getFullYear();
    return {
      from: toMonthInputValue(year, 0),
      to: toMonthInputValue(year, isCurrentYear ? month : 11)
    };
  }
  return { from: toMonthInputValue(year, month), to: toMonthInputValue(year, month) };
}

const quickBillingPeriodOptions = [
  ['year_to_date', 'Da inizio anno'],
  ...monthQuickOptions,
  ...quarterQuickOptions
];


function vatAmountFromGross(amount: number, vatRate: number) {
  if (!vatRate) return 0;
  return amount * (vatRate / (100 + vatRate));
}

function formatPeriod(month: number, year: number) {
  const monthName = new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(new Date(year, month - 1, 1));
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
    return { fromKey: toKey, toKey: fromKey };
  }
  return { fromKey, toKey };
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
  const formatted = value ? value.toISOString().slice(0, 10) : '';
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
  const label = value ? 'DF' : 'NF';
  return <span className={`${badgeClass(item.className)} income-badge-compact`}>{label}</span>;
}
function ActiveFilterSummary({ items }: { items: Array<{ label: string; value: string }> }) {
  return <div className="active-filter-summary">
    <span className="active-filter-summary-title">Filtri attivi:</span>
    {items.length ? items.map(item => <span className="active-filter-chip" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>) : <span className="active-filter-empty">nessun filtro impostato</span>}
    <Link className="button-standard secondary-action reset-btn" href="/incomes"><span className="">↺</span> Reset</Link>
  </div>;
}

function optionLabel(options: Array<string[]>, value: string) {
  return options.find(option => option[0] === value)?.[1] ?? value;
}


function IncomeBreakdownChart({ title, description, data }: { title: string; description: string; data: Array<{ name: string; code: string; total: number }> }) {
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
            <div className="category-chart-bar" style={{ width: `${width}%` }} />
          </div>
          <div className="category-chart-value"><strong className={moneyTone(item.total)}>{euro(item.total)}</strong><small>{percentage.toFixed(1)}%</small></div>
        </div>;
      })}
    </div> : <p className="muted">Nessun incasso presente nei risultati filtrati.</p>}
  </div>;
}

function IncomeVerticalBarChart({ title, description, data }: { title: string; description: string; data: Array<{ name: string; code: string; total: number }> }) {
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
            <div className="income-vertical-chart-bar" style={{ height: `${height}%` }} />
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

export default async function IncomesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
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

  const [incomes, expensesForVat, banks, paymentMethods] = await Promise.all([
    prisma.income.findMany({ where: { workspaceId: current.workspace.id }, include: { paymentMethodRef: true, creditBank: true }, orderBy: [{ creditDate: 'desc' }, { id: 'desc' }], take: 500 }),
    prisma.expense.findMany({ where: { workspaceId: current.workspace.id }, include: { payments: true }, take: 5000 }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } })
  ]);
  const orderedBanks = orderBanks(banks);
  const incomePaymentMethods = orderPaymentMethods(paymentMethods, 'INCOME');

  const creditDateFromFilter = useCreditDateFilter ? creditDateFromDefault : '';
  const creditDateToFilter = useCreditDateFilter ? creditDateToDefault : '';
  const billingPeriodFromFilter = useFiscalPeriodFilter ? (quickBillingPeriodRange?.from || inputDefault(filters, 'billingPeriodFrom') || inputDefault(filters, 'billingPeriod')) : '';
  const billingPeriodToFilter = useFiscalPeriodFilter ? (quickBillingPeriodRange?.to || inputDefault(filters, 'billingPeriodTo') || inputDefault(filters, 'billingPeriod')) : '';
  const rawBillingPeriodFromKey = monthInputToKey(billingPeriodFromFilter);
  const rawBillingPeriodToKey = monthInputToKey(billingPeriodToFilter);
  const { fromKey: billingPeriodFromKey, toKey: billingPeriodToKey } = normalizePeriodRange(rawBillingPeriodFromKey, rawBillingPeriodToKey);
  const hasBillingPeriodRange = billingPeriodFromKey !== null || billingPeriodToKey !== null;
  const salesChannelFilter = inputDefault(filters, 'salesChannel');
  const saleCategoryFilter = inputDefault(filters, 'saleCategory');
  const amountFilterRaw = inputDefault(filters, 'amount');
  const amountFilterValue = parseAmountFilter(amountFilterRaw);
  const paymentMethodFilter = inputDefault(filters, 'paymentMethod');
  const creditChannelFilter = inputDefault(filters, 'creditChannel');
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
  const fiscalTotalsHref = totalsFilterHref({ fiscal: 'yes' });
  const nonFiscalTotalsHref = totalsFilterHref({ fiscal: 'no' });
  const invoicesNotSentHref = totalsFilterHref({ invoiceStatus: 'NON_INVIATA' });

  const periodIncomes = incomes.filter(income => {
    if (!matchesIsoDate(income.creditDate, creditDateFromFilter, creditDateToFilter)) return false;
    if (!matchesBillingPeriod(income.billingMonth, income.billingYear, billingPeriodFromKey, billingPeriodToKey)) return false;
    return true;
  });

  const filteredIncomes = periodIncomes.filter(income => {
    if (!matchesIsoDate(income.creditDate, creditDateFromFilter, creditDateToFilter)) return false;
    if (!matchesBillingPeriod(income.billingMonth, income.billingYear, billingPeriodFromKey, billingPeriodToKey)) return false;
    if (salesChannelFilter && income.salesChannel !== salesChannelFilter) return false;
    if (saleCategoryFilter && income.saleCategory !== saleCategoryFilter) return false;
    if (!amountMatchesFilter(Number(income.amount.toString()), amountFilterValue)) return false;
    if (paymentMethodFilter && (income.paymentMethodRef?.name ?? income.paymentMethod) !== paymentMethodFilter) return false;
    if (creditChannelFilter && (income.creditBank?.name ?? income.creditChannel) !== creditChannelFilter) return false;
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
      if (income.invoiceStatus !== 'EMESSA') acc.invoicesNotSent += 1;
    } else acc.nonFiscal += amount;
    return acc;
  }, { total: 0, fiscal: 0, nonFiscal: 0, vatDebt: 0, invoicesNotSent: 0 });

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

  const incomesBySalesChannel = Array.from(filteredIncomes.reduce((map, income) => {
    const name = income.salesChannel ?? 'Senza canale';
    const code = String(name).split(/\s+/).map(part => part[0]).join('').slice(0, 5).toUpperCase() || 'CAN';
    const key = `${code}-${name}`;
    const current = map.get(key) ?? { name, code, total: 0 };
    current.total += Number(income.amount.toString());
    map.set(key, current);
    return map;
  }, new Map<string, { name: string; code: string; total: number }>()).values()).sort((a, b) => b.total - a.total);

  const incomesByFiscalStatus = Array.from(filteredIncomes.reduce((map, income) => {
    const name = income.isFiscal ? 'Dichiarato' : 'Non dichiarato';
    const code = income.isFiscal ? 'FISC' : 'NFISC';
    const key = `${code}-${name}`;
    const current = map.get(key) ?? { name, code, total: 0 };
    current.total += Number(income.amount.toString());
    map.set(key, current);
    return map;
  }, new Map<string, { name: string; code: string; total: number }>()).values()).sort((a, b) => b.total - a.total);

  let recoverableExpenseVat: number | null = null;
  if (hasBillingPeriodRange) {
    recoverableExpenseVat = expensesForVat.reduce((sum, expense) => {
      if (!matchesBillingPeriod(expense.month, expense.year, billingPeriodFromKey, billingPeriodToKey) || !expense.isDeclared) return sum;
      const amount = Number(expense.amount.toString());
      const paid = Math.min(amount, expense.payments.reduce((partial, payment) => partial + Number(payment.amount.toString()), 0));
      const vatRate = Number(expense.vatRate.toString());
      return sum + vatAmountFromGross(paid, vatRate);
    }, 0);
  }
  const residualVatDebt = recoverableExpenseVat === null ? null : totals.vatDebt - recoverableExpenseVat;

  const activeFilterItems = [
    creditDateFromDefault && { label: 'Data accredito da', value: formatDateInputLabel(creditDateFromDefault) },
    creditDateToDefault && { label: 'Data accredito a', value: formatDateInputLabel(creditDateToDefault) },
    billingPeriodFromFilter && { label: 'Periodo fatt. da', value: billingPeriodFromFilter },
    billingPeriodToFilter && { label: 'Periodo fatt. a', value: billingPeriodToFilter },
    salesChannelFilter && { label: 'Canale vendita', value: salesChannelFilter },
    saleCategoryFilter && { label: 'Categoria vendita', value: saleCategoryFilter },
    amountFilterRaw && { label: 'Importo', value: amountFilterRaw },
    paymentMethodFilter && { label: 'Metodo pagamento', value: paymentMethodFilter },
    creditChannelFilter && { label: 'Canale accredito', value: creditChannelFilter },
    fiscalFilter && { label: 'Fiscale', value: fiscalFilter === 'yes' ? 'Si' : 'No' },
    (invoiceStatusFilter || invoiceStatusModeFilter) && { label: 'Stato fattura', value: optionLabel(invoiceStatusOptions, invoiceStatusFilter || invoiceStatusModeFilter) },
    vatRateFilter && { label: 'IVA', value: `${vatRateFilter}%` }
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return <div className="grid">
    <NewIncomePanel
      initialOpen={inputDefault(filters, 'new') === '1'}
      banks={orderedBanks.map(bank => ({ id: bank.id, name: bank.name, isFallback: bank.isFallback }))}
      paymentMethods={incomePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback }))}
    />
    <IncomeEditModalController
      returnTo={listHref}
      banks={orderedBanks.map(bank => ({ id: bank.id, name: bank.name, isFallback: bank.isFallback }))}
      paymentMethods={incomePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback }))}
    />
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
            banks={orderedBanks.map(bank => ({ id: bank.id, name: bank.name }))}
            paymentMethods={incomePaymentMethods.map(method => ({ id: method.id, name: method.name }))}
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
              <tr><td>Entrate totali</td><td><strong className={badgeClass()}>{euro(totals.total)}</strong></td></tr>
              <tr><td>Incasso fiscale</td><td><Link href={fiscalTotalsHref}><strong className={moneyTone(totals.fiscal)}>{euro(totals.fiscal)}</strong></Link></td></tr>
              <tr><td>Incasso non fiscale</td><td><Link href={nonFiscalTotalsHref}><strong className={moneyTone(totals.nonFiscal)}>{euro(totals.nonFiscal)}</strong></Link></td></tr>
              <tr><td>Debito IVA prodotto</td><td><strong className={moneyTone(totals.vatDebt)}>{euro(totals.vatDebt)}</strong></td></tr>
              {/*<tr><td>Debito IVA residuo</td><td><strong>{residualVatDebt === null ? <span className="total-placeholder">Seleziona periodo fiscale</span> : <span className={moneyTone(residualVatDebt)}>{euro(residualVatDebt)}</span>}</strong></td></tr>*/}
              <tr><td>Fatture non inviate</td><td><Link href={invoicesNotSentHref}><strong>{totals.invoicesNotSent}</strong></Link></td></tr>
            </tbody>
          </table>
        </div>
        <IncomeVerticalBarChart title="Entrate per canale di vendita" description="Distribuzione degli incassi sui risultati filtrati." data={incomesBySalesChannel} />
      </div>

      {activeFilterItems.length ? <div className="recurring-active-filters">
        <div>
          <span className="recurring-active-filters-title">Filtri attivi</span>
          <div className="recurring-active-filter-tags">
            {activeFilterItems.map(item => <span className="badge" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>)}
          </div>
        </div>
        <Link className="table-action secondary recurring-active-filters-reset reset-button" href="/incomes">↺ Reset</Link>
      </div> : null}

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
            banks={orderedBanks.map(bank => ({ id: bank.id, name: bank.name }))}
            paymentMethods={incomePaymentMethods.map(method => ({ id: method.id, name: method.name }))}
          />
        </div>
      </div>

      <BulkSelectionController />

      <script dangerouslySetInnerHTML={{ __html: `
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
            if (value === 'this_month') return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
            return null;
          };
          quick.addEventListener('change', () => { const range = computeRange(quick.value); if (!range) return; from.value = range.from; to.value = range.to; ['incomeBillingPeriodFrom','incomeBillingPeriodTo','incomeBillingPeriodQuick'].forEach(id => { const field = document.getElementById(id); if (field) field.value = ''; }); });
          [from, to].forEach((field) => field.addEventListener('change', () => { quick.value = ''; ['incomeBillingPeriodFrom','incomeBillingPeriodTo','incomeBillingPeriodQuick'].forEach(id => { const f = document.getElementById(id); if (f) f.value = ''; }); }));
          ['incomeBillingPeriodFrom','incomeBillingPeriodTo','incomeBillingPeriodQuick'].forEach((id) => { const field = document.getElementById(id); if (field) field.addEventListener('change', () => { ['creditDateFrom','creditDateTo','incomeDateQuick'].forEach(otherId => { const other = document.getElementById(otherId); if (other) other.value = ''; }); }); });
        })();
      ` }} />


      <form id="incomeBulkForm" action={`/api/incomes/bulk?returnTo=${returnTo}`} method="post" className="bulk-actions-bar confirm-bulk-form">
        <label className="bulk-select-all-inline">
          <input type="checkbox" className="bulk-select-all" data-bulk-target="incomeBulkForm" aria-label="Seleziona tutti gli incassi visibili" />
          {/*<span>Seleziona tutti</span>*/}
        </label>
        <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form="incomeBulkForm">
          <summary className="bulk-action-trigger">
            <span className="btn-icon">⚙</span>
            <span className="bulk-label">
              <span className="floating-bulk-label">Bulk </span>Actions</span>
          </summary>
          <div className="bulk-action-menu-panel">
            <button type="submit" name="bulkAction" value="invoice_emitted"><span className="btn-icon">✓</span><span className="bulk-label">Fattura emessa</span></button>
            <BulkChangeCategoryModal
              formId="incomeBulkForm"
              action={`/api/incomes/bulk?returnTo=${returnTo}`}
              fieldName="saleCategory"
              categories={saleCategoryOptions.map(category => ({ value: category, label: category, icon: saleCategoryStyles[category]?.icon }))}
              selectLabel="Categoria vendita"
            />
          </div>
        </details>
        <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form="incomeBulkForm" data-edit-base="/incomes/" data-copy-base="/incomes/new?copyId=" data-edit-trigger-attr="data-income-edit-id" data-copy-trigger-attr="data-income-copy-id" data-return-to={returnTo}>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true"><span className="btn-icon">✎</span><span className="bulk-label">Modifica</span></a>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-copy aria-disabled="true"><span className="btn-icon">⧉</span><span className="bulk-label">Copia</span></a>
          <button type="submit" className="bulk-direct-link bulk-direct-danger" name="bulkAction" value="delete" data-bulk-delete data-confirm-label="Elimina" disabled><span className="btn-icon">🗑</span><span className="bulk-label">Elimina</span></button>
        </div>
        <div className="bulk-inner-container">
          <button className="bulk-direct-link button-standard primary-action" type="button" data-bulk-new data-income-new data-floating-label="Incasso">
            <span className="btn-icon">+</span>
            <span className="bulk-label">Incasso</span>
          </button>
        </div>
      </form>

      <div className="income-mobile-list expense-mobile-list" aria-label="Lista incassi mobile">
        {filteredIncomes.map(income => {
          const salesStyle = salesChannelStyles[income.salesChannel];
          const catStyle = saleCategoryStyles[income.saleCategory];
          const incomePaymentMethodName = income.paymentMethodRef?.name ?? income.paymentMethod;
          const incomeCreditChannelName = income.creditBank?.name ?? income.creditChannel;
          const paymentStyle = paymentMethodStyles[incomePaymentMethodName];
          const creditStyle = creditChannelStyles[incomeCreditChannelName];
          const invoiceStyle = incomeInvoiceStatusStyles[income.invoiceStatus || 'NONE'] ?? incomeInvoiceStatusStyles.NONE;
          const creditStatus = incomeCreditStatus(income);
          const creditOverdue = isIncomeCreditOverdue(income);
          const vatStyle = vatStyles[String(Number(income.vatRate.toString()))] ?? vatStyles['0'];
          const amount = Number(income.amount.toString());
          const detailHref = `/incomes/${income.id}?returnTo=${returnTo}`;
          const recordClass = [
            'income-mobile-item',
            'expense-mobile-item',
            creditOverdue ? 'expense-mobile-item-overdue' : !income.isCredited || income.invoiceStatus === 'NON_INVIATA' ? 'income-row-warning' : ''
          ].filter(Boolean).join(' ');

          return <div className={recordClass} key={`mobile-income-${income.id}`}>
            <div className="expense-mobile-select">
              <input form="incomeBulkForm" type="checkbox" name="ids" value={income.id} aria-label={`Seleziona incasso ${income.id}`} />
            </div>
            <Link className="expense-mobile-link income-mobile-link" href={detailHref}>
              <div className="expense-mobile-main">
                <div className="expense-mobile-header">
                  <div className="left-side">
                    <span title={income.saleCategory} className={`${badgeClass(catStyle?.className)} income-badge-compact`}>{catStyle?.icon ?? '•'} {income.saleCategory}</span>
                    {fiscalBadge(income.isFiscal)}
                    <span className="text-pre">{formatPeriod(income.billingMonth, income.billingYear)}</span>
                    <span title={invoiceStyle.label} className={`${badgeClass(invoiceStyle.className)} income-badge-compact`}>{invoiceStyle.icon} {invoiceStyle.label}</span>
                  </div>
                  <div className="right-side">
                    <span className="text-pre">{mobileDateLabel(income.creditDate)}</span>
                  </div>
                </div>
                <div className="expense-mobile-title-row">
                  <div className="left-side">
                    <strong>{income.salesChannel}</strong>
                    <span className={badgeClass(vatStyle.className)}>IVA {Number(income.vatRate.toString())}%</span>
                  </div>
                  <div className="right-side">
                    <span>{paymentStyle?.icon ?? '•'}</span>
                    <span className={moneyTone(amount)}>{euro(income.amount.toString())}</span>
                  </div>
                </div>
                <div className="expense-mobile-title-row">
                  <div className="expense-mobile-subtitle">{income.description ? `${income.description}` : ''}</div>
                  <span title={creditStatus.label} className={`${badgeClass(creditStatus.className)} income-badge-compact`}>{creditStatus.icon} {creditStatus.label}</span>
                </div>

                {/*<div className="expense-mobile-meta">*/}
                {/*  <span>{income.paymentMethod}</span>*/}
                {/*  <span>{formatPeriod(income.billingMonth, income.billingYear)}</span>*/}
                {/*  <span>{income.creditChannel}</span>*/}
                {/*</div>*/}
                {/*<div className="expense-mobile-badges">*/}
                  {/*<span title={income.salesChannel} className={`${badgeClass(salesStyle?.className)} income-badge-compact`}>{salesStyle?.icon ?? '•'} {income.salesChannel}</span>*/}
                {/*</div>*/}
                {/*<div className="expense-mobile-footer">*/}
                {/*  <span className={badgeClass(paymentStyle?.className)}>{paymentStyle?.icon ?? '•'} {income.paymentMethod}</span>*/}
                {/*  <span className={badgeClass(creditStyle?.className)}>{creditStyle?.icon ?? '•'} {income.creditChannel}</span>*/}
                  {/*<span className={badgeClass(vatStyle.className)}>IVA {Number(income.vatRate.toString())}%</span>*/}
                {/*</div>*/}
              </div>
            </Link>
          </div>;
        })}
        {!filteredIncomes.length && <div className="expense-empty-panel">Nessun incasso trovato con i filtri selezionati.</div>}
      </div>

      <div className="table-scroll incomes-table-scroll"><table className="expenses-table incomes-table compact-incomes-table"><colgroup>
        <col className="cell-option" />
        <col className="cell-billing-period" />
        <col className="cell-order-date" />
        <col className="cell-selling" />
        <col className="cell-fiscal" />
        <col className="cell-category" />
        <col className="cell-description" />
        <col className="cell-amount" />
        <col className="cell-amount" />
        <col className="cell-supplier" />
        <col className="cell-cchannel" />
        <col className="cell-invoice-state" />
        <col className="cell-invoice-state" />
      </colgroup><thead><tr>
        <th className="cell-option"><input type="checkbox" className="bulk-select-all" data-bulk-target="incomeBulkForm" aria-label="Seleziona tutti gli incassi" /></th>
        <th className="cell-billing-period"><span className="th-wrap">Periodo<br />Fatt.</span></th>
        <th className="cell-order-date"><span className="th-wrap">Data<br />accr.</span></th>
        <th className="cell-selling"><span className="th-wrap">Canale<br />vendita</span></th>
        <th className="cell-fiscal">Fisc.</th>
        <th className="cell-category">Cat.</th>
        <th className="cell-description">Descrizione</th>
        <th className="cell-amount">Importo</th>
        <th className="cell-amount">IVA</th>
        <th className="cell-supplier"><span className="th-wrap">Metodo<br />pag.</span></th>
        <th className="cell-cchannel"><span className="th-wrap">Canale<br />accr.</span></th>
        <th className="cell-invoice-state">Accr.</th>
        <th className="cell-invoice-state"><span className="th-wrap">Stato<br />fatt.</span></th>
        {/*<th className="cell-center"><span className="sr-only">Elimina</span></th>*/}
      </tr></thead><tbody>
        {filteredIncomes.map(income => {
          const salesStyle = salesChannelStyles[income.salesChannel];
          const catStyle = saleCategoryStyles[income.saleCategory];
          const incomePaymentMethodName = income.paymentMethodRef?.name ?? income.paymentMethod;
          const incomeCreditChannelName = income.creditBank?.name ?? income.creditChannel;
          const paymentStyle = paymentMethodStyles[incomePaymentMethodName];
          const creditStyle = creditChannelStyles[incomeCreditChannelName];
          const invoiceStyle = incomeInvoiceStatusStyles[income.invoiceStatus || 'NONE'] ?? incomeInvoiceStatusStyles.NONE;
          const creditStatus = incomeCreditStatus(income);
          const creditOverdue = isIncomeCreditOverdue(income);
          const vatStyle = vatStyles[String(Number(income.vatRate.toString()))] ?? vatStyles['0'];
          return <tr className={['clickable-desktop-row', creditOverdue ? 'income-row-overdue' : !income.isCredited || income.invoiceStatus === 'NON_INVIATA' ? 'income-row-warning' : ''].filter(Boolean).join(' ')} data-row-href={`/incomes/${income.id}?returnTo=${returnTo}`} tabIndex={0} key={income.id}>
            <td className="cell-option"><input form="incomeBulkForm" type="checkbox" name="ids" value={income.id} aria-label={`Seleziona incasso ${income.id}`} /></td>
            <td className="cell-billing-period">{formatPeriod(income.billingMonth, income.billingYear)}</td>
            <td className="cell-order-date">{dateLabel(income.creditDate)}</td>
            <td className="cell-selling"><span title={income.salesChannel} className={`${badgeClass(salesStyle?.className)} income-badge-compact`}>{salesStyle?.icon ?? '•'} {income.salesChannel}</span></td>
            <td className="cell-fiscal">{fiscalBadge(income.isFiscal)}</td>
            <td className="cell-category"><span title={income.saleCategory} className={`${badgeClass(catStyle?.className)} income-badge-compact`}>{catStyle?.icon ?? '•'} {income.saleCategory}</span></td>
            <td className="cell-description" title={income.description ?? ''}>{income.description ?? '-'}</td>
            <td className="cell-amount"><strong className={moneyTone(Number(income.amount.toString()))}>{euro(income.amount.toString())}</strong></td>
            <td className="cell-amount"><span className={`${badgeClass(vatStyle.className)} income-badge-compact`}>{Number(income.vatRate.toString())}%</span></td>
            <td className="cell-supplier"><span title={incomePaymentMethodName} className={`${badgeClass(paymentStyle?.className)} income-badge-compact`}>{paymentStyle?.icon ?? '•'} {incomePaymentMethodName}</span></td>
            <td className="cell-cchannel"><span title={incomeCreditChannelName} className={`${badgeClass(creditStyle?.className)} income-badge-compact`}>{creditStyle?.icon ?? '•'} {incomeCreditChannelName}</span></td>
            <td className="cell-invoice-state"><span title={creditStatus.label} className={`${badgeClass(creditStatus.className)} income-badge-compact`}>{creditStatus.icon} {creditStatus.label}</span></td>
            <td className="cell-invoice-state"><span title={invoiceStyle.label} className={`${badgeClass(invoiceStyle.className)} income-badge-compact`}>{invoiceStyle.icon} {invoiceStyle.label}</span></td>
            {/*<td className="cell-center"><DeleteActionButton action={`/api/incomes/${income.id}?returnTo=${returnTo}`} confirmMessage="Confermi la rimozione dell’incasso? L’operazione non può essere annullata." /></td>*/}
          </tr>;
        })}
        {!filteredIncomes.length && <tr><td colSpan={13}>Nessun incasso trovato con i filtri selezionati.</td></tr>}
      </tbody></table></div>
    </div>
    <div className="card expenses-list-card">
      <div className="charts-grid">
        <IncomeBreakdownChart title="Entrate per canale di vendita" description="Distribuzione degli incassi sui risultati filtrati." data={incomesBySalesChannel} />
        <IncomeBreakdownChart title="Grafico entrate dichiarate" description="Distribuzione degli incassi fiscali e non fiscali sui risultati filtrati." data={incomesByFiscalStatus} />
      </div>
    </div>
  </div>;
}
