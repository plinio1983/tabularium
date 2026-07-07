import Link from 'next/link';
import BulkChangeCategoryModal from '@/components/BulkChangeCategoryModal';
import BulkSelectionController from '@/components/BulkSelectionController';
import ClickableDesktopRows from '@/components/ClickableDesktopRows';
import ExpenseEditModalController from '@/components/ExpenseEditModalController';
import SortableTableController from '@/components/SortableTableController';
import { euro, moneyTone } from '@/lib/money';
import {
  badgeClass,
  categoryLabel,
  categoryTone,
  formatPeriod,
  invoiceStatusStyles,
  paymentStatusStyles,
  vatKey,
  vatStyles,
  yesNoStyles
} from '@/lib/expense-ui';

type ExpenseListItem = {
  id: number;
  amount: unknown;
  receivedDate?: Date | null;
  dueDate?: Date | null;
  month: number;
  year: number;
  isRecurring: boolean;
  recurringExpenseId?: number | null;
  isDeclared: boolean;
  hasElectronicInvoice: boolean;
  invoiceStatus: string;
  paymentStatus: string;
  vatRate: unknown;
  description?: string | null;
  supplierId?: number | null;
  supplier?: { businessName: string } | null;
  merchant?: string | null;
  category?: { code: string; name: string; icon?: string | null } | null;
  payments?: Array<{ amount: unknown }>;
};

type Option = { id: number; code?: string; name: string; icon?: string | null; isFallback?: boolean | null; kind?: string };
type SupplierOption = {
  id: number;
  businessName: string;
  alias?: string | null;
  email?: string | null;
  vatNumber?: string | null;
  iban?: string | null;
  pec?: string | null;
  taxCodeSdi?: string | null;
  internalNotes?: string | null;
};

type Props = {
  expenses: ExpenseListItem[];
  mobileExpenses?: ExpenseListItem[];
  returnTo: string;
  showSupplierColumn?: boolean;
  selectable?: boolean;
  formId?: string;
  mobileLabel?: string;
  emptyMessage?: string;
  categories?: Option[];
  banks?: Option[];
  paymentMethods?: Option[];
  suppliers?: SupplierOption[];
};

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

function fiscalBadgeMobile(value: boolean) {
  const item = value ? { className: '' } : yesNoStyles.no;
  const label = value ? '✓ DF' : '✕ NF';
  return <span className={badgeClass(item.className)}>{label}</span>;
}

