import Link from 'next/link';
import ClickableDesktopRows from '@/components/ClickableDesktopRows';
import SortableTableController from '@/components/SortableTableController';
import IncomeEditModalController from '@/components/IncomeEditModalController';
import NewIncomePanel from '@/components/NewIncomePanel';
import BulkSelectionController from '@/components/BulkSelectionController';
import BulkChangeCategoryModal from '@/components/BulkChangeCategoryModal';
import BulkEditFieldsModal from '@/components/BulkEditFieldsModal';
import {euro, moneyTone} from '@/lib/money';
import {formatPeriod, vatStyles} from '@/lib/expense-ui';
import {
    badgeClass,
    fiscalStyles,
    incomeCreditStatusStyles,
    incomeInvoiceStatusStyles
} from '@/lib/income-ui';
import type {IncomeCashRegisterGroup} from '@/lib/income-list';

type IncomeItem = {
    id: number;
    billingMonth: number;
    billingYear: number;
    orderDate: Date | null;
    creditDate: Date | null;
    amount: unknown;
    vatRate: unknown;
    description: string | null;
    isFiscal: boolean;
    isCredited: boolean;
    invoiceStatus: string | null;
    salesChannelRef: { code: string; name: string; icon?: string | null };
    customer?: { id: number; businessName: string } | null;
    paymentMethodRef: { name: string; icon?: string | null };
    creditBank: { name: string; icon?: string | null };
};

function cashRegisterGroupHref(group: IncomeCashRegisterGroup) {
    const month = `${group.billingYear}-${String(group.billingMonth).padStart(2, '0')}`;
    const query = new URLSearchParams({
        month,
        paymentMethodId: String(group.paymentMethodId),
        salesChannelId: String(group.salesChannelId),
        fiscal: group.isFiscal ? 'yes' : 'no'
    });
    return `/incomes/cash-register/receipts?${query}`;
}

function aggregateVatLabel(group: IncomeCashRegisterGroup) {
    return group.vatRates.length === 1 ? `${group.vatRates[0]}%` : 'Mista';
}

function vatBadge(value: unknown) {
    const rate = Number(value);
    const style = vatStyles[String(rate)] ?? vatStyles['0'];
    return <span className={badgeClass(style.className)}>{rate}%</span>;
}

function aggregateVatBadge(group: IncomeCashRegisterGroup) {
    return group.vatRates.length === 1
        ? vatBadge(group.vatRates[0])
        : <span className={badgeClass('tone-neutral')}>Mista</span>;
}

function dateLabel(value?: Date | null) {
    return value ? new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(value) : '-';
}

function mobileDateLabel(value?: Date | null) {
    return value ? new Intl.DateTimeFormat('it-IT', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC'
    }).format(value).replace('.', '') : '-';
}

function dateSortValue(value?: Date | null) {
    return value ? String(new Date(value).getTime()) : '';
}

