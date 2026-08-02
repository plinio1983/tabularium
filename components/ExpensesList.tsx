import Link from 'next/link';
import BulkCopyExpensesModal from '@/components/BulkCopyExpensesModal';
import BulkEditFieldsModal from '@/components/BulkEditFieldsModal';
import BulkSelectionController from '@/components/BulkSelectionController';
import ClickableDesktopRows from '@/components/ClickableDesktopRows';
import ExpenseEditModalController from '@/components/ExpenseEditModalController';
import ExpenseNewTriggerButton from '@/components/ExpenseNewTriggerButton';
import ExpenseInvoiceAttachmentsLink from '@/components/ExpenseInvoiceAttachmentsLink';
import BulkExpenseAttachmentsModal from '@/components/BulkExpenseAttachmentsModal';
import SortableTableController from '@/components/SortableTableController';
import {euro, moneyTone} from '@/lib/money';
import {dueStatusLabel} from '@/lib/due-status-label';
import {DEFAULT_COMPANY_TIME_ZONE} from '@/lib/company-time';
import {
    badgeClass,
    categoryLabel,
    categoryTone, formatMonthPeriod,
    formatPeriod,
    invoiceStatusStyles,
    paymentStatusStyles,
    vatKey,
    vatStyles,
    yesNoStyles
} from '@/lib/expense-ui';
import {
    expenseResidualAmount,
    isExpenseOpen,
    isExpensePastDue,
    sortExpensesByReceivedDateDesc
} from '@/lib/expense-calculations';

type ExpenseListItem = {
    id: number;
    amount: unknown;
    receivedDate?: Date | null;
    dueDate?: Date | null;
    month: number;
    year: number;
    isRecurring: boolean;
    expenseType?: 'STANDARD' | 'VAT_SETTLEMENT' | 'COUNTER';
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
    payments?: Array<{ amount: unknown; paymentMethod?: { icon?: string | null } | null }>;
    attachments?: Array<{
        id: number;
        originalName: string;
        sizeBytes?: number | null;
        type: 'INVOICE' | 'DOCUMENT' | 'PAYMENT_RECEIPT'
    }>;
};

function invoiceAttachments(expense: ExpenseListItem) {
    return expense.attachments?.filter(attachment => attachment.type === 'INVOICE') ?? [];
}

type Option = {
    id: number;
    code?: string;
    name: string;
    icon?: string | null;
    isFallback?: boolean | null;
    kind?: string;
    systemRole?: string | null;
    isVatSettlementDefault?: boolean
};
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
    systemRole?: string | null;
    defaultExpenseCategoryId?: number | null;
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
    linkRecurringExpensesToDefinition?: boolean;
    timeZone?: string;
};

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