function electronicInvoiceBadge(value: boolean, invoiceStatus?: string) {
  const style = invoiceStatus ? (invoiceStatusStyles[invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA) : yesNoStyles.yes;
  let label = !value ? 'PDF' : 'eBill';
  let state = invoiceStatus;
  if (invoiceStatus === 'IN_ATTESA') {
    state = '✕ ';
  }
  if (invoiceStatus === 'RICEVUTA') {
    state = '✓ ';
  }
  if (invoiceStatus === 'NON_PREVISTA') {
    state = '✕ ';
    label = 'NP';
  }

  return <span className={badgeClass(style.className)}>{state}{label}</span>;
}

function invoiceBadge(value: boolean, invoiceStatus?: string) {
  let style = !value ? yesNoStyles.no.className : yesNoStyles.yes.className;
  let label = '';
  if (!value) {
    if (invoiceStatus === 'NON_PREVISTA') {
      label = '✕';
    } else {
      style = 'tone-neutral';
      label = 'PDF';
    }
  } else {
    label = '✓ eBill.';
  }
  return <span className={badgeClass(style)}>{label}</span>;
}

function expenseSupplierName(expense: ExpenseListItem) {
  return expense.supplier?.businessName ?? expense.merchant ?? '-';
}

function expenseResidualAmount(expense: ExpenseListItem) {
  const expenseAmount = Number(expense.amount);
  const paidAmount = (expense.payments ?? []).reduce((partial, payment) => partial + Number(payment.amount), 0);
  return Math.max(expenseAmount - paidAmount, 0);
}

function isExpenseOverdue(expense: ExpenseListItem) {
  return expenseResidualAmount(expense) > 0;
}

function isExpensePastDueForBadge(expense: ExpenseListItem) {
  if (!expense.dueDate) return false;
  if (expenseResidualAmount(expense) <= 0) return false;
  const due = new Date(expense.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function expenseDetailHref(expense: ExpenseListItem, returnTo: string) {
  return expense.recurringExpenseId
    ? `/recurring-expenses/${expense.recurringExpenseId}?returnTo=${returnTo}`
    : `/expenses/${expense.id}?returnTo=${returnTo}`;
}

function dateSortValue(value?: Date | null) {
  return value ? String(new Date(value).getTime()) : '';
}

export default function ExpensesList({
  expenses,
  mobileExpenses,
  returnTo,
  showSupplierColumn = true,
  selectable = false,
  formId = 'expenseBulkForm',
  mobileLabel = 'Lista spese mobile',
  emptyMessage = 'Nessuna spesa trovata.',
  categories = [],
  banks = [],
  paymentMethods = [],
  suppliers = []
}: Props) {
  const mobileItems = mobileExpenses ?? expenses;
  const hasBulkControls = selectable && categories.length > 0;

  return <>
    <ClickableDesktopRows />
    <SortableTableController />
    {hasBulkControls ? <>
      <BulkSelectionController />
      <form id={formId} action={`/api/expenses/bulk?returnTo=${returnTo}`} method="post" className="bulk-actions-bar confirm-bulk-form">
        <label className="bulk-select-all-inline">
          <input type="checkbox" className="bulk-select-all" data-bulk-target={formId} aria-label="Seleziona tutte le spese visibili" />
        </label>
        <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form={formId}>
          <summary className="bulk-action-trigger">
            <span className="btn-icon">⚙</span>
            <span className="bulk-label"><span className="floating-bulk-label">Bulk </span>Actions</span>
          </summary>
          <div className="bulk-action-menu-panel">
            <button className="btn btn-sm btn-default" type="submit" name="bulkAction" value="invoice_emitted"><span className="btn-icon">✓</span><span className="bulk-label">Fattura emessa</span></button>
            <button className="btn btn-sm btn-default" type="submit" name="bulkAction" value="payment_completed"><span className="btn-icon">€</span><span className="bulk-label">Pagamento completato</span></button>
            <BulkChangeCategoryModal
              formId={formId}
              action={`/api/expenses/bulk?returnTo=${returnTo}`}
              fieldName="categoryId"
              categories={categories.map(category => ({ value: String(category.id), label: category.name, icon: category.icon }))}
            />
          </div>
        </details>
        <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form={formId}
             data-edit-base="/expenses/" data-copy-base="/expenses/new?copyId=" data-edit-trigger-attr="data-expense-edit-id" data-copy-trigger-attr="data-expense-copy-id" data-return-to={returnTo}>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true">
            <span className="btn-icon">✎</span><span className="bulk-label">Modifica</span>
          </a>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-copy aria-disabled="true">
            <span className="btn-icon">⧉</span><span className="bulk-label">Copia</span>
          </a>
          <button type="submit" className="bulk-direct-link bulk-direct-danger" name="bulkAction" value="delete"
                  data-bulk-delete data-confirm-label="Elimina" disabled>
            <span className="btn-icon">🗑</span>
            <span className="bulk-label">Elimina</span>
          </button>
        </div>
        <div className="bulk-inner-container">
          <button className="bulk-direct-link btn btn-md btn-primary" type="button" data-bulk-new data-expense-new data-floating-label="Aggiungi spesa">
            <span className="btn-icon">+</span>
            <span className="bulk-label">Spesa</span>
          </button>
        </div>
      </form>

      <ExpenseEditModalController
        categories={categories}
        banks={banks}
        paymentMethods={paymentMethods}
        suppliers={suppliers}
        listHref={decodeURIComponent(returnTo)}
      />
    </> : null}

    <div className="expense-mobile-list" aria-label={mobileLabel}>
      {mobileItems.map(expense => {
        const amount = Number(expense.amount);
        const supplierName = expenseSupplierName(expense);
        const vatStyle = vatStyles[vatKey(expense.vatRate)] ?? vatStyles['22'];
        const categoryClassName = categoryTone(expense.category);
        const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
        const overdue = isExpensePastDueForBadge(expense);
        const unpaid = isExpenseOverdue(expense);
        const invoiceWaiting = expense.invoiceStatus === 'IN_ATTESA';
        const statusStyle = overdue ? paymentStatusStyles.SCADUTO : paymentStyle;
        let recordAddClass = '';
        if (overdue) {
          recordAddClass = 'expense-mobile-item-overdue';
        } else if (unpaid) {
          recordAddClass = 'expense-mobile-item-unpaid';
        } else if (invoiceWaiting) {
          recordAddClass = 'expense-mobile-item-invoice-waiting';
        }
        const recordClass = `expense-mobile-item ${recordAddClass}`;
        const detailHref = expenseDetailHref(expense, returnTo);

        return <div className={recordClass} key={`mobile-${expense.id}`}>
          {selectable ? <div className="expense-mobile-select">
            <input form={formId} type="checkbox" name="ids" value={expense.id} aria-label={`Seleziona spesa ${expense.id}`} />
          </div> : null}
          <Link className="expense-mobile-link" href={detailHref}>
            <div className="expense-mobile-main">
              <div className="expense-mobile-meta">
                <div className="expense-mobile-meta-left">
                  {expense.category ? <span title={expense.category.name} className={badgeClass(categoryClassName)}>{categoryLabel(expense.category, expense.category.code)}</span> : null}
                  {fiscalBadgeMobile(expense.isDeclared)}
                  <span className="expense-mobile-date">{formatPeriod(expense.month, expense.year)}</span>
                </div>
                <div className="expense-mobile-meta-right">
                  {expense.isDeclared ? electronicInvoiceBadge(expense.hasElectronicInvoice, expense.invoiceStatus) : null}
                  <span className="expense-mobile-date">{mobileDateLabel(expense.dueDate)}</span>
                </div>
              </div>
              <div className="expense-mobile-title-row">
                <span className={expense.isRecurring ? 'badge color-badge recurring-expense-badge' : 'badge color-badge single-expense-badge'}>{expense.isRecurring ? 'R' : 'S'}</span>
                <div className="expense-mobile-title-left">
                  <strong>{showSupplierColumn ? supplierName : (expense.description || 'Spesa senza descrizione')}</strong>
                </div>
                <div className="expense-mobile-title-right">
                  <span className={moneyTone(amount)}>{euro(expense.amount as string | number)}</span>
                </div>
              </div>
              <div className="expense-mobile-subtitle">
                <div className="expense-mobile-subtitle-left">
                  {showSupplierColumn ? <span>{expense.description || 'Spesa senza descrizione'} </span> : null}
                  <span className={badgeClass(vatStyle.className)}>{Number(expense.vatRate)}%</span>
                </div>
                <div>
                  <span className={badgeClass(statusStyle.className)}> {statusStyle.label}</span>
                </div>
              </div>
            </div>
          </Link>
        </div>;
      })}
      {!mobileItems.length ? <div className="expense-mobile-empty">{emptyMessage}</div> : null}
    </div>

    <div className="table-scroll">
      <table className="expenses-table compact-expenses-table" data-sortable-table data-default-sort="order-date" data-default-sort-dir="desc">
        <thead><tr>
          {selectable ? <th className="cell-option cell-center"><input type="checkbox" className="bulk-select-all" data-bulk-target={formId} aria-label="Seleziona tutte le spese" /></th> : null}
          <th className="cell-order-date" data-sort-key="order-date" data-sort-type="date"><span className="th-wrap">Data<br />ordine</span></th>
          <th className="cell-billing-period" data-sort-key="billing-period" data-sort-type="number"><span className="th-wrap">Periodo<br />Cont.</span></th>
          <th className="cell-type" data-sort-key="type"><span className="th-wrap">Tipo</span></th>
          <th className="cell-category" data-sort-key="category">Categ.</th>
          {showSupplierColumn ? <th className="cell-supplier" data-sort-key="supplier">Esercente</th> : null}
          <th className="cell-amount" data-sort-key="amount" data-sort-type="number">Importo</th>
          <th className="cell-vat" data-sort-key="vat" data-sort-type="number">IVA</th>
          <th className="cell-description" data-sort-key="description">Descrizione</th>
          <th className="cell-payment-state" data-sort-key="payment-state"><span className="th-wrap">Stato Pag.</span></th>
          <th className="cell-invoice-state" data-sort-key="invoice-state"><span className="th-wrap">Stato<br />Fatt.</span></th>
          <th className="cell-ebilling" data-sort-key="ebill" data-sort-type="number"><span className="th-wrap">E-Bill</span></th>
          <th className="cell-residual" data-sort-key="residual" data-sort-type="number">Residuo</th>
        </tr></thead>
        <tbody>
          {expenses.map(expense => {
            const amount = Number(expense.amount);
            const supplierName = expenseSupplierName(expense);
            const residual = expenseResidualAmount(expense);
            const categoryClassName = categoryTone(expense.category);
            const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
            const invoiceStyle = invoiceStatusStyles[expense.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
            const overdue = isExpensePastDueForBadge(expense);
            const paymentWaiting = expense.paymentStatus !== 'COMPLETATO' || residual > 0;
            const invoiceWaiting = expense.invoiceStatus === 'IN_ATTESA';
            const vatStyle = vatStyles[vatKey(expense.vatRate)] ?? vatStyles['22'];
            const detailHref = expenseDetailHref(expense, returnTo);

            return <tr
              key={expense.id}
              className={['clickable-desktop-row', overdue ? 'expense-row-overdue' : paymentWaiting || invoiceWaiting ? 'expense-row-warning' : ''].filter(Boolean).join(' ')}
              data-row-href={detailHref}
              data-sort-row
              data-sort-order-date={dateSortValue(expense.receivedDate)}
              data-sort-billing-period={String(Number(expense.year) * 12 + Number(expense.month))}
              data-sort-type={expense.isRecurring ? 'R' : 'S'}
              data-sort-category={`${expense.category?.code ?? ''} ${expense.category?.name ?? ''}`}
              data-sort-supplier={supplierName}
              data-sort-amount={String(amount)}
              data-sort-vat={String(Number(expense.vatRate))}
              data-sort-description={expense.description ?? ''}
              data-sort-payment-state={overdue ? paymentStatusStyles.SCADUTO.label : paymentStyle.label}
              data-sort-invoice-state={invoiceStyle.label}
              data-sort-ebill={expense.hasElectronicInvoice ? '1' : '0'}
              data-sort-residual={String(residual)}
              tabIndex={0}
            >
              {selectable ? <td className="cell-option cell-center"><input form={formId} type="checkbox" name="ids" value={expense.id} aria-label={`Seleziona spesa ${expense.id}`} /></td> : null}
              <td className="cell-order-date">{dateLabel(expense.receivedDate)}</td>
              <td className="cell-billing-period">{formatPeriod(expense.month, expense.year)}</td>
              <td className="cell-type"><span className={expense.isRecurring ? 'badge color-badge recurring-expense-badge' : 'badge color-badge single-expense-badge'}>{expense.isRecurring ? 'R' : 'S'}</span></td>
              <td className="cell-category">{expense.category ? <span title={expense.category.name} className={badgeClass(categoryClassName)}>{categoryLabel(expense.category, expense.category.code)}</span> : '-'}</td>
              {showSupplierColumn ? <td className="cell-supplier cell-compact" title={supplierName}>{expense.supplierId ? <Link className="supplier-table-link" href={`/suppliers/${expense.supplierId}?returnTo=${returnTo}`}>{supplierName}</Link> : supplierName}</td> : null}
              <td className="cell-amount"><strong className={moneyTone(amount)}>{euro(expense.amount as string | number)}</strong></td>
              <td className="cell-vat"><span className={badgeClass(vatStyle.className)}>{Number(expense.vatRate)}%</span></td>
              <td className="cell-description" title={expense.description ?? ''}>{expense.description ?? '-'}</td>
              <td className="cell-payment-state">{overdue ? <span className={badgeClass(paymentStatusStyles.SCADUTO.className)}>{paymentStatusStyles.SCADUTO.icon} {paymentStatusStyles.SCADUTO.label}</span> : <span className={badgeClass(paymentStyle.className)}>{paymentStyle.icon} {paymentStyle.label}</span>}</td>
              <td className="cell-invoice-state"><span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span></td>
              <td className="cell-ebilling">{invoiceBadge(expense.hasElectronicInvoice, expense.invoiceStatus)}</td>
              <td className="cell-residual"><strong className={residual > 0 ? 'text-warning' : 'text-ok'}>{euro(residual)}</strong></td>
            </tr>;
          })}
          {!expenses.length && <tr><td colSpan={(selectable ? 1 : 0) + (showSupplierColumn ? 12 : 11)}>{emptyMessage}</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
