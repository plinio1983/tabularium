import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { euro, moneyTone } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';
import { detailBackHref } from '@/lib/detail-navigation';
import ExpensesList from '@/components/ExpensesList';
import NewExpensePanel from '@/components/NewExpensePanel';
import DetailBackButton from '@/components/DetailBackButton';
import SupplierEditModalController from '@/components/SupplierEditModalController';
import DeleteActionButton from '@/components/DeleteActionButton';
import { badgeClass, paymentStatusStyles, yesNoStyles } from '@/lib/expense-ui';
import { orderBanks, orderExpenseCategories, orderPaymentMethods } from '@/lib/workspace-defaults';
import {yearMonthInTimeZone} from '@/lib/company-time';
import CopyValueButton from '@/components/CopyValueButton';
import {isExpenseInvoiceNotReceived} from '@/lib/expense-invoice';

function valueOrDash(value?: string | null) {
  return value && value.trim() ? value : '-';
}

function CopyableField({ label, value, className }: { label: string; value?: string | null; className?: string | undefined }) {
  const displayValue = valueOrDash(value);
  return <div className={`${className} copyable-detail-field`}>
    <span>{label}</span>
    <strong className={label === 'Note interne' ? 'displayed-notes' : undefined}>{displayValue}</strong>
    <CopyValueButton value={displayValue === '-' ? '' : displayValue}/>
  </div>;
}

