import Link from 'next/link';
import BulkSelectionController from '@/components/BulkSelectionController';
import DeleteActionButton from '@/components/DeleteActionButton';
import { prisma } from '@/lib/prisma';
import { euro, moneyTone } from '@/lib/money';
import NewIncomePanel from '@/components/NewIncomePanel';
import {
  badgeClass,
  creditChannelStyles,
  fiscalStyles,
  incomeInvoiceStatusStyles,
  paymentMethodStyles,
  saleCategoryStyles,
  salesChannelStyles
} from '@/lib/income-ui';
import { vatStyles } from '@/lib/expense-ui';

const salesChannelOptions = ['Shop', 'Online Shop', 'Altro Canale'];
const saleCategoryOptions = ['B2C', 'B2B', 'Altro'];
const paymentMethodOptions = ['Bonifico', 'Carta di Debito/Credito', 'Criptovaluta', 'Stripe', 'Cash'];
const creditChannelOptions = ['Cash', 'Unicredit', 'MyTu', 'Wise'];
const invoiceStatusOptions = [
  ['NON_INVIATA', 'Non inviata'],
  ['EMESSA', 'Emessa'],
  ['not_emitted', 'Non emesse']
];

function dateLabel(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value)
    : '-';
}

function formatDateInputLabel(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
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

function fiscalQuarterRange(year: number, quarterIndex: number) {
  const startMonth = quarterIndex * 3;
  return {
    from: toDateInputValue(new Date(year, startMonth, 1)),
    to: toDateInputValue(new Date(year, startMonth + 3, 0))
  };
}

function getQuickDateRange(value: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentQuarter = Math.floor(month / 3);

  if (value === 'previous_month') return { from: toDateInputValue(new Date(year, month - 1, 1)), to: toDateInputValue(new Date(year, month, 0)) };
  if (value === 'two_months_ago') return { from: toDateInputValue(new Date(year, month - 2, 1)), to: toDateInputValue(new Date(year, month - 1, 0)) };
  if (value === 'current_quarter') return fiscalQuarterRange(year, currentQuarter);
  if (value === 'last_quarter') return currentQuarter > 0 ? fiscalQuarterRange(year, currentQuarter - 1) : fiscalQuarterRange(year - 1, 3);
  return { from: toDateInputValue(new Date(year, month, 1)), to: toDateInputValue(new Date(year, month + 1, 0)) };
}

const quickDateOptions = [
  ['this_month', 'Questo Mese'],
  ['previous_month', 'Mese precedente'],
  ['two_months_ago', 'Due mesi fa'],
  ['current_quarter', 'Trimestre in corso'],
  ['last_quarter', 'Ultimo Trimestre']
];

function toMonthInputValue(year: number, monthIndexZeroBased: number) {
  const date = new Date(year, monthIndexZeroBased, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getQuickBillingPeriodRange(value: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentQuarter = Math.floor(month / 3);
  if (value === 'previous_month') return { from: toMonthInputValue(year, month - 1), to: toMonthInputValue(year, month - 1) };
  if (value === 'current_quarter') return { from: toMonthInputValue(year, currentQuarter * 3), to: toMonthInputValue(year, currentQuarter * 3 + 2) };
  if (value === 'previous_quarter') {
    const quarter = currentQuarter - 1;
    return quarter >= 0
      ? { from: toMonthInputValue(year, quarter * 3), to: toMonthInputValue(year, quarter * 3 + 2) }
      : { from: toMonthInputValue(year - 1, 9), to: toMonthInputValue(year - 1, 11) };
  }
  return { from: toMonthInputValue(year, month), to: toMonthInputValue(year, month) };
}

const quickBillingPeriodOptions = [
  ['this_month', 'Questo Mese'],
  ['previous_month', 'Mese precedente'],
  ['current_quarter', 'Trimestre in corso'],
  ['previous_quarter', 'Trimestre precedente']
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

function booleanBadge(value: boolean) {
  const item = value ? fiscalStyles.yes : fiscalStyles.no;
  return <span className={badgeClass(item.className)}>{item.icon} {item.label}</span>;
}
function ActiveFilterSummary({ items }: { items: Array<{ label: string; value: string }> }) {
  return <div className="active-filter-summary">
    <span className="active-filter-summary-title">Filtri attivi:</span>
    {items.length ? items.map(item => <span className="active-filter-chip" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>) : <span className="active-filter-empty">nessun filtro impostato</span>}
  </div>;
}

function optionLabel(options: Array<string[]>, value: string) {
  return options.find(option => option[0] === value)?.[1] ?? value;
}


function IncomeBreakdownChart({ title, description, data }: { title: string; description: string; data: Array<{ name: string; code: string; total: number }> }) {
  const max = Math.max(...data.map(item => item.total), 0);
  const total = data.reduce((sum, item) => sum + item.total, 0);

  return <div className="card expense-category-chart-card embedded-chart-card">
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
          <div className="category-chart-label"><strong>{item.code}</strong><span>{item.name}</span></div>
          <div className="category-chart-bar-wrap" aria-label={`${item.name}: ${euro(item.total)}`}>
            <div className="category-chart-bar" style={{ width: `${width}%` }} />
          </div>
          <div className="category-chart-value"><strong className={moneyTone(item.total)}>{euro(item.total)}</strong><small>{percentage.toFixed(1)}%</small></div>
        </div>;
      })}
    </div> : <p className="muted">Nessun incasso presente nei risultati filtrati.</p>}
  </div>;
}

