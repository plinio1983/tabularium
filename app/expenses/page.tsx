import Link from 'next/link';
import BulkSelectionController from '@/components/BulkSelectionController';
import { prisma } from '@/lib/prisma';
import { euro, moneyTone } from '@/lib/money';
import NewExpensePanel from '@/components/NewExpensePanel';
import ExpenseEditModalController from '@/components/ExpenseEditModalController';
import ExpenseFiltersDrawer from '@/components/ExpenseFiltersDrawer';
import ExpenseTrendSelectors from '@/components/ExpenseTrendSelectors';
import SupplierFilterInput from '@/components/SupplierFilterInput';
import { requireWorkspace } from '@/lib/auth';
import {
  badgeClass,
  categoryStyles,
  formatPeriod,
  invoiceStatusStyles,
  paymentStatusStyles,
  yesNoStyles
} from '@/lib/expense-ui';

const allowedBankOrder = ['MyTu', 'Unicredit', 'Wise', 'Altra Banca'];
const allowedCategoryOrder = [
  'Servizi Bancari',
  'Assicurazioni',
  'Affitti/Utenze',
  'Servizi Web',
  'Spedizioni/Corrieri',
  'Tasse/Imposte',
  'Altri Servizi',
  'Merce/Forniture',
  'Articoli di Supporto',
  'Prestazioni/Dipendenti',
  'Rateizzazione'
];

const paymentStatusOptions = [
  ['overdue', 'Scaduto'],
  ['DA_PAGARE', 'Non pagato'],
  ['COMPLETATO', 'Completato'],
  ['PAGATO_PARZIALMENTE', 'Pagato parzialmente']
];

const invoiceStatusOptions = [
  ['NON_PREVISTA', 'Non prevista'],
  ['IN_ATTESA', 'In attesa'],
  ['CONTESTAZIONE', 'Contestazione'],
  ['RICEVUTA', 'Emessa']
];

const invoiceStatusFilterLabels = [
  ...invoiceStatusOptions,
  ['not_received', 'Fatture non ricevute']
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
  orderDateFromDefault,
  orderDateToDefault,
}: {
  useFiscalPeriodFilter: boolean;
  billingPeriodFromFilter: string;
  billingPeriodToFilter: string;
  orderDateFromDefault: string;
  orderDateToDefault: string;
}) {
  if (useFiscalPeriodFilter) {
    if (billingPeriodFromFilter && billingPeriodToFilter && billingPeriodFromFilter !== billingPeriodToFilter) {
      return `Totali periodo fiscale dal ${formatMonthInputLabel(billingPeriodFromFilter)} al ${formatMonthInputLabel(billingPeriodToFilter)}`;
    }
    const value = billingPeriodFromFilter || billingPeriodToFilter;
    return value ? `Totali periodo fiscale ${formatMonthInputLabel(value)}` : 'Totali periodo fiscale selezionato';
  }

  if (orderDateFromDefault && orderDateToDefault && orderDateFromDefault !== orderDateToDefault) {
    return `Totali andamento\n dal ${formatDateTextInputLabel(orderDateFromDefault)} al ${formatDateTextInputLabel(orderDateToDefault)}`;
  }
  const value = orderDateFromDefault || orderDateToDefault;
  return value ? `Totali andamento ${formatDateTextInputLabel(value)}` : 'Totali andamento date selezionate';
}

