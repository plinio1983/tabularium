import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { euro, moneyTone } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';
import { stripFlashParams } from '@/lib/flash';
import ExpensesList from '@/components/ExpensesList';
import NewExpensePanel from '@/components/NewExpensePanel';
import SupplierBackButton from '@/components/SupplierBackButton';
import SupplierEditModalController from '@/components/SupplierEditModalController';
import DeleteActionButton from '@/components/DeleteActionButton';
import { badgeClass, paymentStatusStyles, yesNoStyles } from '@/lib/expense-ui';
import { orderBanks, orderExpenseCategories, orderPaymentMethods } from '@/lib/workspace-defaults';

function valueOrDash(value?: string | null) {
  return value && value.trim() ? value : '-';
}

function CopyableField({ label, value, className }: { label: string; value?: string | null; className?: string | undefined }) {
  const displayValue = valueOrDash(value);
  return <div className={`${className} copyable-detail-field`}>
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
  const [supplier, categories, banks, paymentMethods, suppliers] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id: Number(id) },
      include: { expenses: { include: { payments: true, category: true, supplier: true }, orderBy: [{ year: 'desc' }, { month: 'desc' }, { receivedDate: 'desc' }] } }
    }),
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);
  if (!supplier || supplier.workspaceId !== current.workspace.id) notFound();
  const orderedCategories = orderExpenseCategories(categories);
  const orderedBanks = orderBanks(banks);
  const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');

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
    <SupplierEditModalController/>
    <NewExpensePanel
      categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name, icon: c.icon }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name, isFallback: b.isFallback }))}
      paymentMethods={expensePaymentMethods.map(method => ({
        id: method.id,
        name: method.name,
        kind: method.kind,
        isFallback: method.isFallback
      }))}
      suppliers={suppliers.map(s => ({
        id: s.id,
        businessName: s.businessName,
        alias: s.alias,
        email: s.email,
        vatNumber: s.vatNumber,
        iban: s.iban,
        pec: s.pec,
        taxCodeSdi: s.taxCodeSdi,
        internalNotes: s.internalNotes
      }))}
      initialExpense={{ supplierId: supplier.id, merchant: supplier.businessName }}
      showToolbar={false}
    />
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
            <SupplierBackButton fallbackHref={returnTo}/>
          </div>
          <div className="right-side">
            <button className="btn btn-sm btn-primary" type="button" data-supplier-edit-id={supplier.id}>
              <span className="btn-icon">✎</span> Modifica
            </button>
            <DeleteActionButton
              action={`/api/suppliers/${supplier.id}`}
              confirmMessage="Confermi la rimozione del fornitore? L’operazione non può essere annullata."
              className="btn btn-sm btn-danger"
            >
              🗑 Elimina
            </DeleteActionButton>
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

        <details className="expense-detail-section supplier-detail-collapsible">
          <summary className="expense-detail-section-heading">
            <div>
              <h2>Anagrafica</h2>
              <p>Dati principali del fornitore.</p>
            </div>
            <span className="supplier-detail-collapsible-toggle" aria-hidden="true">⌄</span>
          </summary>
          <div className="expense-detail-status-strip supplier-detail-info-strip">
            <CopyableField label="R. Sociale" value={supplier.businessName} />
            <CopyableField label="Alias" value={supplier.alias} />
            <CopyableField label="Email" value={supplier.email} />
            <CopyableField label="P.IVA" value={supplier.vatNumber} />
            <CopyableField label="IBAN" value={supplier.iban} />
            <CopyableField label="PEC" value={supplier.pec} />
            <CopyableField label="Cod. SDI" value={supplier.taxCodeSdi} />
            <CopyableField label="Note interne" value={supplier.internalNotes} className="span-2"/>
          </div>
        </details>
      </article>
    </div>

    <div className="card expenses-list-card">
      <div className="list-heading">
        <div>
          <h2>Spese collegate</h2>
          <p className="muted">Risultati mostrati: {supplier.expenses.length}</p>
        </div>
      </div>

      <ExpensesList
        expenses={supplier.expenses}
        returnTo={encodedSupplierDetailHref}
        showSupplierColumn={false}
        selectable
        formId="expenseBulkForm"
        categories={orderedCategories.map(c => ({id: c.id, code: c.code, name: c.name, icon: c.icon }))}
        banks={orderedBanks.map(b => ({ id: b.id, name: b.name, isFallback: b.isFallback }))}
        paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback }))}
        suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, vatNumber: s.vatNumber, iban: s.iban, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes }))}
        mobileLabel="Spese collegate mobile"
        emptyMessage="Nessuna spesa collegata a questo fornitore."
      />
    </div>
  </div>;
}