export default async function IncomesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = (await searchParams) ?? {};
  const currentQuery = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach(item => item && currentQuery.append(key, item));
    else if (value) currentQuery.set(key, value);
  });
  const currentQueryString = currentQuery.toString();
  const listHref = `/incomes${currentQueryString ? `?${currentQueryString}` : ''}`;
  const returnTo = encodeURIComponent(listHref);
  const hasAnyFilter = Object.keys(filters).length > 0;
  const hasFiscalPeriodFilter = Boolean(inputDefault(filters, 'billingPeriodFrom') || inputDefault(filters, 'billingPeriodTo') || inputDefault(filters, 'billingPeriod') || inputDefault(filters, 'billingPeriodQuick'));
  const hasCreditDateFilter = Boolean(inputDefault(filters, 'creditDateFrom') || inputDefault(filters, 'creditDateTo') || inputDefault(filters, 'dateQuick'));
  const useFiscalPeriodFilter = hasFiscalPeriodFilter;
  const useCreditDateFilter = !useFiscalPeriodFilter;
  const quickDateFilter = useCreditDateFilter ? (inputDefault(filters, 'dateQuick') || (!hasAnyFilter && !hasCreditDateFilter ? 'this_month' : '')) : '';
  const quickDateRange = quickDateFilter ? getQuickDateRange(quickDateFilter) : null;
  const creditDateFromDefault = useCreditDateFilter ? (quickDateRange?.from || inputDefault(filters, 'creditDateFrom')) : '';
  const creditDateToDefault = useCreditDateFilter ? (quickDateRange?.to || inputDefault(filters, 'creditDateTo')) : '';
  const quickBillingPeriodFilter = useFiscalPeriodFilter ? (inputDefault(filters, 'billingPeriodQuick') || '') : '';
  const quickBillingPeriodRange = quickBillingPeriodFilter ? getQuickBillingPeriodRange(quickBillingPeriodFilter) : null;

  const [incomes, expensesForVat] = await Promise.all([
    prisma.income.findMany({ orderBy: [{ creditDate: 'desc' }, { id: 'desc' }], take: 500 }),
    prisma.expense.findMany({ include: { payments: true }, take: 5000 })
  ]);

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
    if (paymentMethodFilter && income.paymentMethod !== paymentMethodFilter) return false;
    if (creditChannelFilter && income.creditChannel !== creditChannelFilter) return false;
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

  const periodTotals = summarizeIncomes(periodIncomes);
  const totals = summarizeIncomes(filteredIncomes);

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
    const name = income.isFiscal ? 'Fiscale Si' : 'Fiscale No';
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
  const residualVatDebt = recoverableExpenseVat === null ? null : periodTotals.vatDebt - recoverableExpenseVat;

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
    <div className="toolbar-card toolbar-card-wrap">
      <div>
        <h2>Incassi</h2>
        <p className="muted">Gestione delle entrate fiscali e non fiscali.</p>
      </div>
      <NewIncomePanel initialOpen={inputDefault(filters, 'new') === '1'} />
    </div>

    <div className="card expenses-list-card">
      <div className="totals-row income-totals-row">
        <div className="total-card total-card-income"><span>Entrate totali</span><strong className={moneyTone(periodTotals.total)}>{euro(periodTotals.total)}</strong><small>Totale del periodo selezionato, senza altri filtri.</small></div>
        <div className="total-card total-card-fiscal"><span>Incasso fiscale</span><strong className={moneyTone(periodTotals.fiscal)}>{euro(periodTotals.fiscal)}</strong><small>Entrate fiscali del periodo selezionato.</small></div>
        <div className="total-card total-card-neutral"><span>Incasso non fiscale</span><strong className={moneyTone(periodTotals.nonFiscal)}>{euro(periodTotals.nonFiscal)}</strong><small>Entrate non fiscali del periodo selezionato.</small></div>
        <div className="total-card total-card-vat"><span>Debito IVA</span><strong className={moneyTone(periodTotals.vatDebt)}>{euro(periodTotals.vatDebt)}</strong><small>IVA generata dagli incassi fiscali del periodo.</small></div>
        <div className="total-card total-card-warning"><span>Debito IVA residuo</span><strong>{residualVatDebt === null ? <span className="total-placeholder">Seleziona periodo fiscale</span> : <span className={moneyTone(residualVatDebt)}>{euro(residualVatDebt)}</span>}</strong><small>Debito IVA meno IVA versata nelle spese.</small></div>
        <div className="total-card total-card-warning"><span>Fatture non inviate</span><strong>{periodTotals.invoicesNotSent}</strong><small>Incassi fiscali del periodo con fattura non emessa.</small></div>
      </div>

      <div className="list-heading">
        <div>
          <h2>Lista incassi</h2>
          <p className="muted">Risultati mostrati: {filteredIncomes.length}</p>
        </div>
      </div>

      <details className="filter-collapse">
        <summary><span className="btn-icon">🔎</span>Filtri di ricerca</summary>
        <form className="expense-filters compact-filters grouped-filters" method="get">
        <fieldset className="filter-group filter-group-fiscal">
          <legend>Periodo fiscale</legend>
          <label>Periodo Fatt. da<input id="incomeBillingPeriodFrom" name="billingPeriodFrom" type="month" defaultValue={billingPeriodFromFilter} /></label>
          <label>Periodo Fatt. a<input id="incomeBillingPeriodTo" name="billingPeriodTo" type="month" defaultValue={billingPeriodToFilter} /></label>
          <label>Periodo fiscale rapido<select id="incomeBillingPeriodQuick" name="billingPeriodQuick" defaultValue={quickBillingPeriodFilter}>
            <option value="">Periodo personalizzato</option>
            {quickBillingPeriodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </fieldset>
        <fieldset className="filter-group filter-group-order-date">
          <legend>Date accredito</legend>
          <label>Data accredito da<input id="creditDateFrom" name="creditDateFrom" type="date" defaultValue={creditDateFromDefault} /></label>
          <label>Data accredito a<input id="creditDateTo" name="creditDateTo" type="date" defaultValue={creditDateToDefault} /></label>
          <label>Selezione rapida data<select id="incomeDateQuick" name="dateQuick" defaultValue={quickDateFilter}>
            <option value="">Periodo personalizzato</option>{quickDateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </fieldset>
        <label>Canale vendita<select name="salesChannel" defaultValue={inputDefault(filters, 'salesChannel')}><option value="">Tutti</option>{salesChannelOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Categoria vendita<select name="saleCategory" defaultValue={inputDefault(filters, 'saleCategory')}><option value="">Tutte</option>{saleCategoryOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Importo<input name="amount" inputMode="decimal" defaultValue={inputDefault(filters, 'amount')} /></label>
        <label>Metodo pagamento<select name="paymentMethod" defaultValue={inputDefault(filters, 'paymentMethod')}><option value="">Tutti</option>{paymentMethodOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Canale accredito<select name="creditChannel" defaultValue={inputDefault(filters, 'creditChannel')}><option value="">Tutti</option>{creditChannelOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Fiscale<select name="fiscal" defaultValue={inputDefault(filters, 'fiscal')}><option value="">Tutti</option><option value="yes">Si</option><option value="no">No</option></select></label>
        <label>Stato fattura<select name="invoiceStatus" defaultValue={inputDefault(filters, 'invoiceStatus') || inputDefault(filters, 'invoiceStatusMode')}><option value="">Tutti</option>{invoiceStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>IVA<select name="vatRate" defaultValue={inputDefault(filters, 'vatRate')}><option value="">Tutte</option><option value="0">0%</option><option value="4">4%</option><option value="10">10%</option><option value="22">22%</option></select></label>
        <div className="filter-actions"><button className="button-standard primary-action" type="submit"><span className="btn-icon">🔎</span> Filtra</button><Link className="button-standard secondary-button reset-button" href="/incomes"><span className="btn-icon">↺</span> Reset</Link></div>
        </form>
      </details>

      <ActiveFilterSummary items={activeFilterItems} />

      <BulkSelectionController />

      <script dangerouslySetInnerHTML={{ __html: `
        (() => {
          const storageKey = 'dmsAccounting.incomes.filters';
          const resetLink = document.querySelector('a[href="/incomes"].reset-button');
          if (resetLink) resetLink.addEventListener('click', () => localStorage.removeItem(storageKey));
          const query = window.location.search;
          const form = document.querySelector('form.expense-filters');
          if (query && query !== '?') localStorage.setItem(storageKey, query);
          else {
            const saved = localStorage.getItem(storageKey);
            if (saved) window.location.replace('/incomes' + saved);
          }
          if (form) form.addEventListener('submit', () => {
            const billingFields = ['billingPeriodFrom', 'billingPeriodTo', 'billingPeriodQuick'].map(name => form.elements.namedItem(name)).filter(Boolean);
            const dateFields = ['creditDateFrom', 'creditDateTo', 'dateQuick'].map(name => form.elements.namedItem(name)).filter(Boolean);
            const hasBilling = billingFields.some(field => field.value);
            const hasDate = dateFields.some(field => field.value);
            if (hasBilling) dateFields.forEach(field => { field.value = ''; });
            else if (hasDate) billingFields.forEach(field => { field.value = ''; });
            setTimeout(() => localStorage.setItem(storageKey, window.location.search), 0);
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
                edit.href = singleEnabled ? (group.getAttribute('data-edit-base') + firstId + '/edit?returnTo=' + returnTo) : '#';
              }
              if (copy) {
                copy.classList.toggle('is-disabled', !singleEnabled);
                copy.setAttribute('aria-disabled', singleEnabled ? 'false' : 'true');
                copy.href = singleEnabled ? (group.getAttribute('data-copy-base') + firstId + '&returnTo=' + returnTo) : '#';
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

      <div className="search-totals-row" aria-label="Totali risultati filtrati">
        <div><span>Risultati</span><strong>{filteredIncomes.length}</strong></div>
        <div><span>Entrate filtrate</span><strong className={moneyTone(totals.total)}>{euro(totals.total)}</strong></div>
        <div><span>Fiscale</span><strong className={moneyTone(totals.fiscal)}>{euro(totals.fiscal)}</strong></div>
        <div><span>Non fiscale</span><strong className={moneyTone(totals.nonFiscal)}>{euro(totals.nonFiscal)}</strong></div>
        <div><span>IVA</span><strong className={moneyTone(totals.vatDebt)}>{euro(totals.vatDebt)}</strong></div>
      </div>

      <form id="incomeBulkForm" action={`/api/incomes/bulk?returnTo=${returnTo}`} method="post" className="bulk-actions-bar confirm-bulk-form">
        <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form="incomeBulkForm">
          <summary className="bulk-action-trigger"><span className="btn-icon">⚙</span><span className="bulk-label">Bulk actions</span></summary>
          <div className="bulk-action-menu-panel">
            <button type="submit" name="bulkAction" value="invoice_emitted"><span className="btn-icon">✓</span><span className="bulk-label">Fattura emessa</span></button>
          </div>
        </details>
        <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form="incomeBulkForm" data-edit-base="/incomes/" data-copy-base="/incomes/new?copyId=" data-return-to={returnTo}>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true"><span className="btn-icon">✎</span><span className="bulk-label">Modifica</span></a>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-copy aria-disabled="true"><span className="btn-icon">＋</span><span className="bulk-label">Copia</span></a>
          <button type="submit" className="bulk-direct-link bulk-direct-danger" name="bulkAction" value="delete" data-bulk-delete data-confirm-label="Elimina" disabled><span className="btn-icon">🗑</span><span className="bulk-label">Elimina</span></button>
        </div>
      </form>

      <div className="table-scroll incomes-table-scroll"><table className="expenses-table compact-incomes-table"><colgroup>
        <col className="income-col-select" />
        <col className="income-col-detail" />
        <col className="income-col-period" />
        <col className="income-col-date" />
        <col className="income-col-channel" />
        <col className="income-col-category" />
        <col className="income-col-amount" />
        <col className="income-col-method" />
        <col className="income-col-credit" />
        <col className="income-col-fiscal" />
        <col className="income-col-invoice" />
        <col className="income-col-vat" />
        <col className="income-col-action" />
      </colgroup><thead><tr>
        <th className="cell-center"><input type="checkbox" className="bulk-select-all" data-bulk-target="incomeBulkForm" aria-label="Seleziona tutti gli incassi" /></th>
        <th className="cell-center"><span className="sr-only">Dettaglio</span></th>
        <th className="cell-left"><span className="th-wrap">Periodo<br />Fatt.</span></th>
        <th className="cell-left"><span className="th-wrap">Data<br />accr.</span></th>
        <th className="cell-left"><span className="th-wrap">Canale<br />vendita</span></th>
        <th className="cell-center">Cat.</th>
        <th className="cell-right">Importo</th>
        <th className="cell-left"><span className="th-wrap">Metodo<br />pag.</span></th>
        <th className="cell-left"><span className="th-wrap">Canale<br />accr.</span></th>
        <th className="cell-center">Fisc.</th>
        <th className="cell-center"><span className="th-wrap">Stato<br />fatt.</span></th>
        <th className="cell-center">IVA</th>
        <th className="cell-center"><span className="sr-only">Elimina</span></th>
      </tr></thead><tbody>
        {filteredIncomes.map(income => {
          const salesStyle = salesChannelStyles[income.salesChannel];
          const catStyle = saleCategoryStyles[income.saleCategory];
          const paymentStyle = paymentMethodStyles[income.paymentMethod];
          const creditStyle = creditChannelStyles[income.creditChannel];
          const invoiceStyle = incomeInvoiceStatusStyles[income.invoiceStatus || 'NONE'] ?? incomeInvoiceStatusStyles.NONE;
          const vatStyle = vatStyles[String(Number(income.vatRate.toString()))] ?? vatStyles['0'];
          return <tr key={income.id}>
            <td className="cell-center"><input form="incomeBulkForm" type="checkbox" name="ids" value={income.id} aria-label={`Seleziona incasso ${income.id}`} /></td>
            <td className="cell-center"><Link title="Dettaglio" aria-label="Dettaglio" className="table-action secondary icon-action" href={`/incomes/${income.id}?returnTo=${returnTo}`}>👁</Link></td>
            <td className="cell-left nowrap-cell">{formatPeriod(income.billingMonth, income.billingYear)}</td>
            <td className="cell-left nowrap-cell">{dateLabel(income.creditDate)}</td>
            <td className="cell-left"><span title={income.salesChannel} className={`${badgeClass(salesStyle?.className)} income-badge-compact`}>{salesStyle?.icon ?? '•'} {income.salesChannel}</span></td>
            <td className="cell-center"><span title={income.saleCategory} className={`${badgeClass(catStyle?.className)} income-badge-compact`}>{catStyle?.icon ?? '•'} {income.saleCategory}</span></td>
            <td className="cell-right nowrap-cell"><strong className={moneyTone(Number(income.amount.toString()))}>{euro(income.amount.toString())}</strong></td>
            <td className="cell-left"><span title={income.paymentMethod} className={`${badgeClass(paymentStyle?.className)} income-badge-compact`}>{paymentStyle?.icon ?? '•'} {income.paymentMethod}</span></td>
            <td className="cell-left"><span title={income.creditChannel} className={`${badgeClass(creditStyle?.className)} income-badge-compact`}>{creditStyle?.icon ?? '•'} {income.creditChannel}</span></td>
            <td className="cell-center">{booleanBadge(income.isFiscal)}</td>
            <td className="cell-center"><span title={invoiceStyle.label} className={`${badgeClass(invoiceStyle.className)} income-badge-compact`}>{invoiceStyle.icon} {invoiceStyle.label}</span></td>
            <td className="cell-center"><span className={badgeClass(vatStyle.className)}>{Number(income.vatRate.toString())}%</span></td>
            <td className="cell-center"><DeleteActionButton action={`/api/incomes/${income.id}?returnTo=${returnTo}`} confirmMessage="Confermi la rimozione dell’incasso? L’operazione non può essere annullata." /></td>
          </tr>;
        })}
        {!filteredIncomes.length && <tr><td colSpan={13}>Nessun incasso trovato con i filtri selezionati.</td></tr>}
      </tbody></table></div>

      <div className="charts-grid"><IncomeBreakdownChart title="Grafico entrate per canale di vendita" description="Distribuzione degli incassi per canale di vendita sui risultati filtrati." data={incomesBySalesChannel} /><IncomeBreakdownChart title="Grafico entrate fiscale Si/No" description="Distribuzione degli incassi fiscali e non fiscali sui risultati filtrati." data={incomesByFiscalStatus} /></div>
    </div>
  </div>;
}