function localDateKey(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function creditStatus(income: IncomeItem) {
    if (income.isCredited) return incomeCreditStatusStyles.ACCREDITATO;
    const overdue = Boolean(income.creditDate) && localDateKey(income.creditDate!) < localDateKey(new Date());
    return overdue ? incomeCreditStatusStyles.SCADUTO : incomeCreditStatusStyles.DA_ACCREDITARE;
}

function fiscalBadge(value: boolean) {
    const style = value ? fiscalStyles.yes : fiscalStyles.no;
    return <span className={`${badgeClass(style.className)} income-badge-compact`}>{value ? '✓ DF' : '✕ NF'}</span>;
}

type EntityOption = { id: number; code: string; name: string; icon?: string | null };
type SimpleOption = { id: number; name: string; icon?: string | null; isFallback?: boolean | null; kind?: string };
type CategoryOption = { id: number; name: string; icon?: string | null };

export default function IncomesList({
                                        incomes,
                                        mobileIncomes: suppliedMobileIncomes,
                                        cashRegisterGroups = [],
                                        returnTo,
                                        banks,
                                        paymentMethods,
                                        salesChannels,
                                        customers,
                                        categories = [],
                                        initialCustomerId,
                                        initialOpen = false,
                                        emptyMessage = 'Nessun incasso trovato.'
                                    }: {
    incomes: IncomeItem[];
    mobileIncomes?: IncomeItem[];
    cashRegisterGroups?: IncomeCashRegisterGroup[];
    returnTo: string;
    banks: SimpleOption[];
    paymentMethods: SimpleOption[];
    salesChannels: EntityOption[];
    customers: Array<{ id: number; businessName: string; alias?: string | null; systemRole?: string | null }>;
    categories?: CategoryOption[];
    initialCustomerId?: number;
    initialOpen?: boolean;
    emptyMessage?: string;
}) {
    const mobileIncomes = suppliedMobileIncomes ?? [...incomes].sort((a, b) => (b.creditDate?.getTime() ?? 0) - (a.creditDate?.getTime() ?? 0) || b.id - a.id);
    const formId = 'incomeBulkForm';

    return <div className="incomes-list-shared">
        <BulkSelectionController/>
        <ClickableDesktopRows/>
        <SortableTableController/>
        <NewIncomePanel initialOpen={initialOpen} showToolbar={false} banks={banks} paymentMethods={paymentMethods} salesChannels={salesChannels} customers={customers} initialCustomerId={initialCustomerId}/>
        <IncomeEditModalController returnTo={decodeURIComponent(returnTo)} banks={banks} paymentMethods={paymentMethods} salesChannels={salesChannels} customers={customers}/>
        <BulkEditFieldsModal formId={formId} subject="incassi"/>
        <BulkChangeCategoryModal
            formId={formId}
            action={`/api/incomes/bulk?returnTo=${returnTo}`}
            fieldName="incomeCategoryId"
            categories={categories.map(category => ({value: String(category.id), label: category.name, icon: category.icon}))}
            hideTrigger
        />
        <form id={formId} action={`/api/incomes/bulk?returnTo=${returnTo}`} method="post" className="bulk-actions-bar confirm-bulk-form">
            <label className="bulk-select-all-inline"><input type="checkbox" className="bulk-select-all" data-bulk-target={formId} aria-label="Seleziona tutti gli incassi visibili"/></label>
            <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form={formId}>
                <summary className="bulk-action-trigger">
                    <span className="btn-icon">⚙</span><span className="bulk-label"><span className="floating-bulk-label">Bulk </span>Actions</span>
                </summary>
                <div className="bulk-action-menu-panel">
                    <button className="btn btn-sm btn-default" type="submit" name="bulkAction" value="export_csv"
                            formAction="/api/exports/incomes" formMethod="post" data-confirm-label="Esporta CSV">
                        <span className="btn-icon">⇩</span><span className="bulk-label">Esporta CSV</span>
                    </button>
                    <button className="btn btn-sm btn-default" type="submit" name="bulkAction" value="invoice_emitted">
                        <span className="btn-icon">✓</span><span className="bulk-label">Fattura emessa</span></button>
                    <button className="btn btn-sm btn-default danger-menu-item bulk-menu-mobile-delete" type="submit"
                            name="bulkAction" value="delete" data-confirm-label="Rimuovi selezionati">
                        <span className="btn-icon">🗑</span><span className="bulk-label">Rimuovi selezionati</span>
                    </button>
                </div>
            </details>
            <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form={formId} data-bulk-multi-edit="true" data-edit-base="/incomes/" data-copy-base="/incomes/new?copyId=" data-edit-trigger-attr="data-income-edit-id" data-copy-trigger-attr="data-income-copy-id" data-return-to={returnTo}>
                <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true"><span className="btn-icon">✎</span><span className="bulk-label">Modifica</span></a>
                <a href="#" className="bulk-direct-link is-disabled" data-bulk-copy aria-disabled="true"><span className="btn-icon">⧉</span><span className="bulk-label">Copia</span></a>
                <button type="submit" className="bulk-direct-link bulk-direct-danger hidden-sp" name="bulkAction" value="delete" data-bulk-delete data-confirm-label="Elimina" disabled>
                    <span className="btn-icon">🗑</span><span className="bulk-label">Elimina</span></button>
            </div>
            <div className="bulk-inner-container">
                <button className="bulk-direct-link btn btn-md btn-primary" type="button" data-bulk-new data-income-new data-floating-label="Incasso">
                    <span className="btn-icon">+</span><span className="bulk-label">Incasso</span></button>
            </div>
        </form>
        <div className="income-mobile-list expense-mobile-list" aria-label="Lista incassi mobile">
            {cashRegisterGroups.map(group => {
                const fiscalStyle = group.isFiscal ? fiscalStyles.yes : fiscalStyles.no;
                const vatStyle = vatStyles[String(Number(group.vatRates))] ?? vatStyles['0'];
                return <div className="income-mobile-item expense-mobile-item cash-register-aggregate-mobile-item" key={`mobile-cash-${group.key}`}>
                    <div className="expense-mobile-select">
                        <input type="checkbox" disabled aria-label="I cumulativi degli scontrini non sono selezionabili"/>
                    </div>
                    <Link className="expense-mobile-link income-mobile-link" href={cashRegisterGroupHref(group)}>
                        <div className="expense-mobile-main">
                            <div className="expense-mobile-header">
                                <div className="left-side flex-grow">
                                    <span className="badge income-badge-compact">🧾 Scontrini</span>
                                    <span className={`${badgeClass(fiscalStyle.className)} income-badge-compact`}>{group.isFiscal ? '✓ DF' : '✕ NF'}</span>
                                    {/*<span className="text-pre text-muted">{formatPeriod(group.billingMonth, group.billingYear)}</span>*/}
                                </div>
                                <div className="right-side">
                                    <strong className="expense-mobile-date text-pre">{mobileDateLabel(group.latestCreditDate)}</strong>
                                </div>
                            </div>
                            <div className="expense-mobile-title-row">
                                <div className="left-side flex-grow pl-6">
                                    <span>{group.salesChannelIcon ?? ''} {group.salesChannel}</span>
                                    <div className="expense-mobile-subtitle">{group.count} {group.count === 1 ? 'scontrino' : 'scontrini'}</div>
                                </div>
                                <div className="right-side">
                                    <span>{group.paymentMethodIcon ?? '  •  '}</span>
                                    <span className={moneyTone(group.amount)}>{euro(group.amount)}</span>
                                </div>
                            </div>
                            <div className="expense-mobile-title-row income-mobile-status-row">
                                <span className={badgeClass(vatStyle.className)}>IVA &nbsp;{Number(group.vatRates)}%</span>
                                {/*<span className="badge">IVA &nbsp;{aggregateVatLabel(group)}</span>*/}
                                <small className="text-muted">{formatPeriod(group.billingMonth, group.billingYear)}</small>
                                <span className={badgeClass(incomeCreditStatusStyles.ACCREDITATO.className)}>
                                    {incomeCreditStatusStyles.ACCREDITATO.icon} {incomeCreditStatusStyles.ACCREDITATO.label}
                                </span>
                            </div>
                        </div>
                    </Link>
                </div>;
            })}
            {mobileIncomes.map(income => {
                const paymentMethod = income.paymentMethodRef.name;
                const invoiceStyle = incomeInvoiceStatusStyles[income.invoiceStatus || 'NONE'] ?? incomeInvoiceStatusStyles.NONE;
                const status = creditStatus(income);
                const vatStyle = vatStyles[String(Number(income.vatRate))] ?? vatStyles['0'];
                const amount = Number(income.amount);
                const recordClass = ['income-mobile-item', 'expense-mobile-item', status === incomeCreditStatusStyles.SCADUTO ? 'expense-mobile-item-overdue' : !income.isCredited || income.invoiceStatus === 'NON_INVIATA' || income.invoiceStatus === 'PARZIALE' ? 'income-row-warning' : ''].filter(Boolean).join(' ');
                return <div className={recordClass} key={`mobile-income-${income.id}`}>
                    <div className="expense-mobile-select">
                        <input form={formId} type="checkbox" name="ids" value={income.id} aria-label={`Seleziona incasso ${income.id}`}/>
                    </div>
                    <Link className="expense-mobile-link income-mobile-link" href={`/incomes/${income.id}?returnTo=${returnTo}`}>
                        <div className="expense-mobile-main">
                            <div className="expense-mobile-header">
                                <div className="left-side flex-grow">
                                    <span className="badge">{income.salesChannelRef.name}</span>
                                    {fiscalBadge(income.isFiscal)}
                                    <span className="text-muted">
                                        {/*{formatPeriod(income.billingMonth, income.billingYear)}*/}
                                    </span>
                                    {income.isFiscal ?
                                        <span title={invoiceStyle.label} className={`${badgeClass(invoiceStyle.className)} income-badge-compact`}>{invoiceStyle.icon} {invoiceStyle.label}</span> : ''}
                                </div>
                                <div className="right-side">
                                    <span className="badge expense-mobile-date text-pre">{mobileDateLabel(income.creditDate)}</span>
                                </div>
                            </div>
                            <div className="expense-mobile-title-row">
                                <div className="left-side flex-grow pl-6">
                                    <span>{income.customer?.businessName}</span>
                                    <div className="expense-mobile-subtitle flex-grow">{income.description ? `${income.description}` : ''}</div>
                                </div>
                                <div className="right-side">
                                    <span>{income.paymentMethodRef?.icon ?? '  •  '}</span><span className={moneyTone(amount)}>{euro(amount)}</span>
                                </div>
                            </div>
                            {/*<div className="expense-mobile-title-row">*/}
                            {/*    <div className="expense-mobile-subtitle flex-grow">{income.description ? `${income.description}` : ''}</div>*/}
                            {/*</div>*/}
                            <div className="expense-mobile-title-row income-mobile-status-row">
                                <span className={badgeClass(vatStyle.className)}>IVA &nbsp; {Number(income.vatRate)}%</span>
                                <small className="text-pre text-muted">{formatPeriod(income.billingMonth, income.billingYear)}</small>
                                <span title={status.label} className={`${badgeClass(status.className)} income-badge-compact`}>{status.icon} {status.label}</span>
                            </div>
                        </div>
                    </Link>
                </div>;
            })}
            {!incomes.length && !cashRegisterGroups.length ? <div className="expense-empty-panel">{emptyMessage}</div> : null}
        </div>

        <div className="table-scroll incomes-table-scroll">
            <table className="expenses-table incomes-table compact-incomes-table" data-sortable-table data-default-sort="credit-date" data-default-sort-dir="desc">
                <thead>
                <tr>
                    <th className="cell-option">
                        <input type="checkbox" className="bulk-select-all" data-bulk-target={formId} aria-label="Seleziona tutti gli incassi"/>
                    </th>
                    <th data-sort-key="billing-period" data-sort-type="number">Periodo fatt.</th>
                    <th data-sort-key="order-date" data-sort-type="date">Data ordine</th>
                    <th data-sort-key="sales-channel">Canale vendita</th>
                    <th data-sort-key="customer">Cliente</th>
                    <th data-sort-key="fiscal">Fisc.</th>
                    <th data-sort-key="amount" data-sort-type="number">Importo</th>
                    <th data-sort-key="description">Descrizione</th>
                    <th data-sort-key="vat" data-sort-type="number">IVA</th>
                    <th data-sort-key="credit-status">Accr.</th>
                    <th data-sort-key="invoice-status">Stato fatt.</th>
                    <th data-sort-key="credit-date" data-sort-type="date">Data accr.</th>
                    <th data-sort-key="payment-method">Metodo pag.</th>
                </tr>
                </thead>
                <tbody>
                {cashRegisterGroups.map(group => {
                    const credited = incomeCreditStatusStyles.ACCREDITATO;
                    return <tr className="clickable-desktop-row cash-register-aggregate-table-row"
                               data-row-href={cashRegisterGroupHref(group)}
                               data-sort-row
                               data-sort-billing-period={String(group.billingYear * 12 + group.billingMonth)}
                               data-sort-order-date={dateSortValue(group.latestCreditDate)}
                               data-sort-credit-date={dateSortValue(group.latestCreditDate)}
                               data-sort-sales-channel={group.salesChannel}
                               data-sort-customer="Registratore di cassa"
                               data-sort-fiscal={group.isFiscal ? '1' : '0'}
                               data-sort-description={`${group.count} scontrini`}
                               data-sort-amount={String(group.amount)}
                               data-sort-vat={aggregateVatLabel(group)}
                               data-sort-credit-status={credited.label}
                               data-sort-invoice-status=""
                               data-sort-payment-method={group.paymentMethod}
                               tabIndex={0}
                               key={`cash-${group.key}`}>
                        <td className="cell-option">
                            <input type="checkbox" disabled aria-label="I cumulativi degli scontrini non sono selezionabili"/>
                        </td>
                        <td>{formatPeriod(group.billingMonth, group.billingYear)}</td>
                        <td>{dateLabel(group.latestCreditDate)}</td>
                        <td>{group.salesChannelIcon ?? '  •  '} {group.salesChannel}</td>
                        <td>🧾 Registratore di cassa</td>
                        <td>{fiscalBadge(group.isFiscal)}</td>
                        <td><strong className={moneyTone(group.amount)}>{euro(group.amount)}</strong></td>
                        <td>{group.count} {group.count === 1 ? 'scontrino' : 'scontrini'}</td>
                        <td>{aggregateVatBadge(group)}</td>
                        <td><span className={badgeClass(credited.className)}>{credited.icon} {credited.label}</span></td>
                        <td className=""><span className="badge badge-color tone-muted">-</span></td>
                        <td>{dateLabel(group.latestCreditDate)}</td>
                        <td>{group.paymentMethodIcon ?? '  •  '} {group.paymentMethod}</td>
                    </tr>;
                })}
                {incomes.map(income => {
                    const status = creditStatus(income);
                    const invoice = incomeInvoiceStatusStyles[income.invoiceStatus || 'NONE'] ?? incomeInvoiceStatusStyles.NONE;
                    const paymentMethod = income.paymentMethodRef.name;
                    const rowClass = ['clickable-desktop-row', status === incomeCreditStatusStyles.SCADUTO ? 'income-row-overdue' : !income.isCredited || income.invoiceStatus === 'NON_INVIATA' || income.invoiceStatus === 'PARZIALE' ? 'income-row-warning' : ''].filter(Boolean).join(' ');
                    return <tr className={rowClass} data-row-href={`/incomes/${income.id}?returnTo=${returnTo}`} data-sort-row
                               data-sort-billing-period={String(income.billingYear * 12 + income.billingMonth)}
                               data-sort-order-date={dateSortValue(income.orderDate ?? income.creditDate)}
                               data-sort-credit-date={dateSortValue(income.creditDate)}
                               data-sort-sales-channel={income.salesChannelRef.name} data-sort-customer={income.customer?.businessName ?? ''} data-sort-fiscal={income.isFiscal ? '1' : '0'}
                               data-sort-description={income.description ?? ''}
                               data-sort-amount={String(Number(income.amount))} data-sort-vat={String(Number(income.vatRate))}
                               data-sort-payment-method={paymentMethod}
                               data-sort-credit-status={status.label} data-sort-invoice-status={invoice.label} tabIndex={0} key={income.id}>
                        <td className="cell-option">
                            <input form={formId} type="checkbox" name="ids" value={income.id} aria-label={`Seleziona incasso ${income.id}`}/>
                        </td>
                        <td>{formatPeriod(income.billingMonth, income.billingYear)}</td>
                        <td>{dateLabel(income.orderDate ?? income.creditDate)}</td>
                        <td>{income.salesChannelRef.icon ?? '  •  '} {income.salesChannelRef.name}</td>
                        <td>{income.customer ?
                            <Link href={`/clients/${income.customer.id}?returnTo=${returnTo}`}>{income.customer.businessName}</Link> : '-'}</td>
                        <td>{fiscalBadge(income.isFiscal)}</td>
                        <td><strong className={moneyTone(Number(income.amount))}>{euro(Number(income.amount))}</strong>
                        </td>
                        <td>{income.description ?? '-'}</td>
                        <td>{vatBadge(income.vatRate)}</td>
                        <td><span className={badgeClass(status.className)}>{status.icon} {status.label}</span></td>
                        <td>{income.isFiscal ?
                            <span className={badgeClass(invoice.className)}>{invoice.icon} {invoice.label}</span> : <span className="badge tone-muted">-</span> }</td>
                        <td>{dateLabel(income.creditDate)}</td>
                        <td>{income.paymentMethodRef?.icon ?? '  •  '} {paymentMethod}</td>
                    </tr>;
                })}
                {!incomes.length && !cashRegisterGroups.length ? <tr>
                    <td colSpan={13}>{emptyMessage}</td>
                </tr> : null}</tbody>
            </table>
        </div>
    </div>;
}
