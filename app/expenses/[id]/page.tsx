import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ExpenseDetailEditModalController from '@/components/ExpenseDetailEditModalController';
import DetailBackButton from '@/components/DetailBackButton';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import DeleteActionButton from '@/components/DeleteActionButton';
import { euro } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderExpenseCategories, orderPaymentMethods } from '@/lib/workspace-defaults';
import { detailBackHref } from '@/lib/detail-navigation';
import { calendarDayNumber } from '@/lib/company-time';
import {
  badgeClass,
  categoryLabel,
  categoryTone,
  formatPeriod,
  invoiceStatusStyles,
  paymentStatusStyles,
  vatKey,
  vatStyles,
  vatStylesNoText,
  yesNoStyles
} from '@/lib/expense-ui';

function dateLabel(value?: Date | null) {
  if (!value) return '-';
  const formatted = new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(value);
  return formatted.replace(
    /\b([a-zàèéìòù])/,
    (match) => match.toUpperCase()
  );
}

function booleanBadge(value: boolean) {
  const item = value ? yesNoStyles.yes : yesNoStyles.no;
  return <span className={badgeClass(item.className)}>{item.icon} {item.label}</span>;
}

function fiscalLabel(value: boolean) {
  const item = value ? yesNoStyles.yes : yesNoStyles.no;
  return <div className="">{item.icon} {item.label}</div>;
}

function fiscalBadge(value: boolean) {
  const item = value ? yesNoStyles.yes : yesNoStyles.no;
  const label = value ? '✓ Fiscale' : '× Non dich.';
  return <span className={badgeClass(item.className)}>{label}</span>;
}