function fiscalBadgeMobile(value: boolean) {
    const item = value ? {className: ''} : yesNoStyles.no;
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
    let style = !value ? 'tone-muted' : yesNoStyles.yes.className;
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

function expensePaymentIcon(expense: ExpenseListItem) {
    // return expense.payments?.find(payment => payment.paymentMethod)?.paymentMethod?.icon ?? '  •  ';
    return expense.payments?.find(payment => payment.paymentMethod)?.paymentMethod?.icon ?? '';
}

function expenseDetailHref(expense: ExpenseListItem, returnTo: string, linkRecurringExpensesToDefinition: boolean) {
    return linkRecurringExpensesToDefinition && expense.recurringExpenseId
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
                                         suppliers = [],
                                         linkRecurringExpensesToDefinition = false,
                                         timeZone = DEFAULT_COMPANY_TIME_ZONE
                                     }: Props) {
    const mobileItems = mobileExpenses ?? sortExpensesByReceivedDateDesc(expenses);
    const hasBulkControls = selectable && categories.length > 0;

    return <>
        <ClickableDesktopRows/>
        <SortableTableController/>
        {hasBulkControls ? <>
            <BulkSelectionController/>
            <BulkCopyExpensesModal formId={formId} action={`/api/expenses/bulk?returnTo=${returnTo}`}/>
            <BulkEditFieldsModal
                formId={formId}
                subject="spese"
                action={`/api/expenses/bulk?returnTo=${returnTo}`}
                categories={categories.map(category => ({
                    value: String(category.id),
                    label: category.name,
                    icon: category.icon
                }))}
                suppliers={suppliers}
                supplierEligibleIds={expenses.filter(expense => expense.expenseType === 'STANDARD').map(expense => expense.id)}
            />
            <form id={formId} action={`/api/expenses/bulk?returnTo=${returnTo}`} method="post" className="bulk-actions-bar grouped-bulk-actions-bar expense-bulk-actions-bar confirm-bulk-form" data-bulk-button-group="true">
                <label className="bulk-select-all-inline">
                    <input type="checkbox" className="bulk-select-all" data-bulk-target={formId} aria-label="Seleziona tutte le spese visibili"/>
                </label>
                <div className="bulk-action-buttons btn-group">
                  <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form={formId}>
                    <summary className="bulk-action-trigger">
                        <span className="btn-icon hidden-mobile">⚙</span>
                        <span className="hidden-sm-up">Actions</span>
                        <span className="hidden-sm-down">Bulk actions</span>
                    </summary>
                    <div className="bulk-action-menu-panel">
                        <button className="btn btn-sm btn-default" type="submit" name="bulkAction" value="export_csv"
                                formAction="/api/exports/expenses" formMethod="post" data-confirm-label="Esporta CSV">
                            <span className="btn-icon">⇩</span><span className="bulk-label">Esporta CSV</span>
                        </button>
                        <button className="btn btn-sm btn-default" type="submit" name="bulkAction" value="invoice_emitted">
                            <span className="btn-icon">✓</span><span className="bulk-label">Fattura emessa</span>
                        </button>
                        {/*<button className="btn btn-sm btn-default" type="submit" name="bulkAction" value="payment_completed"><span className="btn-icon">€</span><span className="bulk-label">Pagamento completato</span></button>*/}
                        <button className="btn btn-sm btn-default" type="button" data-bulk-add-payment>
                            <span className="btn-icon">＋</span><span className="bulk-label">Inserisci pagamento</span>
                        </button>
                        <BulkExpenseAttachmentsModal formId={formId}/>
                        <button className="btn btn-sm btn-default danger-menu-item bulk-menu-mobile-delete" type="submit"
                                name="bulkAction" value="delete" data-confirm-label="Rimuovi selezionati">
                            <span className="btn-icon">🗑</span><span className="bulk-label">Rimuovi selezionati</span>
                        </button>
                    </div>
                  </details>
                  <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form={formId} data-bulk-multi-edit="true"
                     data-edit-base="/expenses/" data-copy-base="/expenses/new?copyId=" data-edit-trigger-attr="data-expense-edit-id" data-copy-trigger-attr="data-expense-copy-id" data-return-to={returnTo}>
                    <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true">
                        <span className="btn-icon">✎</span>
                        <span className="hidden-sm-down">Modifica</span>
                    </a>
                    <a href="#" className="bulk-direct-link is-disabled" data-bulk-copy aria-disabled="true">
                        <span className="btn-icon">⧉</span>
                        <span className="hidden-sm-down">Copia</span>
                    </a>
                    <button type="submit" className="bulk-direct-link bulk-direct-danger hidden-sp" name="bulkAction" value="delete"
                            data-bulk-delete data-confirm-label="Elimina" disabled>
                        <span className="btn-icon icon-small">🗑</span>
                        <span className="hidden-sm-down">Elimina</span>
                    </button>
                  </div>
                </div>
                <div className="bulk-inner-container">
                    <ExpenseNewTriggerButton className="bulk-direct-link bulk-add-link btn btn-md btn-primary" floatingLabel="Aggiungi spesa">
                        <span className="btn-icon">+</span>
                        <span className="hidden-sm-down">Spesa</span>
                    </ExpenseNewTriggerButton>
                </div>
            </form>

            <ExpenseEditModalController
                categories={categories}
                banks={banks}
                paymentMethods={paymentMethods}
                suppliers={suppliers}
                listHref={decodeURIComponent(returnTo)}
                formId={formId}
            />
        </> : null}

        <div className="mobile-record-list" aria-label={mobileLabel}>
            {mobileItems.map(expense => {
                const isVatSettlement = expense.expenseType === 'VAT_SETTLEMENT';
                const amount = Number(expense.amount);
                const supplierName = expenseSupplierName(expense);
                const vatStyle = vatStyles[vatKey(expense.vatRate)] ?? vatStyles['22'];
                const categoryClassName = categoryTone(expense.category);
                const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
                const overdue = isExpensePastDue(expense, new Date(), timeZone);
                const unpaid = isExpenseOpen(expense);
                const paidAmount = Math.max(0, amount - expenseResidualAmount(expense));
                const statusLabel = dueStatusLabel({
                    dueDate: expense.dueDate,
                    isComplete: !unpaid,
                    isPartial: unpaid && paidAmount > 0.005,
                    completeLabel: paymentStatusStyles.COMPLETATO.label,
                    pendingFallback: paymentStyle.label,
                    timeZone
                });
                const invoiceWaiting = expense.invoiceStatus === 'IN_ATTESA';
                const statusStyle = overdue ? paymentStatusStyles.SCADUTO : paymentStyle;
                let recordAddClass = '';
                if (overdue) {
                    recordAddClass = 'mobile-record-item-overdue';
                } else if (unpaid) {
                    recordAddClass = 'mobile-record-item-unpaid';
                } else if (invoiceWaiting) {
                    recordAddClass = 'mobile-record-item-invoice-waiting';
                }
                const recordClass = `mobile-record-item ${recordAddClass}`;
                const detailHref = expenseDetailHref(expense, returnTo, linkRecurringExpensesToDefinition);

                return <div className={recordClass} key={`mobile-${expense.id}`}>
                    {selectable ? <div className="mobile-record-select">
                        <input form={formId} type="checkbox" name="ids" value={expense.id} aria-label={`Seleziona spesa ${expense.id}`}/>
                    </div> : null}
                    <Link className="mobile-record-link" href={detailHref}>
                        <div className="mobile-record-main">
                            <div className="mobile-record-meta">
                                <div className="mobile-record-meta-left">
                                    {expense.category ?
                                        <span title={expense.category.name} className={badgeClass(categoryClassName)}>{categoryLabel(expense.category, expense.category.code)}</span> : null}
                                    {!isVatSettlement ? fiscalBadgeMobile(expense.isDeclared) : null}
                                    <span className="mobile-record-date hidden-sp-up">{formatMonthPeriod(expense.month)}</span>
                                    <span className="mobile-record-date date-long hidden-sp-down">{formatPeriod(expense.month, expense.year)}</span>
                                </div>
                                <div className="mobile-record-meta-right">
                                    {!isVatSettlement && expense.isDeclared ?
                                        <span className="expense-invoice-indicator">{electronicInvoiceBadge(expense.hasElectronicInvoice, expense.invoiceStatus)}
                                            <ExpenseInvoiceAttachmentsLink attachments={invoiceAttachments(expense)}/></span> : null}
                                    <span className="ml-6 mobile-record-date">{mobileDateLabel(expense.dueDate)}</span>
                                </div>
                            </div>
                            <div className="mobile-record-title-row">
                                <span className={isVatSettlement ? 'badge color-badge vat-settlement-expense-badge' : expense.isRecurring ? 'badge color-badge recurring-expense-badge' : 'badge color-badge single-expense-badge'}>{isVatSettlement ? 'IVA' : expense.isRecurring ? 'R' : 'S'}</span>
                                <div className="mobile-record-title-left">
                                    <strong>{showSupplierColumn ? supplierName : (expense.description || 'Spesa senza descrizione')}</strong>
                                </div>
                                <div className="mobile-record-title-right">
                                    <span className={moneyTone(amount)}>{expensePaymentIcon(expense)} &nbsp;{euro(expense.amount as string | number)}</span>
                                </div>
                            </div>
                            <div className="mobile-record-subtitle">
                                <div className="mobile-record-subtitle-left">
                                    {showSupplierColumn ?
                                        <span className="expense-mobile-description">{expense.description || 'Spesa senza descrizione'}</span> : supplierName}
                                    {isVatSettlement ? <span className="badge tone-neutral">100%</span> :
                                        <span className={badgeClass(vatStyle.className)}>{Number(expense.vatRate)}%</span>}
                                </div>
                                <div>
                                    <span className={badgeClass(statusStyle.className)}> {statusLabel}</span>
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
                <thead>
                <tr>
                    {selectable ? <th className="cell-option cell-center">
                        <input type="checkbox" className="bulk-select-all" data-bulk-target={formId} aria-label="Seleziona tutte le spese"/>
                    </th> : null}
                    <th className="cell-order-date" data-sort-key="order-date" data-sort-type="date">
                        <span className="th-wrap">Data<br/>ordine</span></th>
                    <th className="cell-billing-period" data-sort-key="billing-period" data-sort-type="number">
                        <span className="th-wrap">Periodo<br/>Cont.</span></th>
                    <th className="cell-type" data-sort-key="type"><span className="th-wrap">Tipo</span></th>
                    <th className="cell-category" data-sort-key="category">Categ.</th>
                    {showSupplierColumn ? <th className="cell-supplier" data-sort-key="supplier">Esercente</th> : null}
                    <th className="cell-amount" data-sort-key="amount" data-sort-type="number">Importo</th>
                    <th className="cell-vat" data-sort-key="vat" data-sort-type="number">IVA</th>
                    <th className="cell-description" data-sort-key="description">Descrizione</th>
                    <th className="cell-payment-state" data-sort-key="payment-state">
                        <span className="th-wrap">Stato Pag.</span></th>
                    <th className="cell-invoice-state" data-sort-key="invoice-state">
                        <span className="th-wrap">Stato<br/>Fatt.</span></th>
                    <th className="cell-ebilling" data-sort-key="ebill" data-sort-type="number">
                        <span className="th-wrap">E-Bill</span></th>
                    <th className="cell-residual" data-sort-key="residual" data-sort-type="number">Residuo</th>
                </tr>
                </thead>
                <tbody>
                {expenses.map(expense => {
                    const isVatSettlement = expense.expenseType === 'VAT_SETTLEMENT';
                    const amount = Number(expense.amount);
                    const supplierName = expenseSupplierName(expense);
                    const residual = expenseResidualAmount(expense);
                    const categoryClassName = categoryTone(expense.category);
                    const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
                    const invoiceStyle = invoiceStatusStyles[expense.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
                    const overdue = isExpensePastDue(expense, new Date(), timeZone);
                    const paymentWaiting = residual > 0.005;
                    const paidAmount = Math.max(0, amount - residual);
                    const statusLabel = dueStatusLabel({
                        dueDate: expense.dueDate,
                        isComplete: !paymentWaiting,
                        isPartial: paymentWaiting && paidAmount > 0.005,
                        completeLabel: paymentStatusStyles.COMPLETATO.label,
                        pendingFallback: paymentStyle.label,
                        timeZone
                    });
                    const invoiceWaiting = expense.invoiceStatus === 'IN_ATTESA';
                    const vatStyle = vatStyles[vatKey(expense.vatRate)] ?? vatStyles['22'];
                    const detailHref = expenseDetailHref(expense, returnTo, linkRecurringExpensesToDefinition);

                    return <tr
                        key={expense.id}
                        className={[
                            'clickable-desktop-row',
                            overdue ? 'expense-row-overdue' : paymentWaiting ? 'expense-row-unpaid' : invoiceWaiting ? 'expense-row-invoice-waiting' : ''
                        ].filter(Boolean).join(' ')}
                        data-row-href={detailHref}
                        data-sort-row
                        data-sort-order-date={dateSortValue(expense.receivedDate)}
                        data-sort-billing-period={String(Number(expense.year) * 12 + Number(expense.month))}
                        data-sort-type={isVatSettlement ? 'IVA' : expense.isRecurring ? 'R' : 'S'}
                        data-sort-category={`${expense.category?.code ?? ''} ${expense.category?.name ?? ''}`}
                        data-sort-supplier={supplierName}
                        data-sort-amount={String(amount)}
                        data-sort-vat={isVatSettlement ? String(amount) : String(Number(expense.vatRate))}
                        data-sort-description={expense.description ?? ''}
                        data-sort-payment-state={statusLabel}
                        data-sort-invoice-state={invoiceStyle.label}
                        data-sort-ebill={expense.hasElectronicInvoice ? '1' : '0'}
                        data-sort-residual={String(residual)}
                        tabIndex={0}
                    >
                        {selectable ? <td className="cell-option cell-center">
                            <input form={formId} type="checkbox" name="ids" value={expense.id} aria-label={`Seleziona spesa ${expense.id}`}/>
                        </td> : null}
                        <td className="cell-order-date">{dateLabel(expense.receivedDate)}</td>
                        <td className="cell-billing-period">{formatPeriod(expense.month, expense.year)}</td>
                        <td className="cell-type">
                            <span className={isVatSettlement ? 'badge color-badge vat-settlement-expense-badge' : expense.isRecurring ? 'badge color-badge recurring-expense-badge' : 'badge color-badge single-expense-badge'}>{isVatSettlement ? 'IVA' : expense.isRecurring ? 'R' : 'S'}</span>
                        </td>
                        <td className="cell-category">{expense.category ?
                            <span title={expense.category.name} className={badgeClass(categoryClassName)}>{categoryLabel(expense.category, expense.category.code)}</span> : '-'}</td>
                        {showSupplierColumn ?
                            <td className="cell-supplier cell-compact" title={supplierName}>{expense.supplierId ?
                                <Link className="supplier-table-link" href={`/suppliers/${expense.supplierId}?returnTo=${returnTo}`}>{supplierName}</Link> : supplierName}</td> : null}
                        <td className="cell-amount">
                            <strong className={moneyTone(amount)}>{euro(expense.amount as string | number)} &nbsp; {expensePaymentIcon(expense)}</strong>
                        </td>
                        <td className="cell-vat">{isVatSettlement ? <span className="badge tone-neutral">100%</span> :
                            <span className={badgeClass(vatStyle.className)}>{Number(expense.vatRate)}%</span>}</td>
                        <td className="cell-description" title={expense.description ?? ''}>{expense.description ?? '-'}</td>
                        <td className="cell-payment-state">{overdue ?
                            <span className={badgeClass(paymentStatusStyles.SCADUTO.className)}>{paymentStatusStyles.SCADUTO.icon} {statusLabel}</span> :
                            <span className={badgeClass(paymentStyle.className)}>{paymentStyle.icon} {statusLabel}</span>}</td>
                        <td className="cell-invoice-state">{isVatSettlement ?
                            <span className="badge color-badge">✕</span> :
                            <span className="expense-invoice-indicator"><span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span><ExpenseInvoiceAttachmentsLink attachments={invoiceAttachments(expense)}/></span>}</td>
                        <td className="cell-ebilling">{isVatSettlement ?
                            <span className="badge color-badge tone-no">✕</span> : invoiceBadge(expense.hasElectronicInvoice, expense.invoiceStatus)}</td>
                        <td className="cell-residual">
                            <strong className={residual > 0 ? 'text-warning' : 'text-ok'}>{euro(residual)}</strong></td>
                    </tr>;
                })}
                {!expenses.length && <tr>
                    <td colSpan={(selectable ? 1 : 0) + (showSupplierColumn ? 12 : 11)}>{emptyMessage}</td>
                </tr>}
                </tbody>
            </table>
        </div>
    </>;
}
