import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { euro, moneyTone } from '@/lib/money';
import NewExpensePanel from '@/components/NewExpensePanel';
import ExpensesList from '@/components/ExpensesList';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import ExpenseFiltersDrawer from '@/components/ExpenseFiltersDrawer';
import ExpenseTrendSelectors from '@/components/ExpenseTrendSelectors';
import MobileSortControl from '@/components/MobileSortControl';
import SupplierFilterInput from '@/components/SupplierFilterInput';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderExpenseCategories, orderPaymentMethods } from '@/lib/workspace-defaults';
import { stripFlashRecord, stripFlashSearchParams } from '@/lib/flash';
import { isExpenseInvoiceNotReceived } from '@/lib/expense-invoice';
import { badgeClass, formatPeriod } from '@/lib/expense-ui';
import { compareDate, compareNumber, compareText } from '@/lib/mobile-sort';

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

const expenseMobileSortOptions = [
  { value: 'receivedDate_desc', label: '↓ Data ordine recente' },
  { value: 'receivedDate_asc', label: '↑ Data ordine meno recente' },
  { value: 'dueDate_desc', label: '↓ Scadenza recente' },
  { value: 'dueDate_asc', label: '↑ Scadenza meno recente' },
  { value: 'paymentDate_desc', label: '↓ Data pagamento recente' },
  { value: 'paymentDate_asc', label: '↑ Data pagamento meno recente' },
  { value: 'billingPeriod_desc', label: '↓ Periodo fatt. recente' },
  { value: 'billingPeriod_asc', label: '↑ Periodo fatt. meno recente' },
  { value: 'supplier_asc', label: '↓ Fornitore (A-Z)' },
  { value: 'supplier_desc', label: '↑ Fornitore (Z-A)' },
  { value: 'merchant_asc', label: '↓ Esercente (A-Z)' },
  { value: 'merchant_desc', label: '↑ Esercente (Z-A)' },
  { value: 'description_asc', label: '↓ Descrizione (A-Z)' },
  { value: 'description_desc', label: '↑ Descrizione (Z-A)' },
  // { value: 'notes_asc', label: 'Note (A-Z)' },
  { value: 'category_asc', label: '↓ Categoria (A-Z)' },
  { value: 'category_desc', label: '↑ Categoria (Z-A)' },
  { value: 'bank_asc', label: '↓ Banca (A-Z)' },
  { value: 'channel_asc', label: '↓ Canale pagamento (A-Z)' },
  { value: 'amount_desc', label: '↓ Importo alto' },
  { value: 'amount_asc', label: '↑ Importo basso' },
  { value: 'paidAmount_desc', label: '↓ Pagato alto' },
  { value: 'paidAmount_asc', label: '↑ Pagato basso' },
  { value: 'residual_desc', label: '↓ Residuo alto' },
  { value: 'residual_asc', label: '↑ Residuo basso' },
  { value: 'paymentStatus_asc', label: '↓ Stato pagamento (A-Z)' },
  { value: 'invoiceStatus_asc', label: '↓ Stato fattura (A-Z)' },
  { value: 'declared_desc', label: '↓ Fiscali prima' },
  { value: 'electronicInvoice_desc', label: '↓ Fattura elettronica prima' },
  { value: 'complete_desc', label: '↓ Complete prima' },
  { value: 'automaticPayment_desc', label: '↓ Pagamento automatico prima' },
  { value: 'paidByCurrentAccount_desc', label: '↓ C/C pagato prima' },
  { value: 'paidBy_asc', label: '↓ Pagato da (A-Z)' },
  { value: 'vatRate_desc', label: '↓ IVA alta' },
  { value: 'recurring_desc', label: '↓ Ricorrenti prima' },
  { value: 'createdAt_desc', label: '↓ Creazione recente' },
  { value: 'updatedAt_desc', label: '↓ Aggiornamento recente' },
  // { value: 'id_desc', label: 'ID decrescente' },
  // { value: 'id_asc', label: 'ID crescente' }
];