export default async function SupplierDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/suppliers');
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = detailBackHref(rawReturnTo, `/suppliers/${id}`, '/suppliers');
  const [supplier, categories, banks, paymentMethods, suppliers] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id: Number(id) },
      include: {
        defaultExpenseCategory: true,
        expenses: { where: {companyId: current.company.id}, include: { payments: { include: { paymentMethod: true }, orderBy: { id: 'asc' } }, category: true, supplier: true }, orderBy: [{ year: 'desc' }, { month: 'desc' }, { receivedDate: 'desc' }] }
      }
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
  const currentYear = yearMonthInTimeZone(current.company.timeZone).year;
  const annualExpenses = supplier.expenses.filter(expense => expense.year === currentYear);
  const annualPurchasedAmount = annualExpenses.reduce((sum, expense) => sum + Number(expense.amount.toString()), 0);
  const uninvoicedExpenses = supplier.expenses.filter(isExpenseInvoiceNotReceived);
  const uninvoicedAmount = uninvoicedExpenses.reduce((sum, expense) => sum + Number(expense.amount.toString()), 0);

  return <div className="grid record-detail-page party-detail-page">
    <SupplierEditModalController categories={orderedCategories.map(category => ({ id: category.id, name: category.name, icon: category.icon }))}/>
    <NewExpensePanel
      categories={orderedCategories.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        icon: c.icon,
        isVatSettlementDefault: c.id === current.workspace.vatSettlementCategoryId
      }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name, icon: b.icon, isFallback: b.isFallback, isPrimary: b.id === current.company.primaryBankId }))}
      paymentMethods={expensePaymentMethods.map(method => ({
        id: method.id,
        name: method.name,
        icon: method.icon,
        kind: method.kind,
        isFallback: method.isFallback,
        systemRole: method.systemRole
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
        internalNotes: s.internalNotes,
        defaultExpenseCategoryId: s.defaultExpenseCategoryId,
        defaultVatRate: s.defaultVatRate?.toString() ?? null,
        systemRole: s.systemRole
      }))}
      initialExpense={{ supplierId: supplier.id, merchant: supplier.businessName }}
      initialOpen={(Array.isArray(query.new) ? query.new[0] : query.new) === '1'}
      showToolbar={false}
    />
    <div className="record-detail-shell">
      <article className="record-detail-document party-detail-document">
        <div className="record-detail-action-row">
          <div className="left-side">
            <DetailBackButton href={returnTo}/>
          </div>
          {!supplier.systemRole ? <div className="right-side">
            <button className="btn btn-sm btn-default" type="button" data-supplier-edit-id={supplier.id}>
              <span className="btn-icon">✎</span> Modifica
            </button>
            <DeleteActionButton
              action={`/api/suppliers/${supplier.id}`}
              confirmMessage="Confermi la rimozione del fornitore? L’operazione non può essere annullata."
              className="btn btn-sm btn-danger"
            >
              🗑 Elimina
            </DeleteActionButton>
          </div> : <span className="badge">Fornitore di sistema</span>}
        </div>

        <section className="record-detail-hero">
          <div>
            <div className="record-detail-title-block">
              <p className="record-detail-kicker">Fornitore #{supplier.id}</p>
              <h1>{supplier.businessName}</h1>
              <div className="record-detail-meta-line">
                <span>{valueOrDash(supplier.alias)}</span>
                <span className="badge">{supplier.expenses.length} spese collegate</span>
                {/*<span>{valueOrDash(supplier.email)}</span>*/}
              </div>
            </div>
          </div>

          <aside className="record-detail-amount-panel">
            <div className="record-detail-amount-panel-header-row">
              <span className="record-detail-amount-panel-header">Da saldare</span>
            </div>
            <strong className={amountToPay > 0 ? 'text-warning' : 'text-ok'}>{euro(amountToPay)}</strong>
            <div className="record-detail-badge-row">
              {/*<span className={badgeClass(amountToPay > 0 ? paymentStatusStyles.DA_PAGARE.className : yesNoStyles.yes.className)}>*/}
              {/*  {amountToPay > 0 ? `${paymentStatusStyles.DA_PAGARE.icon} Da saldare` : `${yesNoStyles.yes.icon} In pari`}*/}
              {/*</span>*/}
              {/*<span className="badge">{supplier.expenses.length} spese collegate</span>*/}
              <span className={badgeClass(amountToPay > 0 ? paymentStatusStyles.DA_PAGARE.className : yesNoStyles.yes.className)}>
                {openExpenses.length} ordini aperti
              </span>
              <span className="badge supplier-default-category-badge">
                {supplier.defaultExpenseCategory
                  ? `${supplier.defaultExpenseCategory.icon ? `${supplier.defaultExpenseCategory.icon} ` : ''}${supplier.defaultExpenseCategory.name}`
                  : 'Non impostata'}
              </span>
            </div>
          </aside>
        </section>

        <section className="record-detail-status-strip">
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
          {uninvoicedExpenses.length > 0 ? <>
            <div>
              <span>Ordini senza fattura</span>
              <strong className="text-warning">{uninvoicedExpenses.length}</strong>
            </div>
            <div>
              <span>Importo non ancora fatturato</span>
              <strong className="text-warning">{euro(uninvoicedAmount)}</strong>
            </div>
          </> : null}
        </section>

        <details className="record-detail-section party-detail-collapsible">
          <summary className="record-detail-section-heading">
            <div>
              <h2>Anagrafica</h2>
              <p>Dati principali del fornitore.</p>
            </div>
            <span className="party-detail-collapsible-toggle" aria-hidden="true">⌄</span>
          </summary>
          <div className="record-detail-status-strip party-detail-info-strip">
            <CopyableField label="Ragione sociale" value={supplier.businessName} />
            <CopyableField label="Referente" value={supplier.alias} />
            <CopyableField label="Email" value={supplier.email} />
            <CopyableField label="P.IVA / C.F." value={supplier.vatNumber} />
            <CopyableField label="Cod. SDI" value={supplier.taxCodeSdi} />
            <CopyableField label="PEC" value={supplier.pec} />
            <CopyableField label="IBAN" value={supplier.iban} />
            <CopyableField label="Swift" value={supplier.swift} />
            <CopyableField
              label="Categoria predefinita"
              value={supplier.defaultExpenseCategory
                ? `${supplier.defaultExpenseCategory.icon ? `${supplier.defaultExpenseCategory.icon} ` : ''}${supplier.defaultExpenseCategory.name}`
                : null}
            />
            <CopyableField
              label="Aliquota IVA predefinita"
              value={supplier.defaultVatRate == null ? null : `${supplier.defaultVatRate.toString()}%`}
            />
            <CopyableField label="Note interne" value={supplier.internalNotes} className="span-2"/>
          </div>
        </details>
      </article>
    </div>

    <div className="card record-list-card">
      <div className="list-heading">
        <div>
          <h2>Spese collegate</h2>
          <p className="muted">Risultati mostrati: {supplier.expenses.length}</p>
        </div>
      </div>

      <ExpensesList
        timeZone={current.company.timeZone}
        expenses={supplier.expenses}
        returnTo={encodedSupplierDetailHref}
        showSupplierColumn={false}
        selectable
        formId="expenseBulkForm"
        categories={orderedCategories.map(c => ({id: c.id, code: c.code, name: c.name, icon: c.icon, isVatSettlementDefault: c.id === current.workspace.vatSettlementCategoryId }))}
        banks={orderedBanks.map(b => ({ id: b.id, name: b.name, icon: b.icon, isFallback: b.isFallback, isPrimary: b.id === current.company.primaryBankId }))}
        paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, icon: method.icon, kind: method.kind, isFallback: method.isFallback, systemRole: method.systemRole }))}
        suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, vatNumber: s.vatNumber, iban: s.iban, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes, defaultExpenseCategoryId: s.defaultExpenseCategoryId, defaultVatRate: s.defaultVatRate?.toString() ?? null, systemRole: s.systemRole }))}
        mobileLabel="Spese collegate mobile"
        emptyMessage="Nessuna spesa collegata a questo fornitore."
      />
    </div>
  </div>;
}