export default async function ExpenseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/expenses');
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = detailBackHref(rawReturnTo, `/expenses/${id}`, '/expenses');
  const encodedReturnTo = encodeURIComponent(returnTo);
  const currentDetailReturnTo = `/expenses/${id}?returnTo=${encodedReturnTo}`;
  const encodedCurrentDetailReturnTo = encodeURIComponent(currentDetailReturnTo);
  const [expense, categories, banks, paymentMethods, suppliers, employees] = await Promise.all([
    prisma.expense.findFirst({
      where: { id: Number(id), workspaceId: current.workspace.id, companyId: current.company.id },
      include: { category: true, supplier: true, employee: true, payments: { include: { bank: true, paymentMethod: true }, orderBy: { id: 'asc' } }, attachments: true }
    }),
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 }),
    prisma.employee.findMany({where: {workspaceId: current.workspace.id, companyId: current.company.id}, orderBy: [{lastName: 'asc'}, {firstName: 'asc'}]})
  ]);

  if (!expense) notFound();

  const supplierName = expense.supplier?.businessName ?? expense.merchant;
  const orderedBanks = orderBanks(banks);
  const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');

  const orderedCategories = orderExpenseCategories(categories);

  const amount = Number(expense.amount.toString());
  const isVatSettlement = expense.expenseType === 'VAT_SETTLEMENT';
  const isTaxContribution = expense.expenseType === 'TAX_CONTRIBUTION';
  const isPayroll = expense.expenseType === 'PAYROLL';
  const isNoVatExpense = isVatSettlement || isTaxContribution || isPayroll;
  const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
  const residual = Math.max(0, amount - paid);
  const categoryClassName = categoryTone(expense.category);
  const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
  const invoiceStyle = invoiceStatusStyles[expense.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
  const vatStyle = vatStylesNoText[vatKey(expense.vatRate)] ?? vatStyles['22'];
  const vatRate = Number(expense.vatRate.toString());
  const paidVat = isVatSettlement ? Math.min(amount, paid) : (vatRate ? Math.min(amount, paid) * (vatRate / (100 + vatRate)) : 0);
  const dueDate = expense.dueDate ? new Date(expense.dueDate) : null;
  const dueDay = dueDate ? calendarDayNumber(dueDate, current.company.timeZone, true) : null;
  const todayDay = calendarDayNumber(new Date(), current.company.timeZone);
  const isOverdue = residual > 0 && dueDay !== null && todayDay !== null && dueDay < todayDay;
  const paymentHeroLabel = isOverdue
    ? `${paymentStatusStyles.SCADUTO.icon} ${paymentStatusStyles.SCADUTO.label}`
    : `${paymentStyle.icon} ${paymentStyle.label}`;
  const paidPercent = amount > 0 ? Math.min((paid / amount) * 100, 100) : 0;
  const flashMessages = {
    savedMessages: {
      created: 'Spesa creata.',
      updated: 'Spesa aggiornata.',
      deleted: 'Spesa rimossa.'
    },
    errorMessages: {
      invalid: 'Controlla i campi della spesa.',
      invalid_attachment: 'Allegato non valido. Usa PDF, JPG, PNG, WebP, XML o P7M fino a 10 MB.',
      supplier_not_found: 'Fornitore non trovato. Aggiungilo prima con il pulsante Nuovo nel campo Esercente, poi salva la spesa.',
      not_found: 'Spesa non trovata.',
      in_use: 'La spesa è collegata ad altri movimenti.'
    }
  };

  return <div className="grid record-detail-page expense-detail-page">
    <ExpenseDetailEditModalController
      categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name, icon: c.icon, isVatSettlementDefault: c.id === current.workspace.vatSettlementCategoryId }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name, icon: b.icon, isFallback: b.isFallback, isPrimary: b.id === current.company.primaryBankId }))}
      paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, icon: method.icon, kind: method.kind, isFallback: method.isFallback, systemRole: method.systemRole }))}
      suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, vatNumber: s.vatNumber, iban: s.iban, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes, defaultExpenseCategoryId: s.defaultExpenseCategoryId, defaultVatRate: s.defaultVatRate?.toString() ?? null, systemRole: s.systemRole }))}
      employees={employees.map(employee => ({id: employee.id, firstName: employee.firstName, lastName: employee.lastName, employeeCode: employee.employeeCode, status: employee.status}))}
      returnTo={currentDetailReturnTo}
    />
    <ActionFeedbackBanner
      searchParams={query}
      savedMessages={flashMessages.savedMessages}
      errorMessages={flashMessages.errorMessages}
      defaultSavedMessage="Operazione completata."
      defaultErrorMessage="Impossibile completare l’operazione."
    />

    <div className="record-detail-shell">
      <article className="record-detail-document">
        <div className="record-detail-action-row">
          <div className="left-side">
            <DetailBackButton href={returnTo} />
          </div>
          <div className="right-side">
            <button className="btn btn-sm btn-default" type="button" data-expense-detail-copy-id={expense.id} data-expense-copy-id={expense.id}>⧉
              <span className="--hidden-mobile"> Copia</span>
            </button>
            <Link className="btn btn-sm btn-default" href="#" data-expense-detail-edit-id={expense.id}>✎
              <span className="--hidden-mobile"> Modifica</span>
            </Link>
          </div>
        </div>
        <section className="record-detail-hero">
          <div>
            <div className="record-detail-title-block">
              <p className="record-detail-kicker">
                <span>Spesa #{expense.id}</span>
                <span className={isVatSettlement ? 'badge vat-settlement-expense-badge' : isTaxContribution || isPayroll ? 'badge tone-neutral' : expense.isRecurring ? 'badge recurring-expense-badge' : 'badge single-expense-badge'}>{isVatSettlement ? 'Saldo IVA' : isTaxContribution ? 'Imposte - non IVA' : isPayroll ? 'Busta paga' : expense.isRecurring ? 'R' : 'S'}</span>
              </p>
              <div className="expense-detail-title">
                  <strong>{expense.description}</strong>
              </div>
              <div className="record-detail-meta-line">
                  <strong className="text-accent">{isPayroll && expense.employeeId ? <Link href={`/employees/${expense.employeeId}?returnTo=${encodedCurrentDetailReturnTo}`}>{supplierName}</Link> : expense.supplierId ? <Link href={`/suppliers/${expense.supplierId}?returnTo=${encodedCurrentDetailReturnTo}`}>{supplierName}</Link> : supplierName}</strong>
                  <span>{expense.category ? categoryLabel(expense.category, expense.category.name) : 'Senza categoria'}</span>
                  {/*<strong>{fiscalBadge(expense.isDeclared)}</strong>*/}
              </div>
            </div>
          </div>

          <aside className="record-detail-amount-panel">
            <div className="record-detail-amount-panel-header-row">
              <span className="record-detail-amount-panel-header">{isVatSettlement ? 'Importo interamente IVA' : isTaxContribution ? 'Importo versamento' : isPayroll ? 'Netto da corrispondere' : 'IVA inclusa'} </span>
              {!isNoVatExpense ? <span className={badgeClass(vatStyle.className)}>{vatStyle.label}</span> : null}
            </div>
            <strong>{euro(expense.amount.toString())}</strong>
            <div className="record-detail-badge-row">
              <span className={badgeClass(isOverdue ? paymentStatusStyles.SCADUTO.className : paymentStyle.className)}>
                {paymentHeroLabel}
              </span>
              {!isNoVatExpense ? <span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} Fatt. {invoiceStyle.label}</span> : null}
            </div>
          </aside>
        </section>

        <section className="record-detail-status-strip">
          <div>
            <span>Pagato</span>
            <strong>{euro(paid)}</strong>
          </div>
          <div>
            <span>Residuo</span>
            <strong className={residual > 0 ? 'text-warning' : 'text-ok'}>{euro(residual)}</strong>
          </div>
          <div className="record-detail-payment span-2">
            {/*<div className="record-detail-payment-icon">{paymentStyle.icon}</div>*/}
            <span>Stato pagamento</span>
            {/*<strong className={badgeClass(isOverdue ? paymentStatusStyles.SCADUTO.className : paymentStyle.className)}>{/*{paymentHeroLabel}}</strong>*/}
            <strong>{paymentStyle.icon} {paymentStyle.label}</strong>
          </div>
        </section>
          <div className="record-detail-progress" aria-label={`Pagamento completato al ${paidPercent.toFixed(0)}%`}>
            <span style={{ width: `${paidPercent}%` }} />
          </div>
        <section className="record-detail-status-strip">
          <div>
            <span>{isVatSettlement ? 'Data ricezione' : 'Data ordine'}</span>
            <strong>{dateLabel(expense.receivedDate)}</strong>
          </div>
          <div>
            <span>Scadenza</span>
            <strong>{dateLabel(expense.dueDate)}</strong>
          </div>
          {!isNoVatExpense ? <div>
            <span>Stato fattura</span>
            <strong>{invoiceStyle.icon} {invoiceStyle.label}</strong>
          </div> : null}
          <div>
            <span>Periodo contabile</span>
            <strong>{formatPeriod(expense.month, expense.year)}</strong>
          </div>
          {!isNoVatExpense ? <div>
            <span>Fiscale</span>
            <strong>{fiscalLabel(expense.isDeclared)}</strong>
          </div> : null}
          {isTaxContribution || isPayroll ? <div>
            <span>Utile fiscale</span>
            <strong>{isPayroll || expense.affectsFiscalProfit ? 'Incide' : 'Non incide'}</strong>
          </div> : null}
          <div>
            <span>IVA</span>
            <strong>{isVatSettlement ? euro(paidVat) : isTaxContribution || isPayroll ? 'Non applicabile' : vatStyle.label}</strong>
          </div>
          <div>
            <span>{isPayroll ? 'Dipendente' : 'Fornitore'}</span>
            <strong className="">{isPayroll && expense.employeeId ? <Link href={`/employees/${expense.employeeId}?returnTo=${encodedCurrentDetailReturnTo}`}>{supplierName}</Link> : expense.supplierId ? <Link href={`/suppliers/${expense.supplierId}?returnTo=${encodedCurrentDetailReturnTo}`}>{supplierName}</Link> : supplierName}</strong>
          </div>
          {isPayroll ? <>
            <div><span>Netto cedolino</span><strong>{euro(expense.payrollNetAmount?.toString() ?? '0')}</strong></div>
            <div><span>Compensi extra</span><strong>{euro(expense.payrollExtraCompensation?.toString() ?? '0')}</strong></div>
            <div><span>Lordo cedolino · informativo</span><strong>{expense.payrollGrossAmount != null ? euro(expense.payrollGrossAmount.toString()) : 'Non indicato'}</strong></div>
            <div><span>Costo aziendale · informativo</span><strong>{expense.payrollEmployerCost != null ? euro(expense.payrollEmployerCost.toString()) : 'Non indicato'}</strong></div>
          </> : null}
          <div>
            <span>Descrizione</span>
            <strong className="">{expense.description ?? 'Spesa senza descrizione'}</strong>
          </div>

          {/*<div>*/}
          {/*  <span>IVA versata</span>*/}
          {/*  <strong>{euro(paidVat)}</strong>*/}
          {/*</div>*/}
        </section>

        <section className="record-detail-section">
          <div className="record-detail-section-heading">
            <div>
              <h2>Pagamenti</h2>
              <p>{expense.payments.length ? 'Movimenti registrati per questa spesa.' : 'Nessun movimento registrato.'}</p>
            </div>
            <div className="record-detail-section-heading-actions">
              <span className="badge hidden-mobile">{expense.payments.length} record</span>
              <button className="btn btn-sm btn-primary" type="button" data-expense-detail-payment-id={expense.id}>
                ＋ Aggiungi pagamento
              </button>
            </div>
          </div>
          {expense.payments.length ? <div className="app-record-form record-detail-payment-summary-list">
            {expense.payments.map(payment => <article className="payment-row payment-summary-row" key={payment.id}>
              <div className="payment-summary-primary">
                <span className="payment-summary-kicker">Pagamento effettuato</span>
                <strong className="payment-summary-amount">{euro(payment.amount.toString())}</strong>
              </div>
              <div className="payment-summary-date">
                <span>Data pagamento</span>
                <strong>{dateLabel(payment.paymentDate)}</strong>
              </div>
              <div className="payment-summary-meta">
                <div>
                  <span>Metodo</span>
                  <strong>{payment.paymentMethod.icon ?? '•'} {payment.paymentMethod.name}</strong>
                </div>
                <div>
                  <span>Banca</span>
                  <strong>{payment.bank ? `${payment.bank.icon ?? '•'} ${payment.bank.name}` : 'Non impostata'}</strong>
                </div>
              </div>
              <div className="payment-row-actions">
                <button className="btn btn-sm btn-default" type="button"
                        data-expense-id={expense.id}
                        data-expense-detail-payment-edit-id={payment.id}>
                  ✎ Modifica
                </button>
              </div>
            </article>)}
          </div> : <div className="record-empty-state">Nessun pagamento registrato.</div>}

        </section>

        <section className="record-detail-section">
          <div className="record-detail-section-heading">
            <div className="flex-grow">
              <h2>Altre Informazioni</h2>
              <p>Altri dati della spesa.</p>
            </div>
          </div>
          <div className="">
            <div className="record-detail-item record-detail-item-wide">
              <span>Note</span>
              <strong className="displayed-notes">{expense.notes ?? '-'}</strong>
            </div>
          </div>
        </section>

        <section className="record-detail-section">
          <div className="record-detail-section-heading">
            <div>
              <h2>Allegati</h2>
              <p>{expense.attachments.length ? 'Documenti associati alla spesa.' : 'Nessun documento caricato.'}</p>
            </div>
            <div className="record-detail-section-heading-actions">
              <span className="badge">{expense.attachments.length}</span>
              <button className="btn btn-sm btn-default" type="button"
                      data-expense-detail-attachments-id={expense.id}>
                ✎ Modifica allegati
              </button>
            </div>
          </div>
          {expense.attachments.length ? <div className="record-attachment-panel">
            {expense.attachments.map(attachment => <a className="record-attachment-item" key={attachment.id} href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer">
              <span>📎</span>
              <strong>{attachment.originalName}</strong>
              <span className={`record-attachment-type record-attachment-type-${attachment.type.toLowerCase().replace('_', '-')}`}>{attachment.type === 'INVOICE' ? 'Fattura' : attachment.type === 'PAYMENT_RECEIPT' ? 'Ricevuta pagamento' : 'Documento'}</span>
              <small>{attachment.sizeBytes ? `${Math.round(attachment.sizeBytes / 1024)} KB` : ''}</small>
            </a>)}
          </div> : <div className="record-empty-state">Nessun allegato caricato.</div>}
        </section>


        <section className="record-detail-section record-detail-section-actions">
          <details className="record-detail-actions-collapse">
            <summary><span>Azioni sulla spesa</span><small>Rimuovi, copia o modifica</small></summary>
            <div className="record-detail-actions-collapse-panel">
              <DeleteActionButton
                  action={`/api/expenses/${expense.id}?returnTo=${encodedReturnTo}`}
                  confirmMessage="Confermi la rimozione della spesa? L’operazione non può essere annullata."
                  className="btn btn-sm btn-danger">
                🗑 Rimuovi
              </DeleteActionButton>
              <button className="btn btn-sm btn-default" type="button" data-expense-detail-copy-id={expense.id} data-expense-copy-id={expense.id}>⧉ Copia</button>
              <Link className="btn btn-sm btn-default" href="#" data-expense-detail-edit-id={expense.id}>✎ Modifica</Link>
            </div>
          </details>
        </section>

      </article>
    </div>
  </div>;
}
