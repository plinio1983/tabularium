import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { euro, moneyTone } from '@/lib/money';
import {
  badgeClass,
  categoryStyles,
  invoiceStatusStyles,
  paymentStatusStyles,
  yesNoStyles
} from '@/lib/expense-ui';

function valueOrDash(value?: string | null) {
  return value && value.trim() ? value : '-';
}

function dateLabel(value?: Date | null) {
  return value ? value.toLocaleDateString('it-IT') : '-';
}

function formatPeriod(month: number, year: number) {
  const monthName = new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(new Date(year, month - 1, 1));
  const normalized = monthName.charAt(0).toUpperCase() + monthName.slice(1).replace('.', '');
  return `${normalized} ${year}`;
}

function booleanBadge(value: boolean) {
  const item = value ? yesNoStyles.yes : yesNoStyles.no;
  return <span className={badgeClass(item.className)}>{item.icon} {item.label}</span>;
}

function electronicInvoiceBadge(value: boolean, invoiceStatus?: string) {
  const style = invoiceStatus ? (invoiceStatusStyles[invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA) : yesNoStyles.yes;
  let state = invoiceStatus;
  if (invoiceStatus === "IN_ATTESA") {
    state = ' - Wait';
  }
  if (invoiceStatus === "RICEVUTA") {
    state = ' - Ok';
  }
  const label = !value ? 'Fatt' : '@bill';
  return <span className={badgeClass(style.className)}>{label}{state}</span>;
}

function mobileDateLabel(value?: Date | null) {
  return value ? value.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '-';
}

function isExpensePastDueForBadge(expense: { dueDate?: Date | null; paymentStatus?: string | null }) {
  if (!expense.dueDate || expense.paymentStatus === 'COMPLETATO') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(expense.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}

function isExpenseUnpaid(expense: { paymentStatus?: string | null }) {
  return expense.paymentStatus === 'DA_PAGARE' || expense.paymentStatus === 'PAGATO_PARZIALMENTE';
}

function CopyableField({ label, value }: { label: string; value?: string | null }) {
  const displayValue = valueOrDash(value);
  return <div className="copyable-detail-field">
    <span>{label}</span>
    <strong>{displayValue}</strong>
    <button type="button" className="copy-value-button" data-copy={displayValue === '-' ? '' : displayValue} title="Copia valore">⧉</button>
  </div>;
}

export default async function SupplierDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/suppliers';
  const supplier = await prisma.supplier.findUnique({
    where: { id: Number(id) },
    include: { expenses: { include: { payments: true, category: true }, orderBy: [{ year: 'desc' }, { month: 'desc' }, { receivedDate: 'desc' }] } }
  });
  if (!supplier) notFound();

  const openExpenses = supplier.expenses.map(expense => {
    const amount = Number(expense.amount.toString());
    const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
    return { expense, residual: Math.max(0, amount - paid) };
  }).filter(item => item.residual > 0);
  const amountToPay = openExpenses.reduce((sum, item) => sum + item.residual, 0);
  const supplierDetailHref = `/suppliers/${supplier.id}`;
  const encodedSupplierDetailHref = encodeURIComponent(supplierDetailHref);

  return <div className="grid">
    <div className="toolbar-card supplier-toolbar-card">
      <div className="actions-row">
        <Link className="table-action secondary" href={returnTo}>↩ Indietro</Link>
        <Link className="table-action" href={`/suppliers/${supplier.id}/edit`}>✎ Modifica</Link>
      </div>
      <div>
        <h2>Dettaglio fornitore</h2>
        <p className="muted">{supplier.businessName}</p>
      </div>
    </div>

    <script dangerouslySetInnerHTML={{ __html: `
      document.addEventListener('click', async function(event) {
        const button = event.target.closest('[data-copy]');
        if (!button) return;
        const value = button.getAttribute('data-copy') || '';
        if (!value) return;
        try { await navigator.clipboard.writeText(value); button.textContent = '✓'; setTimeout(() => button.textContent = '⧉', 900); } catch (e) { alert('Impossibile copiare il valore.'); }
      });
    ` }} />

    <div className="card detail-grid supplier-detail-grid">
      <CopyableField label="Ragione Sociale" value={supplier.businessName} />
      <CopyableField label="Alias" value={supplier.alias} />
      <CopyableField label="Email" value={supplier.email} />
      <CopyableField label="Telefono" value={supplier.phone} />
      <CopyableField label="PEC" value={supplier.pec} />
      <CopyableField label="Codice SDI/Codice Fiscale" value={supplier.taxCodeSdi} />
      <div><span>Ordini da saldare</span><strong>{openExpenses.length}</strong></div>
      <div><span>Importo da saldare</span><strong className={amountToPay > 0 ? 'text-warning' : 'text-ok'}>{euro(amountToPay)}</strong></div>
      <CopyableField label="Note interne" value={supplier.internalNotes} />
    </div>

    <div className="card expenses-list-card">
      <div className="list-heading">
        <div>
          <h2>Spese collegate</h2>
          <p className="muted">Risultati mostrati: {supplier.expenses.length}</p>
        </div>
      </div>

      <div className="expense-mobile-list supplier-linked-expenses-mobile-list" aria-label="Spese collegate mobile">
        {supplier.expenses.map(expense => {
          const amount = Number(expense.amount.toString());
          const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
          const residual = Math.max(0, amount - paid);
          const categoryStyle = expense.category?.name ? categoryStyles[expense.category.name] : undefined;
          const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
          const invoiceStyle = invoiceStatusStyles[expense.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
          const invoiceLabel = expense.invoiceStatus === "IN_ATTESA" ? "Attesa" : invoiceStyle.label;
          const overdue = isExpensePastDueForBadge(expense);
          const unpaid = isExpenseUnpaid(expense);
          const statusStyle = overdue ? paymentStatusStyles.SCADUTO : paymentStyle;
          const declaredBadgeLabel = expense.isDeclared ? "DF" : "NF";
          let recordAddClass = "";
          if (overdue) {
            recordAddClass = "expense-mobile-item-overdue";
          } else if (unpaid) {
            recordAddClass = "expense-mobile-item-unpaid";
          }
          const recordClass = `expense-mobile-item ${recordAddClass}`;
          return <div className={recordClass} key={`mobile-linked-expense-${expense.id}`}>
            <Link className="expense-mobile-link" href={`/expenses/${expense.id}?returnTo=${encodedSupplierDetailHref}`}>
              <div className="expense-mobile-main">
                <div className="expense-mobile-meta">
                  <div className="expense-mobile-meta-left">
                    {expense.category ? <span title={expense.category.name} className={badgeClass(categoryStyle?.className)}>{categoryStyle?.icon ?? '•'} {categoryStyle?.acronym ?? expense.category.code}</span> : null}
                    <span className={badgeClass("")}>{declaredBadgeLabel}</span>
                    <span className="expense-mobile-date">{formatPeriod(expense.month, expense.year)}</span>
                  </div>
                  <div className="expense-mobile-meta-right">
                    {electronicInvoiceBadge(expense.hasElectronicInvoice, expense.invoiceStatus)}
                    <span className="expense-mobile-date">{mobileDateLabel(expense.dueDate)}</span>
                    {/*{booleanBadge(expense.isDeclared)}*/}
                  </div>
                </div>
                <div className="expense-mobile-title-row">
                  <span className={expense.isRecurring ? 'badge color-badge recurring-expense-badge' : 'badge color-badge single-expense-badge'}>{expense.isRecurring ? 'R' : 'S'}</span>
                  <div className="expense-mobile-title-left">
                    <strong>{supplier.businessName}</strong>
                  </div>
                  <div className="expense-mobile-title-right">
                    <span className={moneyTone(amount)}>{euro(amount)}</span>
                  </div>
                </div>
                <div className="expense-mobile-subtitle">
                  <div>{expense.description || 'Spesa senza descrizione'}</div>
                  <div><span className={badgeClass(statusStyle.className)}>{statusStyle.label}</span></div>
                </div>
                {/*{residual > 0 ? <div className="expense-mobile-footer">*/}
                {/*  <strong className="text-warning">Residuo {euro(residual)}</strong>*/}
                {/*</div> : null}*/}
              </div>
            </Link>
          </div>;
        })}
        {!supplier.expenses.length ? <div className="expense-mobile-empty">Nessuna spesa collegata a questo fornitore.</div> : null}
      </div>

      <div className="table-scroll"><table className="supplier-linked-expenses-table"><thead><tr>
        <th className="cell-option"></th>
        <th className="cell-order-date">Data ordine</th>
        <th className="cell-billing-period">Periodo Fatt.</th>
        <th className="cell-category">Categoria</th>
        <th className="cell-payment-state">Stato Pagam.</th>
        <th className="cell-amount">Importo</th>
        <th className="cell-fiscal">Dichiarazione</th>
        <th className="cell-invoice-state">Stato <br />Fatt.</th>
        <th className="cell-ebilling">e-Bill</th>
        <th className="cell-description">Descrizione</th>
      </tr></thead><tbody>
        {supplier.expenses.map(expense => {
          const amount = Number(expense.amount.toString());
          const categoryStyle = expense.category?.name ? categoryStyles[expense.category.name] : undefined;
          const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
          const invoiceStyle = invoiceStatusStyles[expense.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
          return <tr key={expense.id}>
            <td className="cell-option"><Link className="table-action secondary icon-action" title="Dettaglio spesa" aria-label="Dettaglio spesa" href={`/expenses/${expense.id}?returnTo=${encodedSupplierDetailHref}`}>👁</Link></td>
            <td className="cell-order-date">{dateLabel(expense.receivedDate)}</td>
            <td className="cell-billing-period">{formatPeriod(expense.month, expense.year)}</td>
            <td className="cell-category">{expense.category ? <span title={expense.category.name} className={badgeClass(categoryStyle?.className)}>{categoryStyle?.icon ?? '•'} {categoryStyle?.acronym ?? expense.category.code}</span> : '-'}</td>
            <td className="cell-payment-state"><span className={badgeClass(paymentStyle.className)}>{paymentStyle.icon} {paymentStyle.label}</span></td>
            <td className="cell-amount"><strong>{euro(amount)}</strong></td>
            <td className="cell-fiscal">{booleanBadge(expense.isDeclared)}</td>
            <td className="cell-invoice-state"><span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span></td>
            <td className="cell-ebilling">{booleanBadge(expense.hasElectronicInvoice)}</td>
            <td className="cell-description" title={expense.description ?? ''}>{expense.description ?? '-'}</td>
          </tr>;
        })}
        {!supplier.expenses.length && <tr><td colSpan={10}>Nessuna spesa collegata a questo fornitore.</td></tr>}
      </tbody></table></div>
    </div>
  </div>;
}