function booleanBadge(value: boolean) {
  const item = value ? yesNoStyles.yes : yesNoStyles.no;
  return <span className={badgeClass(item.className)}>{item.icon} {item.label}</span>;
}
function fiscalBadge(value: boolean) {
  const item = value ? yesNoStyles.yes : yesNoStyles.no;
  const label = value ? 'Fisc.' : 'N.F.';
  return <span className={badgeClass(item.className)}>{label}</span>;
}
function fiscalBadgeMobile(value: boolean) {
  const item = value ? { className: '' } : yesNoStyles.no;
  const label = value ? 'DF' : 'NF';
  return <span className={badgeClass(item.className)}>{label}</span>;
}
function electronicInvoiceBadge(value: boolean, invoiceStatus?: string) {
  const style = invoiceStatus ? (invoiceStatusStyles[invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA) : yesNoStyles.yes;
  let state = invoiceStatus;
  if (invoiceStatus === "IN_ATTESA") {
    state = ""//' Wait';
  }
  if (invoiceStatus === "RICEVUTA") {
    state = ' Ok';
  }
  const label = !value ? 'Fatt' : '@bill';
  return <span className={badgeClass(style.className)}>{label}{state}</span>;
}
function InvoiceBadge(value: boolean, invoiceStatus?: string) {
  const style = invoiceStatus ? (invoiceStatusStyles[invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA) : yesNoStyles.yes;
  const label = (status?: string) => {
    let label = "";
    if (!value) {
      label = status === 'NON_PREVISTA' ? 'N.P.' : 'Fatt';
    } else {
      label = "@bill"
    }
    return label;
  }
  return <span className={badgeClass(style.className)}>{label(invoiceStatus)}</span>;
}
function ActiveFilterSummary({ items }: { items: Array<{ label: string; value: string }> }) {
  return <div className="active-filter-summary">
    <span className="active-filter-summary-title">Filtri attivi:</span>
    {items.length ? items.map(item => <span className="active-filter-chip" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>) : <span className="active-filter-empty">nessun filtro impostato</span>}
    <Link className="button-standard secondary-action reset-btn" href="/expenses"><span className="">↺</span> Reset</Link>
  </div>;
}

function optionLabel(options: Array<string[]>, value: string) {
  return options.find(option => option[0] === value)?.[1] ?? value;
}


function ExpenseCategoryChart({ data }: { data: Array<{ name: string; code: string; total: number }> }) {
  const max = Math.max(...data.map(item => item.total), 0);
  const total = data.reduce((sum, item) => sum + item.total, 0);

  return <div className="card expense-category-chart-card embedded-chart-card">
    <div className="card-heading-row">
      <div>
        <h2>Grafico spese per categoria</h2>
        <p className="muted">Distribuzione delle spese in base ai risultati attualmente filtrati.</p>
      </div>
      <span className="badge">Totale {euro(total)}</span>
    </div>
    {data.length ? <div className="category-chart-list">
      {data.map(item => {
        const percentage = total ? (item.total / total) * 100 : 0;
        const width = max ? Math.max((item.total / max) * 100, 4) : 0;
        return <div className="category-chart-row" key={`${item.code}-${item.name}`}>
          <div className="category-chart-label"><strong>{item.code}</strong><span>{item.name}</span></div>
          <div className="category-chart-bar-wrap" aria-label={`${item.name}: ${euro(item.total)}`}>
            <div className="category-chart-bar" style={{ width: `${width}%` }} />
          </div>
          <div className="category-chart-value"><strong className={moneyTone(item.total)}>{euro(item.total)}</strong><small>{percentage.toFixed(1)}%</small></div>
        </div>;
      })}
    </div> : <p className="muted">Nessuna spesa presente nei risultati filtrati.</p>}
  </div>;
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


function expenseSupplierName(expense: { supplier?: { businessName?: string | null } | null; merchant?: string | null }) {
  return expense.supplier?.businessName || expense.merchant || '-';
}

function expenseResidualAmount(expense: { amount: unknown; payments?: Array<{ amount: unknown }> }) {
  const expenseAmount = Number(expense.amount);
  const paidAmount = (expense.payments ?? []).reduce((partial, payment) => partial + Number(payment.amount), 0);
  return Math.max(expenseAmount - paidAmount, 0);
}

function isExpenseOverdue(expense: any) {
  return expenseResidualAmount(expense) > 0;
}

function isExpensePastDueForBadge(expense: any) {
  if (!expense.dueDate) return false;
  if (expenseResidualAmount(expense) <= 0) return false;
  const due = new Date(expense.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}


function vatAmountFromGross(amount: number, vatRate: number) {
  if (!vatRate) return 0;
  return amount * (vatRate / (100 + vatRate));
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currentMonthStart() {
  const now = new Date();
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
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

  return {
    from: toDateInputValue(new Date(year, month, 1)),
    to: toDateInputValue(new Date(year, month + 1, 0))
  };
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
  ["quarter_1", "T.1 [ Gen - Mar ]"],
  ["quarter_2", "T.2 [ Apr - Giu ]"],
  ["quarter_3", "T.3 [ Lug - Set ]"],
  ["quarter_4", "T.4 [ Ott - Dic ]"],
];

const quickDateOptions = [
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

  if (value === 'previous_month') {
    return { from: toMonthInputValue(year, month - 1), to: toMonthInputValue(year, month - 1) };
  }

  if (value === 'current_quarter') {
    return { from: toMonthInputValue(year, currentQuarter * 3), to: toMonthInputValue(year, currentQuarter * 3 + 2) };
  }

  if (value === 'previous_quarter') {
    const quarter = currentQuarter - 1;
    return quarter >= 0
      ? { from: toMonthInputValue(year, quarter * 3), to: toMonthInputValue(year, quarter * 3 + 2) }
      : { from: toMonthInputValue(year - 1, 9), to: toMonthInputValue(year - 1, 11) };
  }

  return { from: toMonthInputValue(year, month), to: toMonthInputValue(year, month) };
}

const quickBillingPeriodOptions = [
  ...monthQuickOptions,
  ...quarterQuickOptions
];

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

export default async function ExpensesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/expenses');
  const filters = (await searchParams) ?? {};
  const currentQuery = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach(item => item && currentQuery.append(key, item));
    else if (value) currentQuery.set(key, value);
  });
  const currentQueryString = currentQuery.toString();
  const listHref = `/expenses${currentQueryString ? `?${currentQueryString}` : ''}`;
  const returnTo = encodeURIComponent(listHref);
  const hasAnyFilter = Object.keys(filters).length > 0;
  const hasFiscalPeriodFilter = Boolean(inputDefault(filters, 'billingPeriodFrom') || inputDefault(filters, 'billingPeriodTo') || inputDefault(filters, 'period') || inputDefault(filters, 'billingPeriodQuick'));
  const hasOrderDateFilter = Boolean(inputDefault(filters, 'orderDateFrom') || inputDefault(filters, 'orderDateTo') || inputDefault(filters, 'dateQuick'));
  const dateYearFilter = inputDefault(filters, 'dateYear');
  const billingPeriodYearFilter = inputDefault(filters, 'billingPeriodYear');
  const useFiscalPeriodFilter = hasFiscalPeriodFilter;
  const useOrderDateFilter = !useFiscalPeriodFilter;
  const rawDateQuickFilter = useOrderDateFilter ? inputDefault(filters, 'dateQuick') : '';
  const hasCustomOrderDateFilter = useOrderDateFilter && !rawDateQuickFilter && Boolean(inputDefault(filters, 'orderDateFrom') || inputDefault(filters, 'orderDateTo'));
  const quickDateFilter = useOrderDateFilter ? (rawDateQuickFilter || (!hasAnyFilter && !hasOrderDateFilter ? currentMonthQuickValue() : '')) : '';
  const dateQuickSelectorValue = hasCustomOrderDateFilter ? 'custom' : quickDateFilter;
  const quickDateRange = quickDateFilter ? getQuickDateRange(quickDateFilter, dateYearFilter) : null;
  const orderDateFromDefault = useOrderDateFilter ? (quickDateRange?.from || inputDefault(filters, 'orderDateFrom') || (!hasAnyFilter ? currentMonthStart() : '')) : '';
  const orderDateToDefault = useOrderDateFilter ? (quickDateRange?.to || inputDefault(filters, 'orderDateTo')) : '';
  const quickBillingPeriodFilter = useFiscalPeriodFilter ? (inputDefault(filters, 'billingPeriodQuick') || '') : '';
  const quickBillingPeriodRange = quickBillingPeriodFilter ? getQuickBillingPeriodRange(quickBillingPeriodFilter, billingPeriodYearFilter) : null;

  const [expenses, categories, banks, suppliers] = await Promise.all([
    prisma.expense.findMany({
      where: { workspaceId: current.workspace.id },
      include: { category: true, bank: true, supplier: true, payments: { include: { bank: true } }, attachments: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { receivedDate: 'desc' }],
      take: 500
    }),
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  const orderedBanks = allowedBankOrder
    .map(name => banks.find(bank => bank.name === name))
    .filter(Boolean) as typeof banks;

  const orderedCategories = allowedCategoryOrder
    .map(name => categories.find(category => category.name === name))
    .filter(Boolean) as typeof categories;

  const billingPeriodFromFilter = useFiscalPeriodFilter ? (quickBillingPeriodRange?.from || inputDefault(filters, 'billingPeriodFrom') || inputDefault(filters, 'period')) : '';
  const billingPeriodToFilter = useFiscalPeriodFilter ? (quickBillingPeriodRange?.to || inputDefault(filters, 'billingPeriodTo') || inputDefault(filters, 'period')) : '';
  const rawBillingPeriodFromKey = monthInputToKey(billingPeriodFromFilter);
  const rawBillingPeriodToKey = monthInputToKey(billingPeriodToFilter);
  const { fromKey: billingPeriodFromKey, toKey: billingPeriodToKey } = normalizePeriodRange(rawBillingPeriodFromKey, rawBillingPeriodToKey);
  const orderDateFromFilter = useOrderDateFilter ? orderDateFromDefault : '';
  const orderDateToFilter = useOrderDateFilter ? orderDateToDefault : '';
  const categoryFilter = inputDefault(filters, 'category');
  const merchantFilter = normalize(inputDefault(filters, 'merchant'));
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

  const periodExpenses = expenses.filter(expense => {
    if (!matchesBillingPeriod(expense.month, expense.year, billingPeriodFromKey, billingPeriodToKey)) return false;
    if (!matchesIsoDate(expense.receivedDate, orderDateFromFilter, orderDateToFilter)) return false;
    return true;
  });

  const filteredExpenses = periodExpenses.filter(expense => {
    const amount = Number(expense.amount.toString());
    const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
    const residual = Math.max(0, amount - paid);

    if (!matchesBillingPeriod(expense.month, expense.year, billingPeriodFromKey, billingPeriodToKey)) return false;
    if (!matchesIsoDate(expense.receivedDate, orderDateFromFilter, orderDateToFilter)) return false;
    if (categoryFilter && expense.category?.name !== categoryFilter) return false;
    if (merchantFilter && !normalize(expenseSupplierName(expense)).includes(merchantFilter)) return false;
    if (productFilter && !normalize(expense.description).includes(productFilter)) return false;
    if (!amountMatchesFilter(amount, amountFilterValue)) return false;
    if (paymentStatusFilter === 'not_complete' && expense.paymentStatus === 'COMPLETATO') return false;
    if (paymentStatusFilter === 'overdue' && !isExpensePastDueForBadge(expense)) return false;
    if (paymentStatusFilter && !['not_complete', 'overdue'].includes(paymentStatusFilter) && expense.paymentStatus !== paymentStatusFilter) return false;
    if (residualFilter === 'open' && residual <= 0) return false;
    if (residualFilter === 'closed' && residual > 0) return false;
    if (electronicInvoiceFilter === 'yes' && !expense.hasElectronicInvoice) return false;
    if (electronicInvoiceFilter === 'no' && expense.hasElectronicInvoice) return false;
    if (invoiceStatusModeFilter === 'not_received' && ['RICEVUTA', 'INVIATA_SDI'].includes(String(expense.invoiceStatus))) return false;
    if (invoiceStatusFilter === 'not_received' && ['RICEVUTA', 'INVIATA_SDI'].includes(String(expense.invoiceStatus))) return false;
    if (invoiceStatusFilter && invoiceStatusFilter !== 'not_received' && expense.invoiceStatus !== invoiceStatusFilter) return false;
    if (declaredFilter === 'yes' && !expense.isDeclared) return false;
    if (declaredFilter === 'no' && expense.isDeclared) return false;
    if (attachmentsFilter === 'with' && expense.attachments.length === 0) return false;
    if (attachmentsFilter === 'without' && expense.attachments.length > 0) return false;

    return true;
  });

  const summarizeExpenses = (list: typeof expenses) => list.reduce((acc, expense) => {
    const amount = Number(expense.amount.toString());
    const vatRate = Number(expense.vatRate.toString());
    const paid = Math.min(amount, expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0));
    const residualAmount = Math.max(0, amount - paid);
    const overdueResidualAmount = isExpensePastDueForBadge(expense) ? residualAmount : 0;

    acc.total += amount;
    acc.paidVat += vatAmountFromGross(paid, vatRate);
    acc.toPay += residualAmount;
    acc.overdue += overdueResidualAmount;
    if (isExpensePastDueForBadge(expense)) acc.overdueCount += 1;
    if (expense.isDeclared) {
      acc.declared += amount;
      if (!['RICEVUTA', 'INVIATA_SDI'].includes(String(expense.invoiceStatus))) acc.invoicesNotReceived += 1;
    } else {
      acc.nonDeclared += amount;
    }
    return acc;
  }, { total: 0, paidVat: 0, declared: 0, nonDeclared: 0, toPay: 0, overdue: 0, overdueCount: 0, invoicesNotReceived: 0 });

  const totals = summarizeExpenses(filteredExpenses);
  const totalsPeriodLabel = periodTotalsLabel({
    useFiscalPeriodFilter,
    billingPeriodFromFilter,
    billingPeriodToFilter,
    orderDateFromDefault,
    orderDateToDefault
  });

  const mobileSortedExpenses = [...filteredExpenses].sort((a, b) => {
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : -Infinity;
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : -Infinity;
    return bTime - aTime;
  });

  const expensesByCategory = Array.from(filteredExpenses.reduce((map, expense) => {
    const name = expense.category?.name ?? 'Senza categoria';
    const code = expense.category?.code ?? 'ND';
    const key = `${code}-${name}`;
    const current = map.get(key) ?? { name, code, total: 0 };
    current.total += Number(expense.amount.toString());
    map.set(key, current);
    return map;
  }, new Map<string, { name: string; code: string; total: number }>()).values()).sort((a, b) => b.total - a.total);

  const activeFilterItems = [
    orderDateFromDefault && { label: 'Data ordine da', value: formatDateInputLabel(orderDateFromDefault) },
    orderDateToDefault && { label: 'Data ordine a', value: formatDateInputLabel(orderDateToDefault) },
    billingPeriodFromFilter && { label: 'Periodo fatt. da', value: billingPeriodFromFilter },
    billingPeriodToFilter && { label: 'Periodo fatt. a', value: billingPeriodToFilter },
    categoryFilter && { label: 'Categoria', value: categoryFilter },
    inputDefault(filters, 'merchant') && { label: 'Esercente', value: inputDefault(filters, 'merchant') },
    inputDefault(filters, 'product') && { label: 'Descrizione', value: inputDefault(filters, 'product') },
    amountFilterRaw && { label: 'Importo', value: amountFilterRaw },
    paymentStatusFilter && { label: 'Stato pagamento', value: optionLabel(paymentStatusOptions, paymentStatusFilter) },
    residualFilter && { label: 'Residuo', value: residualFilter === 'open' ? 'Con residuo' : 'Saldato' },
    electronicInvoiceFilter && { label: 'Fattura elettronica', value: electronicInvoiceFilter === 'yes' ? 'Si' : 'No' },
    (invoiceStatusFilter || invoiceStatusModeFilter) && { label: 'Stato fattura', value: optionLabel(invoiceStatusFilterLabels, invoiceStatusFilter || invoiceStatusModeFilter) },
    declaredFilter && { label: 'Detrazione', value: declaredFilter === 'yes' ? 'Fiscale' : 'Non Fisc.' },
    attachmentsFilter && { label: 'Allegati', value: attachmentsFilter === 'with' ? 'Con allegati' : 'Senza allegati' }
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return <div className="grid">
    {/*<Link className="button-standard secondary-action" href="/recurring-expenses"><span className="btn-icon">↻</span>Spese ricorrenti</Link>*/}
    <NewExpensePanel
      categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name }))}
      suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, phone: s.phone, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes }))}
      initialOpen={inputDefault(filters, 'new') === '1'}
    />

    <div className="card expenses-list-card">
      <ExpenseTrendSelectors
        dateQuick={dateQuickSelectorValue}
        billingPeriodQuick={quickBillingPeriodFilter}
        dateYear={dateYearFilter}
        billingPeriodYear={billingPeriodYearFilter}
        useFiscalPeriodFilter={useFiscalPeriodFilter}
      />

      <div className="dashboard-statement-panel list-totals-statement">
        <p className="totals-period-note">{totalsPeriodLabel}</p>
        <table className="dashboard-statement-table list-totals-table" aria-label="Totali spese filtrate">
          <tbody>
            {/*<tr><td>Spese totali IVA inclusa</td><td><strong className={moneyTone(totals.total)}>{euro(totals.total)}</strong></td></tr>*/}
            <tr><td>Spese totali IVA inclusa</td><td><strong className={badgeClass()}>{euro(totals.total)}</strong></td></tr>
            <tr><td>Spese non dichiarate</td><td><strong className={moneyTone(totals.nonDeclared)}>{euro(totals.nonDeclared)}</strong></td></tr>
            <tr className={totals.toPay > 0 ? 'list-totals-row-warning row-warning' : ''}><td>Non saldato</td><td><strong className={moneyTone(totals.toPay)}>{euro(totals.toPay)}</strong></td></tr>
            <tr><td>IVA versata</td><td><strong className={moneyTone(totals.paidVat)}>{euro(totals.paidVat)}</strong></td></tr>
            <tr className={totals.invoicesNotReceived > 0 ? 'list-totals-row-warning row-warning' : ''}><td>Fatture non ricevute</td><td><strong className="text-warning">{totals.invoicesNotReceived}</strong></td></tr>
            <tr className={totals.overdueCount > 0 ? 'list-totals-row-critical row-critical' : ''}><td>Pagamenti scaduti</td><td><strong className="text-warning">{totals.overdueCount}</strong></td></tr>
          </tbody>
        </table>
      </div>

      <div className="list-heading recurring-list-heading">
        <div>
          <h2>Lista spese</h2>
          <p className="muted">Risultati mostrati: {filteredExpenses.length}</p>
        </div>
        <div>
          <ExpenseFiltersDrawer
            filters={filters}
            categories={orderedCategories.map(category => ({ id: category.id, code: category.code, name: category.name }))}
            quickDateFilter={quickDateFilter}
            orderDateFromDefault={orderDateFromDefault}
            orderDateToDefault={orderDateToDefault}
            quickBillingPeriodFilter={quickBillingPeriodFilter}
            billingPeriodFromFilter={billingPeriodFromFilter}
            billingPeriodToFilter={billingPeriodToFilter}
          />
        </div>
      </div>

      {activeFilterItems.length ? <div className="recurring-active-filters">
        <div>
          <span className="recurring-active-filters-title">Filtri attivi</span>
          <div className="recurring-active-filter-tags">
            {activeFilterItems.map(item => <span className="badge" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>)}
          </div>
        </div>
        <Link className="table-action secondary recurring-active-filters-reset reset-button" href="/expenses">↺ Reset</Link>
      </div> : null}

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
          const storageKey = 'dmsAccounting.expenses.filters';
          const resetLink = document.querySelector('a[href="/expenses"].reset-button');
          const sanitizedSearch = (search) => {
            const params = new URLSearchParams(search || '');
            params.delete('new');
            const clean = params.toString();
            return clean ? '?' + clean : '';
          };
          if (resetLink) resetLink.addEventListener('click', () => localStorage.removeItem(storageKey));
          const query = sanitizedSearch(window.location.search);
          const form = document.querySelector('form.expense-filters');
          if (query && query !== '?') localStorage.setItem(storageKey, query);
          else {
            const saved = sanitizedSearch(localStorage.getItem(storageKey) || '');
            if (saved) {
              localStorage.setItem(storageKey, saved);
              window.location.replace('/expenses' + saved);
            } else {
              localStorage.removeItem(storageKey);
            }
          }
          if (form) form.addEventListener('submit', () => {
            const billingFields = ['billingPeriodFrom', 'billingPeriodTo', 'billingPeriodQuick'].map(name => form.elements.namedItem(name)).filter(Boolean);
            const dateFields = ['orderDateFrom', 'orderDateTo', 'dateQuick'].map(name => form.elements.namedItem(name)).filter(Boolean);
            const hasBilling = billingFields.some(field => field.value);
            const hasDate = dateFields.some(field => field.value);
            if (hasBilling) dateFields.forEach(field => { field.value = ''; });
            else if (hasDate) billingFields.forEach(field => { field.value = ''; });
            setTimeout(() => {
              const clean = sanitizedSearch(window.location.search);
              if (clean) localStorage.setItem(storageKey, clean);
              else localStorage.removeItem(storageKey);
            }, 0);
          });
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
                if (singleEnabled) edit.setAttribute('data-expense-edit-id', firstId);
                else edit.removeAttribute('data-expense-edit-id');
                if (singleEnabled) edit.setAttribute('data-expense-edit-id', firstId);
                else edit.removeAttribute('data-expense-edit-id');
              }
              if (copy) {
                copy.classList.toggle('is-disabled', !singleEnabled);
                copy.setAttribute('aria-disabled', singleEnabled ? 'false' : 'true');
                copy.href = '#';
                if (singleEnabled) copy.setAttribute('data-expense-copy-id', firstId);
                else copy.removeAttribute('data-expense-copy-id');
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
          const quick = document.getElementById('billingPeriodQuick');
          const from = document.getElementById('billingPeriodFrom');
          const to = document.getElementById('billingPeriodTo');
          if (!quick || !from || !to) return;
          const computeRange = (value) => {
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth();
            const fmt = (year, monthIndex) => {
              const date = new Date(year, monthIndex, 1);
              return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
            };
            const currentQuarter = Math.floor(m / 3);
            const monthMatch = String(value).match(/^month_(\d{2})$/);
            const quarterMatch = String(value).match(/^quarter_(\d)$/);
            if (monthMatch) {
              const selectedMonth = Number(monthMatch[1]) - 1;
              return { from: fmt(y, selectedMonth), to: fmt(y, selectedMonth) };
            }
            if (quarterMatch) {
              const quarter = Number(quarterMatch[1]) - 1;
              return { from: fmt(y, quarter * 3), to: fmt(y, quarter * 3 + 2) };
            }
            if (value === 'previous_month') return { from: fmt(y, m - 1), to: fmt(y, m - 1) };
            if (value === 'current_quarter') return { from: fmt(y, currentQuarter * 3), to: fmt(y, currentQuarter * 3 + 2) };
            if (value === 'previous_quarter') return currentQuarter > 0 ? { from: fmt(y, (currentQuarter - 1) * 3), to: fmt(y, (currentQuarter - 1) * 3 + 2) } : { from: fmt(y - 1, 9), to: fmt(y - 1, 11) };
            if (value === 'this_month') return { from: fmt(y, m), to: fmt(y, m) };
            return null;
          };
          quick.addEventListener('change', () => {
            const range = computeRange(quick.value);
            if (!range) return;
            from.value = range.from;
            to.value = range.to;
            ['orderDateFrom','orderDateTo','dateQuick'].forEach(id => { const field = document.getElementById(id); if (field) field.value = ''; });
          });
          [from, to].forEach((field) => field.addEventListener('change', () => { quick.value = ''; ['orderDateFrom','orderDateTo','dateQuick'].forEach(id => { const f = document.getElementById(id); if (f) f.value = ''; }); }));
        })();
        (() => {
          const quick = document.getElementById('dateQuick');
          const from = document.getElementById('orderDateFrom');
          const to = document.getElementById('orderDateTo');
          if (!quick || !from || !to) return;
          const computeRange = (value) => {
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth();
            const fmt = (date) => {
              const yy = date.getFullYear();
              const mm = String(date.getMonth() + 1).padStart(2, '0');
              const dd = String(date.getDate()).padStart(2, '0');
              return yy + '-' + mm + '-' + dd;
            };
            const fiscalQuarterRange = (yy, quarter) => ({ from: fmt(new Date(yy, quarter * 3, 1)), to: fmt(new Date(yy, quarter * 3 + 3, 0)) });
            const currentQuarter = Math.floor(m / 3);
            const monthMatch = String(value).match(/^month_(\d{2})$/);
            const quarterMatch = String(value).match(/^quarter_(\d)$/);
            if (monthMatch) {
              const selectedMonth = Number(monthMatch[1]) - 1;
              return { from: fmt(new Date(y, selectedMonth, 1)), to: fmt(new Date(y, selectedMonth + 1, 0)) };
            }
            if (quarterMatch) return fiscalQuarterRange(y, Number(quarterMatch[1]) - 1);
            if (value === 'previous_month') return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
            if (value === 'two_months_ago') return { from: fmt(new Date(y, m - 2, 1)), to: fmt(new Date(y, m - 1, 0)) };
            if (value === 'current_quarter') return fiscalQuarterRange(y, currentQuarter);
            if (value === 'last_quarter') return currentQuarter > 0 ? fiscalQuarterRange(y, currentQuarter - 1) : fiscalQuarterRange(y - 1, 3);
            if (value === 'this_month') return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
            return null;
          };
          quick.addEventListener('change', () => {
            const range = computeRange(quick.value);
            if (!range) return;
            from.value = range.from;
            to.value = range.to;
            ['billingPeriodFrom','billingPeriodTo','billingPeriodQuick'].forEach(id => { const field = document.getElementById(id); if (field) field.value = ''; });
          });
          [from, to].forEach((field) => field.addEventListener('change', () => { quick.value = ''; ['billingPeriodFrom','billingPeriodTo','billingPeriodQuick'].forEach(id => { const f = document.getElementById(id); if (f) f.value = ''; }); }));
        })();
      ` }} />

      <form id="expenseBulkForm" action={`/api/expenses/bulk?returnTo=${returnTo}`} method="post" className="bulk-actions-bar confirm-bulk-form">
        <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form="expenseBulkForm">
          <summary className="bulk-action-trigger"><span className="btn-icon">⚙</span><span className="bulk-label">Bulk actions</span></summary>
          <div className="bulk-action-menu-panel">
            <button type="submit" name="bulkAction" value="invoice_emitted"><span className="btn-icon">✓</span><span className="bulk-label">Fattura emessa</span></button>
            <button type="submit" name="bulkAction" value="payment_completed"><span className="btn-icon">€</span><span className="bulk-label">Pagamento completato</span></button>
          </div>
        </details>
        <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form="expenseBulkForm"
             data-edit-base="/expenses/" data-copy-base="/expenses/new?copyId=" data-edit-trigger-attr="data-expense-edit-id" data-copy-trigger-attr="data-expense-copy-id" data-return-to={returnTo}>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true">
            <span className="btn-icon">✎</span><span className="bulk-label">Modifica</span>
          </a>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-copy aria-disabled="true">
            <span className="btn-icon">＋</span><span className="bulk-label">Copia</span>
          </a>
          <button type="submit" className="bulk-direct-link bulk-direct-danger" name="bulkAction" value="delete"
                  data-bulk-delete data-confirm-label="Elimina" disabled>
            <span className="btn-icon">🗑</span>
            <span className="bulk-label">Elimina</span>
          </button>
        </div>
        <div className="bulk-inner-container">
          <button className="bulk-direct-link button-standard primary-action" type="button" data-expense-new>
            <span className="btn-icon">+</span>
            <span className="bulk-label">Aggiungi spesa</span>
          </button>
        </div>
      </form>

      <ExpenseEditModalController
          categories={orderedCategories.map(c => ({id: c.id, code: c.code, name: c.name }))}
        banks={orderedBanks.map(b => ({ id: b.id, name: b.name }))}
        suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, phone: s.phone, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes }))}
        listHref={listHref}
      />

      <div className="expense-mobile-list" aria-label="Lista spese mobile">
        {mobileSortedExpenses.map(e => {
          const amount = Number(e.amount.toString());
          const paid = e.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
          const residual = Math.max(0, amount - paid);
          const categoryStyle = e.category?.name ? categoryStyles[e.category.name] : undefined;
          const paymentStyle = paymentStatusStyles[e.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
          const invoiceStyle = invoiceStatusStyles[e.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
          const overdue = isExpensePastDueForBadge(e);
          const upaid = isExpenseOverdue(e);
          const invoicePendingAfterPayment = e.paymentStatus === 'COMPLETATO' && e.invoiceStatus === 'IN_ATTESA';
          const statusStyle = overdue ? paymentStatusStyles.SCADUTO : paymentStyle;
          const detailHref = e.recurringExpenseId
            ? `/recurring-expenses/${e.recurringExpenseId}?returnTo=${returnTo}`
            : `/expenses/${e.id}?returnTo=${returnTo}`;
          // const recordClass = overdue ? `expense-mobile-item expense-mobile-item-overdue` : "expense-mobile-item";
          let recordAddClass = "";
          if (overdue) {
            recordAddClass = "expense-mobile-item-overdue";
          } else if (upaid) {
            recordAddClass = "expense-mobile-item-unpaid";
          } else if (invoicePendingAfterPayment) {
            recordAddClass = "expense-mobile-item-invoice-waiting";
          }
          const recordClass = `expense-mobile-item ${recordAddClass}`;

          // return <div className={overdue ? "expense-mobile-item expense-mobile-item-overdue" : "expense-mobile-item"} key={`mobile-${e.id}`}>
          return <div className={recordClass} key={`mobile-${e.id}`}>
            <div className="expense-mobile-select">
              <input form="expenseBulkForm" type="checkbox" name="ids" value={e.id} aria-label={`Seleziona spesa ${e.id}`} />
            </div>
            <Link className="expense-mobile-link" href={detailHref}>
              <div className="expense-mobile-main">
                <div className="expense-mobile-meta">
                  <div className="expense-mobile-meta-left">
                    {e.category ? <span title={e.category.name} className={badgeClass(categoryStyle?.className)}>{categoryStyle?.icon ?? '•'} {categoryStyle?.acronym ?? e.category.code}</span> : null}
                    {fiscalBadgeMobile(e.isDeclared)}
                    <span className="expense-mobile-date">
                      {formatPeriod(e.month, e.year)}
                    </span>
                  </div>
                  <div className="expense-mobile-meta-right">
                    {e.isDeclared ? electronicInvoiceBadge(e.hasElectronicInvoice, e.invoiceStatus) : null}
                    <span className="expense-mobile-date">{mobileDateLabel(e.dueDate)}</span>
                  </div>
                </div>
                <div className="expense-mobile-title-row">
                  <span className={e.isRecurring ? 'badge color-badge recurring-expense-badge' : 'badge color-badge single-expense-badge'}>{e.isRecurring ? 'R' : 'S'}</span>
                  <div className="expense-mobile-title-left">
                    <strong>{e.merchant}</strong>
                  </div>
                  <div className="expense-mobile-title-right">
                    <span className={moneyTone(amount)}>{euro(e.amount.toString())}</span>
                  </div>
                </div>
                <div className="expense-mobile-subtitle">
                  <div>{e.description || 'Spesa senza descrizione'}</div>
                  <div>
                    {/*<span className={badgeClass(statusStyle.className)}>{statusStyle.icon} {statusStyle.label}</span>*/}
                    <span className={badgeClass(statusStyle.className)}> {statusStyle.label}</span>
                  </div>
                </div>
                {/*<div className="expense-mobile-meta">*/}
                  {/*<span>{mobileDateLabel(e.receivedDate)}</span>*/}
                  {/*<span>Scad. {mobileDateLabel(e.dueDate)}</span>*/}
                  {/*<span>{formatPeriod(e.month, e.year)}</span>*/}
                {/*</div>*/}
                {/*<div className="expense-mobile-badges">*/}
                  {/*{e.category ? <span title={e.category.name} className={badgeClass(categoryStyle?.className)}>{categoryStyle?.icon ?? '•'} {categoryStyle?.acronym ?? e.category.code}</span> : null}*/}
                  {/*<span className={badgeClass(statusStyle.className)}>{statusStyle.icon} {statusStyle.label}</span>*/}
                  {/*{fiscalBadge(e.isDeclared)}*/}
                {/*</div>*/}
                {/*<div className="expense-mobile-footer">*/}
                  {/*<span>{electronicInvoiceBadge(e.hasElectronicInvoice, e.invoiceStatus)}</span>*/}
                  {/*<span>{formatPeriod(e.month, e.year)}</span>*/}
                  {/*<strong className={residual > 0 ? 'text-warning' : 'text-ok'}>Residuo {euro(residual)}</strong>*/}
                {/*</div>*/}
              </div>
            </Link>
          </div>;
        })}
      </div>

      <div className="table-scroll"><table className="expenses-table compact-expenses-table"><thead><tr>
        <th className="cell-option cell-center"><input type="checkbox" className="bulk-select-all" data-bulk-target="expenseBulkForm" aria-label="Seleziona tutte le spese" /></th>
        <th className="cell-order-date"><span className="th-wrap">Data<br />ordine</span></th>
        <th className="cell-billing-period"><span className="th-wrap">Per.<br />Cont.</span></th>
        <th className="cell-category">Categ.</th>
        <th className="cell-type"><span className="th-wrap">Tipo</span></th>
        <th className="cell-supplier">Esercente</th>
        <th className="cell-amount">Importo</th>
        <th className="cell-fiscal">Fiscale</th>
        <th className="cell-payment-state"><span className="th-wrap">Stato Pag.</span></th>
        <th className="cell-invoice-state"><span className="th-wrap">Stato<br />Fatt.</span></th>
        <th className="cell-ebilling"><span className="th-wrap">E-Bill</span></th>
        <th className="cell-description">Descrizione</th>
        <th className="cell-residual">Residuo</th>
      </tr></thead><tbody>
        {filteredExpenses.map(e => {
          const amount = Number(e.amount.toString());
          const paid = e.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
          const residual = Math.max(0, amount - paid);
          const categoryStyle = e.category?.name ? categoryStyles[e.category.name] : undefined;
          const paymentStyle = paymentStatusStyles[e.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
          const invoiceStyle = invoiceStatusStyles[e.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
          const overdue = isExpensePastDueForBadge(e);
          const invoicePendingAfterPayment = e.paymentStatus === 'COMPLETATO' && e.invoiceStatus === 'IN_ATTESA';
          return <tr key={e.id} className={['clickable-desktop-row', invoicePendingAfterPayment ? 'expense-row-invoice-waiting' : ''].filter(Boolean).join(' ')} data-row-href={`/expenses/${e.id}?returnTo=${returnTo}`} tabIndex={0}>
            <td className="cell-option cell-center"><input form="expenseBulkForm" type="checkbox" name="ids" value={e.id} aria-label={`Seleziona spesa ${e.id}`} /></td>
            <td className="cell-order-date">{dateLabel(e.receivedDate)}</td>
            <td className="cell-billing-period">{formatPeriod(e.month, e.year)}</td>
            <td className="cell-category">{e.category ? <span title={e.category.name} className={badgeClass(categoryStyle?.className)}>{categoryStyle?.icon ?? '•'} {categoryStyle?.acronym ?? e.category.code}</span> : '-'}</td>
            <td className="cell-type"><span className={e.isRecurring ? 'badge color-badge recurring-expense-badge' : 'badge color-badge single-expense-badge'}>{e.isRecurring ? 'R' : 'S'}</span></td>
            <td className="cell-supplier cell-compact" title={e.merchant ?? ''}>{e.supplierId ? <Link className="supplier-table-link" href={`/suppliers/${e.supplierId}`}>{e.merchant}</Link> : e.merchant}</td>
            <td className="cell-amount"><strong className={moneyTone(amount)}>{euro(e.amount.toString())}</strong></td>
            <td className="cell-fiscal">{fiscalBadge(e.isDeclared)}</td>
            <td className="cell-payment-state">{overdue ? <span className={badgeClass(paymentStatusStyles.SCADUTO.className)}>{paymentStatusStyles.SCADUTO.icon} {paymentStatusStyles.SCADUTO.label}</span> : <span className={badgeClass(paymentStyle.className)}>{paymentStyle.icon} {paymentStyle.label}</span>}</td>
            <td className="cell-invoice-state"><span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span></td>
            <td className="cell-ebilling">{InvoiceBadge(e.hasElectronicInvoice, e.invoiceStatus)}</td>
            <td className="cell-description" title={e.description ?? ''}>{e.description}</td>
            <td className="cell-residual"><strong className={residual > 0 ? 'text-warning' : 'text-ok'}>{euro(residual)}</strong></td>
          </tr>;
        })}
      </tbody></table></div>
    </div>
    <div className="card expenses-list-card">
      <ExpenseCategoryChart data={expensesByCategory} />
    </div>
  </div>;
}
