import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { euro, moneyTone } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';
import { stripFlashParams } from '@/lib/flash';
import {
  badgeClass,
  categoryLabel,
  categoryTone,
  invoiceStatusStyles,
  paymentStatusStyles, vatKey,
  vatRateLabel, vatStyles,
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

function fiscalBadge(value: boolean) {
  const item = value ? yesNoStyles.yes : yesNoStyles.no;
  const label = value ? '✓ Fisc.' : '✕ N.F.';
  return <span className={badgeClass(item.className)}>{label}</span>;
}

function invoiceBadge(value: boolean, invoiceStatus?: string) {
  // const style = invoiceStatus ? (invoiceStatusStyles[invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA) : yesNoStyles.yes;
  const style = !value ? (invoiceStatus === 'NON_PREVISTA' ? yesNoStyles.no.className : "") : yesNoStyles.yes.className;
  const label = !value ? (invoiceStatus === 'NON_PREVISTA' ? '✕' : 'PDF') : '✓ eBill';
  return <span className={badgeClass(style)}>{label}</span>;
}

function electronicInvoiceBadge(value: boolean, invoiceStatus?: string) {
  const style = invoiceStatus ? (invoiceStatusStyles[invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA) : yesNoStyles.yes;
  let icon = '';
  let state = invoiceStatus;
  if (invoiceStatus === "IN_ATTESA") {
    icon = "×";
    state = "Fatt: Wait";
  }
  if (invoiceStatus === "RICEVUTA") {
    icon = "✓";
    state = "Fatt: Ok";
  }
  if (invoiceStatus === "NON_PREVISTA") {
    icon = "×";
    state = "No Fatt";
  }
  const label = !value ? 'Fatt' : '@bill';
  return <span className={badgeClass(style.className)}>{icon} {state}</span>;
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
  const current = await requireWorkspace('/suppliers');
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? stripFlashParams(rawReturnTo) : '/suppliers';
  const supplier = await prisma.supplier.findUnique({
    where: { id: Number(id) },
    include: { expenses: { include: { payments: true, category: true }, orderBy: [{ year: 'desc' }, { month: 'desc' }, { receivedDate: 'desc' }] } }
  });
  if (!supplier || supplier.workspaceId !== current.workspace.id) notFound();

  const openExpenses = supplier.expenses.map(expense => {
    const amount = Number(expense.amount.toString());
    const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
    return { expense, residual: Math.max(0, amount - paid) };
  }).filter(item => item.residual > 0);
  const amountToPay = openExpenses.reduce((sum, item) => sum + item.residual, 0);
  const supplierDetailHref = `/suppliers/${supplier.id}`;
  const encodedSupplierDetailHref = encodeURIComponent(supplierDetailHref);
  const currentYear = new Date().getFullYear();
  const annualExpenses = supplier.expenses.filter(expense => expense.year === currentYear);
  const annualPurchasedAmount = annualExpenses.reduce((sum, expense) => sum + Number(expense.amount.toString()), 0);

  return <div className="grid expense-detail-page supplier-detail-page">
    <script dangerouslySetInnerHTML={{ __html: `
      document.addEventListener('click', async function(event) {
        const button = event.target.closest('[data-copy]');
        if (!button) return;
        const value = button.getAttribute('data-copy') || '';
        if (!value) return;
        try { await navigator.clipboard.writeText(value); button.textContent = '✓'; setTimeout(() => button.textContent = '⧉', 900); } catch (e) { alert('Impossibile copiare il valore.'); }
      });
    ` }} />

    <div className="expense-detail-shell">
      <article className="expense-detail-document supplier-detail-document">
        <div className="expense-detail-action-row">
          <div className="left-side">
            <Link className="table-action secondary" href={returnTo}>↩ Indietro</Link>
          </div>
          <div className="right-side">
            <Link className="table-action" href={`/suppliers/${supplier.id}/edit`}>✎ Modifica</Link>
          </div>
        </div>

        <section className="expense-detail-hero">
          <div>
            <div className="expense-detail-title-block">
              <p className="expense-detail-kicker">Fornitore #{supplier.id}</p>
              <h1>{supplier.businessName}</h1>
              <div className="expense-detail-meta-line">
                <span>{valueOrDash(supplier.alias)}</span>
                <span className="badge">{supplier.expenses.length} spese collegate</span>
                {/*<span>{valueOrDash(supplier.email)}</span>*/}
              </div>
            </div>
          </div>

          <aside className="expense-detail-amount-panel">
            <div className="expense-detail-amount-panel-header-row">
              <span className="expense-detail-amount-panel-header">Da saldare</span>
            </div>
            <strong className={amountToPay > 0 ? 'text-warning' : 'text-ok'}>{euro(amountToPay)}</strong>
            <div className="expense-detail-badge-row">
              {/*<span className={badgeClass(amountToPay > 0 ? paymentStatusStyles.DA_PAGARE.className : yesNoStyles.yes.className)}>*/}
              {/*  {amountToPay > 0 ? `${paymentStatusStyles.DA_PAGARE.icon} Da saldare` : `${yesNoStyles.yes.icon} In pari`}*/}
              {/*</span>*/}
              {/*<span className="badge">{supplier.expenses.length} spese collegate</span>*/}
              <span className={badgeClass(amountToPay > 0 ? paymentStatusStyles.DA_PAGARE.className : yesNoStyles.yes.className)}>
                {openExpenses.length} ordini aperti
              </span>
            </div>
          </aside>
        </section>

        <section className="expense-detail-status-strip">
          <div>
            <span>Spese collegate</span>
            <strong>{supplier.expenses.length}</strong>
          </div>
          <div>
            <span>Ordini da saldare</span>
            <strong>{openExpenses.length}</strong>
          </div>
          <div>
            <span>Importo da saldare</span>
            <strong className={amountToPay > 0 ? 'text-warning' : 'text-ok'}>{euro(amountToPay)}</strong>
          </div>
          <div>
            <span>Acquistati {currentYear}</span>
            <strong>{euro(annualPurchasedAmount)}</strong>
          </div>
        </section>

        <section className="expense-detail-section">
          <div className="expense-detail-section-heading">
            <div>
              <h2>Anagrafica</h2>
              <p>Dati principali del fornitore.</p>
            </div>
          </div>
          <div className="expense-detail-status-strip supplier-detail-info-strip">
            <CopyableField label="R. Sociale" value={supplier.businessName} />
            <CopyableField label="Alias" value={supplier.alias} />
            <CopyableField label="Email" value={supplier.email} />
            <CopyableField label="Telefono" value={supplier.phone} />
            <CopyableField label="PEC" value={supplier.pec} />
            <CopyableField label="Cod. SDI" value={supplier.taxCodeSdi} />
            <CopyableField label="Note interne" value={supplier.internalNotes} />
          </div>
        </section>
      </article>
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
          const categoryClassName = categoryTone(expense.category);
          const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
          const invoiceStyle = invoiceStatusStyles[expense.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
          const invoiceLabel = expense.invoiceStatus === "IN_ATTESA" ? "Attesa" : invoiceStyle.label;
          const overdue = isExpensePastDueForBadge(expense);
          const unpaid = isExpenseUnpaid(expense);
          const statusStyle = overdue ? paymentStatusStyles.SCADUTO : paymentStyle;
          const declaredBadgeLabel = expense.isDeclared ? "DF" : "NF";
          const vatStyle = vatStyles[vatKey(expense.vatRate)] ?? vatStyles['22'];
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
                    {expense.category ? <span title={expense.category.name} className={badgeClass(categoryClassName)}>{categoryLabel(expense.category, expense.category.code)}</span> : null}
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
                  <div className="expense-mobile-subtitle-left">
                    <span className="expense-mobile-subtitle-description">{expense.description || 'Spesa senza descrizione'}</span>
                    <span className={badgeClass(vatStyle.className)}>{Number(expense.vatRate.toString())}%</span>
                  </div>
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

      <div className="table-scroll"><table className="expenses-table compact-expenses-table supplier-linked-expenses-table"><thead><tr>
        <th className="cell-order-date">Data<br/> ordine</th>
        <th className="cell-billing-period">Periodo<br/> Cont.</th>
        <th className="cell-type">Tipo</th>
        <th className="cell-category">Categ.</th>
        <th className="cell-amount">Importo</th>
        <th className="cell-vat">IVA</th>
        <th className="cell-description">Desc.</th>
        {/*<th className="cell-fiscal">Fisc.</th>*/}
        <th className="cell-payment-state">Stato<br/> Pagam.</th>
        <th className="cell-invoice-state">Stato <br />Fatt.</th>
        <th className="cell-ebilling">e-Bill</th>
      </tr></thead><tbody>
        {supplier.expenses.map(expense => {
          const amount = Number(expense.amount.toString());
          const categoryClassName = categoryTone(expense.category);
          const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
          const invoiceStyle = invoiceStatusStyles[expense.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
          const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
          const residual = Math.max(0, amount - paid);
          const overdue = isExpensePastDueForBadge(expense);
          const paymentWaiting = expense.paymentStatus !== 'COMPLETATO' || residual > 0;
          const invoiceWaiting = expense.invoiceStatus === 'IN_ATTESA';
          const vatStyle = vatStyles[vatKey(expense.vatRate)] ?? vatStyles['22'];
          return <tr
            key={expense.id}
            className={['clickable-desktop-row', overdue ? 'expense-row-overdue' : paymentWaiting || invoiceWaiting ? 'expense-row-warning' : ''].filter(Boolean).join(' ')}
            data-row-href={`/expenses/${expense.id}?returnTo=${encodedSupplierDetailHref}`}
            tabIndex={0}
          >
            <td className="cell-order-date">{dateLabel(expense.receivedDate)}</td>
            <td className="cell-billing-period">{formatPeriod(expense.month, expense.year)}</td>
            <td className="cell-type"><span className={expense.isRecurring ? 'badge color-badge recurring-expense-badge' : 'badge color-badge single-expense-badge'}>{expense.isRecurring ? 'R' : 'S'}</span></td>
            <td className="cell-category">{expense.category ? <span title={expense.category.name} className={badgeClass(categoryClassName)}>{categoryLabel(expense.category, expense.category.code)}</span> : '-'}</td>
            <td className="cell-amount"><strong className={moneyTone(amount)}>{euro(amount)}</strong></td>
            <td className="cell-vat"><span className={badgeClass(vatStyle.className)}>{Number(expense.vatRate.toString())}%</span></td>
            <td className="cell-description" title={expense.description ?? ''}>{expense.description ?? '-'}</td>
            {/*<td className="cell-fiscal">{fiscalBadge(expense.isDeclared)}</td>*/}
            <td className="cell-payment-state">{overdue ? <span className={badgeClass(paymentStatusStyles.SCADUTO.className)}>{paymentStatusStyles.SCADUTO.icon} {paymentStatusStyles.SCADUTO.label}</span> : <span className={badgeClass(paymentStyle.className)}>{paymentStyle.icon} {paymentStyle.label}</span>}</td>
            <td className="cell-invoice-state"><span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span></td>
            <td className="cell-ebilling">{invoiceBadge(expense.hasElectronicInvoice, expense.invoiceStatus)}</td>
          </tr>;
        })}
        {!supplier.expenses.length && <tr><td colSpan={10}>Nessuna spesa collegata a questo fornitore.</td></tr>}
      </tbody></table></div>
    </div>
  </div>;
}