function formatDateInputLabel(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function reportMonthFromRange(monthFrom: string, monthTo: string, dateFrom: string, dateTo: string) {
  if (monthFrom && monthFrom === monthTo) {
    const [year, month] = monthFrom.split('-').map(Number);
    if (year && month >= 1 && month <= 12) return { year, month };
  }
  if (dateFrom && dateTo) {
    const [fromYear, fromMonth] = dateFrom.split('-').map(Number);
    const [toYear, toMonth] = dateTo.split('-').map(Number);
    if (fromYear === toYear && fromMonth === toMonth && fromYear && fromMonth >= 1 && fromMonth <= 12) {
      return { year: fromYear, month: fromMonth };
    }
  }
  return null;
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

function monthNameFromIndex(monthIndex: number) {
  const label = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(new Date(2026, monthIndex, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function quickOrderDateLabel(quickDateFilter: string, selectedYear: string) {
  const now = new Date();
  const parsedYear = Number(selectedYear);
  const year = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : now.getFullYear();
  const monthMatch = quickDateFilter.match(/^month_(\d{2})$/);
  const quarterMatch = quickDateFilter.match(/^quarter_([1-4])$/);

  if (monthMatch) {
    return `${monthNameFromIndex(Number(monthMatch[1]) - 1)} ${year}`;
  }

  if (quarterMatch) {
    const startMonth = (Number(quarterMatch[1]) - 1) * 3;
    return `${monthNameFromIndex(startMonth)} - ${monthNameFromIndex(startMonth + 2)} ${year}`;
  }

  if (quickDateFilter === 'year_to_date') {
    return `${monthNameFromIndex(0)} - ${monthNameFromIndex(11)} ${year}`;
  }

  return '';
}

function periodTotalsLabel({
  useFiscalPeriodFilter,
  billingPeriodFromFilter,
  billingPeriodToFilter,
  quickDateFilter,
  dateYearFilter,
  orderDateFromDefault,
  orderDateToDefault,
}: {
  useFiscalPeriodFilter: boolean;
  billingPeriodFromFilter: string;
  billingPeriodToFilter: string;
  quickDateFilter: string;
  dateYearFilter: string;
  orderDateFromDefault: string;
  orderDateToDefault: string;
}) {
  if (useFiscalPeriodFilter) {
    if (billingPeriodFromFilter && billingPeriodToFilter && billingPeriodFromFilter !== billingPeriodToFilter) {
      return `Periodo fiscale dal ${formatMonthInputLabel(billingPeriodFromFilter)} al ${formatMonthInputLabel(billingPeriodToFilter)}`;
    }
    const value = billingPeriodFromFilter || billingPeriodToFilter;
    return value ? `Totali periodo fiscale ${formatMonthInputLabel(value)}` : 'Totali periodo fiscale selezionato';
  }

  const quickLabel = quickDateFilter ? quickOrderDateLabel(quickDateFilter, dateYearFilter) : '';
  if (quickLabel) return `Totali andamento ${quickLabel}`;

  if (orderDateFromDefault && orderDateToDefault && orderDateFromDefault !== orderDateToDefault) {
    return `Totali andamento\n dal ${formatDateTextInputLabel(orderDateFromDefault)} al ${formatDateTextInputLabel(orderDateToDefault)}`;
  }
  const value = orderDateFromDefault || orderDateToDefault;
  return value ? `Totali andamento ${formatDateTextInputLabel(value)}` : 'Totali andamento date selezionate';
}

function ActiveFilterSummary({ items }: { items: Array<{ label: string; value: string }> }) {
  return <div className="active-filter-summary">
    <span className="active-filter-summary-title">Filtri attivi:</span>
    {items.length ? items.map(item => <span className="active-filter-chip" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>) : <span className="active-filter-empty">nessun filtro impostato</span>}
    <Link className="btn btn-md btn-default reset-btn" href="/expenses"><span className="btn-icon">↺</span> Reset</Link>
  </div>;
}

function optionLabel(options: Array<string[]>, value: string) {
  return options.find(option => option[0] === value)?.[1] ?? value;
}


type ExpenseCategoryDatum = { name: string; code: string; total: number; residual: number };

const expensePieChartColors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0f766e', '#db2777', '#64748b'];

function chartEuro(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(n);
}

function ExpenseCategoryColumnChart({ data, total }: { data: ExpenseCategoryDatum[]; total: number }) {
  const groupedData = total ? data.reduce((items, item) => {
    const percentage = (item.total / total) * 100;
    if (percentage >= 5) return [...items, item];
    const other = items.find(entry => entry.code === 'ALTRO');
    if (other) {
      other.total += item.total;
      other.residual += item.residual;
      return items;
    }
    return [...items, { name: 'ALTRO', code: 'ALTRO', total: item.total, residual: item.residual }];
  }, [] as ExpenseCategoryDatum[]).sort((a, b) => b.total - a.total) : data;
  const max = Math.max(...groupedData.map(item => item.total), 0);

  return <div className="expense-column-panel" aria-label="Grafico a colonne per categorie di spesa">
    <div className="expense-column-heading">
      <div>
        <h2>Top categorie</h2>
        <p className="muted">Colonne per totale speso sui risultati filtrati.</p>
      </div>
    </div>
    {groupedData.length ? <div className="expense-column-chart">
      {groupedData.map(item => {
        const height = max ? Math.max((item.total / max) * 100, 7) : 0;
        const residualHeight = item.total ? Math.min((item.residual / item.total) * 100, 100) : 0;
        const percentage = total ? (item.total / total) * 100 : 0;
        return <div className="expense-column" key={`${item.code}-${item.name}`} title={`${item.name}: ${euro(item.total)} - residuo ${euro(item.residual)}`}>
          <div className="expense-column-plot">
            <span className="expense-column-bar" style={{ height: `${height}%` }}>
              {item.residual > 0 ? <span className="expense-column-residual" style={{ height: `${residualHeight}%` }} /> : null}
            </span>
          </div>
          <strong>{item.code}</strong>
          <small>{percentage.toFixed(0)}%</small>
        </div>;
      })}
    </div> : <p className="muted">Nessuna spesa presente nei risultati filtrati.</p>}
  </div>;
}

function ExpenseCategoryPieChart({ data }: { data: ExpenseCategoryDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.total, 0);
  const groupedData = total > 0 ? data.reduce((items, item) => {
    const percentage = (item.total / total) * 100;
    if (percentage >= 3) return [...items, item];
    const other = items.find(entry => entry.code === 'ALTRO');
    if (other) {
      other.total += item.total;
      other.residual += item.residual;
      return items;
    }
    return [...items, { name: 'Altro', code: 'ALTRO', total: item.total, residual: item.residual }];
  }, [] as ExpenseCategoryDatum[]).sort((a, b) => b.total - a.total) : data;
  let cursor = 0;
  const segments = groupedData.map((item, index) => {
    const start = total ? (cursor / total) * 100 : 0;
    cursor += item.total;
    const end = total ? (cursor / total) * 100 : 0;
    return `${expensePieChartColors[index % expensePieChartColors.length]} ${start.toFixed(3)}% ${end.toFixed(3)}%`;
  });
  const background = segments.length ? `conic-gradient(${segments.join(', ')})` : undefined;

  return <section className="expense-category-chart-card expense-impact-pie-card expense-page-category-pie-chart">
    <div className="card-heading-row">
      <div>
        <h2>Spese per categoria</h2>
        {/*<p className="muted">Distribuzione delle spese in base ai risultati filtrati.</p>*/}
      </div>
      {/*<div className="text-right chart-total"><span className="badge">Totale {chartEuro(total)}</span></div>*/}
    </div>
    {groupedData.length && total > 0 ? <div className="expense-impact-pie-layout">
      <div className="expense-impact-pie" style={{ background }} aria-label="Grafico spese per categoria">
        <div>
          <span>Spese</span>
          <strong className="main-label">{chartEuro(total)}</strong>
        </div>
      </div>
      <div className="expense-impact-pie-legend">
        {groupedData.map((item, index) => {
          const percentage = total ? (item.total / total) * 100 : 0;
          return <div className="expense-impact-pie-row-wrap" key={`${item.code}-${item.name}`}>
            <div className="expense-impact-pie-legend-row">
              <span className="expense-impact-pie-dot" style={{ background: expensePieChartColors[index % expensePieChartColors.length] }} />
              <div><strong className="hidden-mp">{item.code}</strong><span>{item.name}</span></div>
              <div><strong className={moneyTone(item.total)}>{chartEuro(item.total)}</strong><small>{percentage.toFixed(1)}%</small></div>
            </div>
            <div className="expense-impact-pie-bar" style={{ width: `${percentage.toFixed(1)}%`, background: expensePieChartColors[index % expensePieChartColors.length] }} />
          </div>;
        })}
      </div>
    </div> : <p className="muted">Nessuna spesa presente nei risultati filtrati.</p>}
  </section>;
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


function expenseSupplierName(expense: { supplier?: { businessName: string } | null; merchant?: string | null }) {
  return expense.supplier?.businessName ?? expense.merchant ?? '';
}

function expenseResidualAmount(expense: { amount: unknown; payments?: Array<{ amount: unknown }> }) {
  const expenseAmount = Number(expense.amount);
  const paidAmount = (expense.payments ?? []).reduce((partial, payment) => partial + Number(payment.amount), 0);
  return Math.max(expenseAmount - paidAmount, 0);
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

  if (value === 'year_to_date') {
    return {
      from: toMonthInputValue(year, 0),
      to: toMonthInputValue(year, 11)
    };
  }

  return { from: toMonthInputValue(year, month), to: toMonthInputValue(year, month) };
}

const quickBillingPeriodOptions = [
  ['year_to_date', 'Anno intero'],
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
  const formatted = value ? localDateKey(value) : '';
  if (from && (!formatted || formatted < from)) return false;
  if (to && (!formatted || formatted > to)) return false;
  return true;
}

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export default async function ExpensesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/expenses');
  const rawFilters = (await searchParams) ?? {};
  const filters = stripFlashRecord(rawFilters);
  const currentQuery = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach(item => item && currentQuery.append(key, item));
    else if (value) currentQuery.set(key, value);
  });
  stripFlashSearchParams(currentQuery);
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

  const [expenses, categories, banks, paymentMethods, suppliers] = await Promise.all([
    prisma.expense.findMany({
      where: { workspaceId: current.workspace.id },
      include: { category: true, bank: true, supplier: true, payments: { include: { bank: true } }, attachments: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { receivedDate: 'desc' }],
      take: 500
    }),
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  const orderedBanks = orderBanks(banks);
  const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');

  const orderedCategories = orderExpenseCategories(categories);

  const billingPeriodFromFilter = useFiscalPeriodFilter ? (quickBillingPeriodRange?.from || inputDefault(filters, 'billingPeriodFrom') || inputDefault(filters, 'period')) : '';
  const billingPeriodToFilter = useFiscalPeriodFilter ? (quickBillingPeriodRange?.to || inputDefault(filters, 'billingPeriodTo') || inputDefault(filters, 'period')) : '';
  const rawBillingPeriodFromKey = monthInputToKey(billingPeriodFromFilter);
  const rawBillingPeriodToKey = monthInputToKey(billingPeriodToFilter);
  const { fromKey: billingPeriodFromKey, toKey: billingPeriodToKey } = normalizePeriodRange(rawBillingPeriodFromKey, rawBillingPeriodToKey);
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
  const totalsFilterHref = (extraFilters: Record<string, string>) => {
    const query = new URLSearchParams();
    if (useFiscalPeriodFilter) {
      if (billingPeriodFromFilter) query.set('billingPeriodFrom', billingPeriodFromFilter);
      if (billingPeriodToFilter) query.set('billingPeriodTo', billingPeriodToFilter);
    } else {
      if (orderDateFromDefault) query.set('orderDateFrom', orderDateFromDefault);
      if (orderDateToDefault) query.set('orderDateTo', orderDateToDefault);
    }
    if (expenseTypeFilter) query.set('expenseType', expenseTypeFilter);
    Object.entries(extraFilters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const queryString = query.toString();
    return `/expenses${queryString ? `?${queryString}` : ''}`;
  };
  const nonDeclaredTotalsHref = totalsFilterHref({ declared: 'no' });
  const unpaidTotalsHref = totalsFilterHref({ residual: 'open' });
  const invoicesNotReceivedHref = totalsFilterHref({ declared: 'yes', invoiceStatus: 'not_received' });
  const overduePaymentsHref = totalsFilterHref({ paymentStatus: 'overdue' });
  const reportMonth = reportMonthFromRange(
    billingPeriodFromFilter,
    billingPeriodToFilter,
    orderDateFromDefault,
    orderDateToDefault
  );
  const monthlyReportHref = reportMonth
    ? `/months/${reportMonth.year}/${reportMonth.month}?returnTo=${encodeURIComponent(listHref)}`
    : null;
  const flashMessages = {
    savedMessages: {
      created: 'Spesa creata.',
      updated: 'Spesa aggiornata.',
      deleted: 'Spesa rimossa.',
      bulk_updated: 'Spese aggiornate.',
      bulk_deleted: 'Spese rimosse.',
      bulk_copied: 'Spese copiate.'
    },
    errorMessages: {
      invalid: 'Controlla i campi della spesa.',
      supplier_not_found: 'Fornitore non trovato. Aggiungilo prima con il pulsante Nuovo nel campo Esercente, poi salva la spesa.',
      not_found: 'Spesa non trovata.',
      in_use: 'La spesa è collegata ad altri movimenti.'
    }
  };

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
    if (expenseTypeFilter === 'single' && (expense.expenseType === 'VAT_SETTLEMENT' || expense.isRecurring)) return false;
    if (expenseTypeFilter === 'recurring' && (expense.expenseType === 'VAT_SETTLEMENT' || !expense.isRecurring)) return false;
    if (expenseTypeFilter === 'vat_settlement' && expense.expenseType !== 'VAT_SETTLEMENT') return false;
    if (merchantFilter && !normalize(expenseSupplierName(expense)).includes(merchantFilter)) return false;
    if (supplierQuickFilter && !normalize(expense.supplier?.businessName).includes(supplierQuickFilter)) return false;
    if (productFilter && !normalize(expense.description).includes(productFilter)) return false;
    if (!amountMatchesFilter(amount, amountFilterValue)) return false;
    if (paymentStatusFilter === 'not_complete' && expense.paymentStatus === 'COMPLETATO') return false;
    if (paymentStatusFilter === 'overdue' && !isExpensePastDueForBadge(expense)) return false;
    if (paymentStatusFilter && !['not_complete', 'overdue'].includes(paymentStatusFilter) && expense.paymentStatus !== paymentStatusFilter) return false;
    if (residualFilter === 'open' && residual <= 0) return false;
    if (residualFilter === 'closed' && residual > 0) return false;
    if (electronicInvoiceFilter === 'yes' && !expense.hasElectronicInvoice) return false;
    if (electronicInvoiceFilter === 'no' && expense.hasElectronicInvoice) return false;
    if (invoiceStatusModeFilter === 'not_received' && !isExpenseInvoiceNotReceived(expense)) return false;
    if (invoiceStatusFilter === 'not_received' && !isExpenseInvoiceNotReceived(expense)) return false;
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
    acc.paidVat += expense.expenseType === 'VAT_SETTLEMENT' ? paid : (expense.isDeclared ? vatAmountFromGross(paid, vatRate) : 0);
    acc.toPay += residualAmount;
    acc.overdue += overdueResidualAmount;
    if (isExpensePastDueForBadge(expense)) acc.overdueCount += 1;
    if (expense.isDeclared) {
      acc.declared += amount;
      if (isExpenseInvoiceNotReceived(expense)) acc.invoicesNotReceived += 1;
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
    quickDateFilter,
    dateYearFilter,
    orderDateFromDefault,
    orderDateToDefault
  });

  const mobileSort = inputDefault(filters, 'mobileSort') || expenseMobileSortOptions[0].value;
  const mobileSortedExpenses = [...filteredExpenses].sort((a, b) => {
    const billingA = (a.year * 100) + a.month;
    const billingB = (b.year * 100) + b.month;
    const residualA = Math.max(0, Number(a.amount.toString()) - a.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0));
    const residualB = Math.max(0, Number(b.amount.toString()) - b.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0));

    switch (mobileSort) {
      case 'receivedDate_asc': return compareDate(a.receivedDate, b.receivedDate, 'asc');
      case 'dueDate_desc': return compareDate(a.dueDate, b.dueDate, 'desc');
      case 'dueDate_asc': return compareDate(a.dueDate, b.dueDate, 'asc');
      case 'paymentDate_desc': return compareDate(a.paymentDate, b.paymentDate, 'desc');
      case 'paymentDate_asc': return compareDate(a.paymentDate, b.paymentDate, 'asc');
      case 'billingPeriod_desc': return compareNumber(billingA, billingB, 'desc');
      case 'billingPeriod_asc': return compareNumber(billingA, billingB, 'asc');
      case 'supplier_asc': return compareText(expenseSupplierName(a), expenseSupplierName(b), 'asc');
      case 'supplier_desc': return compareText(expenseSupplierName(a), expenseSupplierName(b), 'desc');
      case 'merchant_asc': return compareText(a.merchant, b.merchant, 'asc');
      case 'merchant_desc': return compareText(a.merchant, b.merchant, 'desc');
      case 'description_asc': return compareText(a.description, b.description, 'asc');
      case 'description_desc': return compareText(a.description, b.description, 'desc');
      case 'notes_asc': return compareText(a.notes, b.notes, 'asc');
      case 'category_asc': return compareText(a.category?.name, b.category?.name, 'asc');
      case 'category_desc': return compareText(a.category?.name, b.category?.name, 'desc');
      case 'bank_asc': return compareText(a.bank?.name, b.bank?.name, 'asc');
      case 'channel_asc': return compareText(a.channel, b.channel, 'asc');
      case 'amount_desc': return compareNumber(a.amount, b.amount, 'desc');
      case 'amount_asc': return compareNumber(a.amount, b.amount, 'asc');
      case 'paidAmount_desc': return compareNumber(a.paidAmount, b.paidAmount, 'desc');
      case 'paidAmount_asc': return compareNumber(a.paidAmount, b.paidAmount, 'asc');
      case 'residual_desc': return compareNumber(residualA, residualB, 'desc');
      case 'residual_asc': return compareNumber(residualA, residualB, 'asc');
      case 'paymentStatus_asc': return compareText(a.paymentStatus, b.paymentStatus, 'asc');
      case 'invoiceStatus_asc': return compareText(a.invoiceStatus, b.invoiceStatus, 'asc');
      case 'declared_desc': return compareNumber(Number(a.isDeclared), Number(b.isDeclared), 'desc');
      case 'electronicInvoice_desc': return compareNumber(Number(a.hasElectronicInvoice), Number(b.hasElectronicInvoice), 'desc');
      case 'complete_desc': return compareNumber(Number(a.isComplete), Number(b.isComplete), 'desc');
      case 'automaticPayment_desc': return compareNumber(Number(a.isAutomaticPayment), Number(b.isAutomaticPayment), 'desc');
      case 'paidByCurrentAccount_desc': return compareNumber(Number(a.paidByCurrentAccount), Number(b.paidByCurrentAccount), 'desc');
      case 'paidBy_asc': return compareText(a.paidBy, b.paidBy, 'asc');
      case 'vatRate_desc': return compareNumber(a.vatRate, b.vatRate, 'desc');
      case 'recurring_desc': return compareNumber(Number(a.isRecurring), Number(b.isRecurring), 'desc');
      case 'createdAt_desc': return compareDate(a.createdAt, b.createdAt, 'desc');
      case 'updatedAt_desc': return compareDate(a.updatedAt, b.updatedAt, 'desc');
      case 'id_desc': return compareNumber(a.id, b.id, 'desc');
      case 'id_asc': return compareNumber(a.id, b.id, 'asc');
      default: return compareDate(a.receivedDate, b.receivedDate, 'desc');
    }
  });

  const expensesByCategory = Array.from(filteredExpenses.reduce((map, expense) => {
    const amount = Number(expense.amount.toString());
    const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
    const residual = Math.max(0, amount - paid);
    const name = expense.category?.name ?? 'Senza categoria';
    const code = expense.category?.code ?? 'ND';
    const key = `${code}-${name}`;
    const current = map.get(key) ?? { name, code, total: 0, residual: 0 };
    current.total += amount;
    current.residual += residual;
    map.set(key, current);
    return map;
  }, new Map<string, ExpenseCategoryDatum>()).values()).sort((a, b) => b.total - a.total);

  const activeFilterItems = [
    orderDateFromDefault && { label: 'Data ordine da', value: formatDateInputLabel(orderDateFromDefault) },
    orderDateToDefault && { label: 'Data ordine a', value: formatDateInputLabel(orderDateToDefault) },
    billingPeriodFromFilter && { label: 'Periodo fatt. da', value: billingPeriodFromFilter },
    billingPeriodToFilter && { label: 'Periodo fatt. a', value: billingPeriodToFilter },
    categoryFilter && { label: 'Categoria', value: categoryFilter },
    expenseTypeFilter && { label: 'Tipo spesa', value: expenseTypeFilter === 'recurring' ? 'Ricorrente' : expenseTypeFilter === 'vat_settlement' ? 'Saldo IVA' : 'Singola' },
    inputDefault(filters, 'merchant') && { label: 'Esercente', value: inputDefault(filters, 'merchant') },
    inputDefault(filters, 'supplierQuick') && { label: 'Fornitore', value: inputDefault(filters, 'supplierQuick') },
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
    {/*<Link className="btn btn-md btn-default" href="/recurring-expenses"><span className="btn-icon">↻</span>Spese ricorrenti</Link>*/}
    <NewExpensePanel
      categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name, icon: c.icon, isVatSettlementDefault: c.id === current.workspace.vatSettlementCategoryId }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name, isFallback: b.isFallback }))}
      paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback, systemRole: method.systemRole }))}
      suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, vatNumber: s.vatNumber, iban: s.iban, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes, systemRole: s.systemRole }))}
      initialOpen={inputDefault(filters, 'new') === '1'}
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
        <ExpenseFiltersDrawer
            filters={filters}
            categories={orderedCategories.map(category => ({ id: category.id, code: category.code, name: category.name, icon: category.icon }))}
            quickDateFilter={quickDateFilter}
            orderDateFromDefault={orderDateFromDefault}
            orderDateToDefault={orderDateToDefault}
            quickBillingPeriodFilter={quickBillingPeriodFilter}
            billingPeriodFromFilter={billingPeriodFromFilter}
            billingPeriodToFilter={billingPeriodToFilter}
        />
      </div>
      <ExpenseTrendSelectors
        dateQuick={dateQuickSelectorValue}
        billingPeriodQuick={quickBillingPeriodFilter}
        dateYear={dateYearFilter}
        billingPeriodYear={billingPeriodYearFilter}
        useFiscalPeriodFilter={useFiscalPeriodFilter}
      />

      <div className="expense-summary-row">
        <div className="dashboard-statement-panel list-totals-statement">
          {/*<p className="totals-period-note">{totalsPeriodLabel}</p>*/}
          <h2>{totalsPeriodLabel}</h2>
          <table className="dashboard-statement-table list-totals-table" aria-label="Totali spese filtrate">
            <tbody>
              {/*<tr><td>Spese totali IVA inclusa</td><td><strong className={moneyTone(totals.total)}>{euro(totals.total)}</strong></td></tr>*/}
              <tr><td>Spese totali IVA inclusa</td><td><strong className={badgeClass()}>{euro(totals.total)}</strong></td></tr>
              <tr><td>Spese non dichiarate</td><td><Link href={nonDeclaredTotalsHref}><strong className={moneyTone(totals.nonDeclared)}>{euro(totals.nonDeclared)}</strong></Link></td></tr>
              <tr className={totals.toPay > 0 ? 'list-totals-row-warning row-warning' : ''}><td>Non saldato</td><td><Link href={unpaidTotalsHref}><strong className={moneyTone(totals.toPay)}>{euro(totals.toPay)}</strong></Link></td></tr>
              <tr><td>IVA versata</td><td><strong className={moneyTone(totals.paidVat)}>{euro(totals.paidVat)}</strong></td></tr>
              <tr className={totals.invoicesNotReceived > 0 ? 'list-totals-row-warning row-warning' : ''}><td>Fatture non ricevute</td><td><Link href={invoicesNotReceivedHref}><strong className="text-warning">{totals.invoicesNotReceived}</strong></Link></td></tr>
              <tr className={totals.overdueCount > 0 ? 'list-totals-row-critical row-critical' : ''}><td>Pagamenti scaduti</td><td><Link href={overduePaymentsHref}><strong className="text-warning">{totals.overdueCount}</strong></Link></td></tr>
            </tbody>
          </table>
          {monthlyReportHref ? <div className="dashboard-statement-actions">
            <Link className="btn btn-sm btn-ghost" href={monthlyReportHref}>
              <span className="btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 10h18" />
                  <path d="M8 14h2M14 14h2M8 17h2M14 17h2" />
                </svg>
              </span>
              <span>Report mensile</span>
            </Link>
          </div> : null}
        </div>
        {/*<ExpenseCategoryColumnChart data={expensesByCategory} total={totals.total} />*/}
        <ExpenseCategoryPieChart data={expensesByCategory} />
      </div>
    </div>
    <div className="card expenses-list-card">
      <div className="list-heading recurring-list-heading">
        <div>
          <h2>Lista spese</h2>
          <p className="muted">Risultati mostrati: {filteredExpenses.length}</p>
        </div>
        <div>
          <ExpenseFiltersDrawer
              filters={filters}
              categories={orderedCategories.map(category => ({ id: category.id, code: category.code, name: category.name, icon: category.icon }))}
              quickDateFilter={quickDateFilter}
              orderDateFromDefault={orderDateFromDefault}
              orderDateToDefault={orderDateToDefault}
              quickBillingPeriodFilter={quickBillingPeriodFilter}
              billingPeriodFromFilter={billingPeriodFromFilter}
              billingPeriodToFilter={billingPeriodToFilter}
          />
        </div>
      </div>
      <form className="supplier-quick-search" action="/expenses" method="get" role="search">
        {Object.entries(filters).flatMap(([key, value]) => key === 'supplierQuick' || key === 'mobileSort' ? [] : (Array.isArray(value) ? value.map(item => <input type="hidden" name={key} value={item} key={`${key}-${item}`} />) : value ? [<input type="hidden" name={key} value={value} key={key} />] : []))}
        <label htmlFor="expenseSupplierQuickSearch">Ricerca rapida</label>
        <div className="supplier-quick-search-field"><input id="expenseSupplierQuickSearch" name="supplierQuick" defaultValue={inputDefault(filters, 'supplierQuick')} placeholder="Nome o ragione sociale" autoComplete="off" /><button className="btn btn-sm btn-primary" type="submit" aria-label="Cerca fornitore">🔎</button></div>
      </form>
      <MobileSortControl action="/expenses" currentValue={mobileSort} options={expenseMobileSortOptions} searchParams={filters} />

      {activeFilterItems.length ? <div className="recurring-active-filters"><div><div className="flex justify-start align-start"><span className="flex-grow recurring-active-filters-title">Filtri attivi</span><Link className="btn btn-xs btn-neutral recurring-active-filters-reset" href="/expenses"><span className="btn-icon">×</span> Reset</Link></div><div className="flex justify-end align-start"><div className="recurring-active-filter-tags">{activeFilterItems.map(item => <span className="badge" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>)}</div></div></div></div> : null}

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
          const filterMaxAgeMs = 24 * 60 * 60 * 1000;
          const resetLink = document.querySelector('a[href="/expenses"].reset-button');
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
              if (clean) writeStoredFilter(clean);
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
            if (value === 'year_to_date') return { from: fmt(y, 0), to: fmt(y, 11) };
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
            if (value === 'previous_quarter') return currentQuarter > 0 ? fiscalQuarterRange(y, currentQuarter - 1) : fiscalQuarterRange(y - 1, 3);
            if (value === 'year_to_date') return { from: fmt(new Date(y, 0, 1)), to: fmt(new Date(y, 11, 31)) };
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

      <ExpensesList
        expenses={filteredExpenses}
        mobileExpenses={mobileSortedExpenses}
        returnTo={returnTo}
        showSupplierColumn
        selectable
        formId="expenseBulkForm"
        categories={orderedCategories.map(c => ({id: c.id, code: c.code, name: c.name, icon: c.icon, isVatSettlementDefault: c.id === current.workspace.vatSettlementCategoryId }))}
        banks={orderedBanks.map(b => ({ id: b.id, name: b.name, isFallback: b.isFallback }))}
        paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback, systemRole: method.systemRole }))}
        suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, vatNumber: s.vatNumber, iban: s.iban, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes, systemRole: s.systemRole }))}
        emptyMessage="Nessuna spesa trovata con i filtri selezionati."
      />
    </div>
    {/*<div className="card expenses-list-card">*/}
    {/*  <ExpenseCategoryChart data={expensesByCategory} />*/}
    {/*</div>*/}
  </div>;
}
