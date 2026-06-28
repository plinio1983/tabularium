import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ExpenseDetailEditModalController from '@/components/ExpenseDetailEditModalController';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import { euro } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderExpenseCategories, orderPaymentMethods } from '@/lib/workspace-defaults';
import {
  badgeClass,
  bankIcons,
  categoryLabel,
  categoryTone,
  formatPeriod,
  invoiceStatusStyles,
  paymentStatusStyles,
  vatKey,
  vatStyles, vatStylesNoText,
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

function paidByLabel(value: string) {
  return value === 'ALTRO_OPERATORE' ? 'Altro Operatore' : 'Herbal Market';
}

function booleanBadge(value: boolean) {
  const item = value ? yesNoStyles.yes : yesNoStyles.no;
  return <span className={badgeClass(item.className)}>{item.icon} {item.label}</span>;
}

function fiscalBadge(value: boolean) {
  const item = value ? yesNoStyles.yes : yesNoStyles.no;
  return <div className="">{item.icon} {item.label}</div>;
}

export default async function ExpenseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/expenses');
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/expenses';
  const encodedReturnTo = encodeURIComponent(returnTo);
  const currentDetailReturnTo = `/expenses/${id}?returnTo=${encodedReturnTo}`;
  const encodedCurrentDetailReturnTo = encodeURIComponent(currentDetailReturnTo);
  const [expense, categories, banks, paymentMethods, suppliers] = await Promise.all([
    prisma.expense.findUnique({
      where: { id: Number(id) },
      include: { category: true, bank: true, supplier: true, payments: { include: { bank: true }, orderBy: { id: 'asc' } }, attachments: true }
    }),
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  if (!expense || expense.workspaceId !== current.workspace.id) notFound();

  const orderedBanks = orderBanks(banks);
  const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');

  const orderedCategories = orderExpenseCategories(categories);

  const amount = Number(expense.amount.toString());
  const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
  const residual = Math.max(0, amount - paid);
  const categoryClassName = categoryTone(expense.category);
  const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
  const invoiceStyle = invoiceStatusStyles[expense.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
  const vatStyle = vatStylesNoText[vatKey(expense.vatRate)] ?? vatStyles['22'];
  const vatRate = Number(expense.vatRate.toString());
  const paidVat = vatRate ? Math.min(amount, paid) * (vatRate / (100 + vatRate)) : 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = expense.dueDate ? new Date(expense.dueDate) : null;
  dueDate?.setHours(0, 0, 0, 0);
  const isOverdue = residual > 0 && dueDate !== null && dueDate < today;
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
      not_found: 'Spesa non trovata.',
      in_use: 'La spesa è collegata ad altri movimenti.'
    }
  };

  return <div className="grid expense-detail-page">
    <ExpenseDetailEditModalController
      categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name, icon: c.icon }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name, isFallback: b.isFallback }))}
      paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback }))}
      suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, phone: s.phone, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes }))}
      returnTo={currentDetailReturnTo}
    />
    <ActionFeedbackBanner
      searchParams={query}
      savedMessages={flashMessages.savedMessages}
      errorMessages={flashMessages.errorMessages}
      defaultSavedMessage="Operazione completata."
      defaultErrorMessage="Impossibile completare l’operazione."
    />

    <div className="expense-detail-shell">
      <article className="expense-detail-document">
        <div className="expense-detail-action-row">
          <div className="left-side">
            <Link className="expense-detail-back" href={returnTo}>Indietro</Link>
          </div>
          <div className="right-side">
            <button className="table-action secondary" type="button" data-expense-detail-copy-id={expense.id} data-expense-copy-id={expense.id}>⧉ Copia</button>
            <Link className="table-action" href="#" data-expense-detail-edit-id={expense.id}>✎ Modifica</Link>
          </div>
        </div>
        <section className="expense-detail-hero">
          <div>
            <div className="expense-detail-title-block">
              <p className="expense-detail-kicker">
                <span>Spesa #{expense.id}</span>
                <span className={expense.isRecurring ? 'badge recurring-expense-badge' : 'badge single-expense-badge'}>{expense.isRecurring ? 'R' : 'S'}</span>
              </p>
              <div className="flex align-center">
                <h1>{expense.supplierId ? <Link href={`/suppliers/${expense.supplierId}`}>{expense.merchant}</Link> : expense.merchant}</h1>
              </div>
              <div className="expense-detail-meta-line">
                <span>{expense.category ? categoryLabel(expense.category, expense.category.name) : 'Senza categoria'}</span>
                {/*<span>Periodo {formatPeriod(expense.month, expense.year)}</span>*/}
                {/*<span>Ordine {dateLabel(expense.receivedDate)}</span>*/}
              </div>
            </div>
          </div>

          <aside className="expense-detail-amount-panel">
            <span className="expense-detail-amount-panel-header">IVA inclusa</span>
            <strong>{euro(expense.amount.toString())}</strong>
            <div className="expense-detail-badge-row">
              <span className={badgeClass(vatStyle.className)}>{vatStyle.label}</span>
              <span className={badgeClass(isOverdue ? paymentStatusStyles.SCADUTO.className : paymentStyle.className)}>
                {paymentHeroLabel}
              </span>
              {/*<span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span>*/}
            </div>
          </aside>
        </section>

        {/*<div className="expense-detail-action-row">*/}
        {/*  <button className="table-action secondary" type="button" data-expense-detail-copy-id={expense.id} data-expense-copy-id={expense.id}>⧉ Copia</button>*/}
        {/*  <Link className="table-action" href="#" data-expense-detail-edit-id={expense.id}>✎ Modifica</Link>*/}
        {/*</div>*/}

        <section className="expense-detail-status-strip">
          <div>
            <span>Pagato</span>
            <strong>{euro(paid)}</strong>
          </div>
          <div>
            <span>Residuo</span>
            <strong className={residual > 0 ? 'text-warning' : 'text-ok'}>{euro(residual)}</strong>
          </div>
          <div className="expense-detail-payment span-2">
            {/*<div className="expense-detail-payment-icon">{paymentStyle.icon}</div>*/}
            <span>Stato pagamento</span>
            {/*<strong className={badgeClass(isOverdue ? paymentStatusStyles.SCADUTO.className : paymentStyle.className)}>*/}
            <strong>
              {paymentStyle.label}
              {/*{paymentHeroLabel}*/}
            </strong>
          </div>
          <div>
            <span>Data ordine</span>
            <strong>{dateLabel(expense.receivedDate)}</strong>
          </div>
          <div>
            <span>Scadenza</span>
            <strong>{dateLabel(expense.dueDate)}</strong>
          </div>
          <div>
            <span>Stato fattura</span>
            <strong>{invoiceStyle.label}</strong>
          </div>
          <div>
            <span>Periodo contabile</span>
            <strong>{formatPeriod(expense.month, expense.year)}</strong>
          </div>
          <div>
            <span>Detrazione</span>
            <strong>{fiscalBadge(expense.isDeclared)}</strong>
          </div>
          <div>
            <span>Aliquota</span>
            <strong>{vatStyle.label}</strong>
          </div>
          <div>
            <span>Fornitore</span>
            <strong className="">{expense.supplierId ? <Link href={`/suppliers/${expense.supplierId}`}>{expense.merchant}</Link> : expense.merchant}</strong>
          </div>
          <div>
            <span>Descrizione</span>
            <strong>{expense.description ?? 'Spesa senza descrizione'}</strong>
          </div>

          {/*<div>*/}
          {/*  <span>IVA versata</span>*/}
          {/*  <strong>{euro(paidVat)}</strong>*/}
          {/*</div>*/}
        </section>
        <div className="expense-detail-progress" aria-label={`Pagamento completato al ${paidPercent.toFixed(0)}%`}>
          <span style={{ width: `${paidPercent}%` }} />
        </div>

        <section className="expense-detail-section">
          <div className="expense-detail-section-heading">
            <div>
              <h2>Informazioni</h2>
              <p>Dati fiscali, contabili e descrittivi della spesa.</p>
            </div>
          </div>
          <div className="">
            <div className="expense-detail-item expense-detail-item-wide">
              <span>Note</span>
              <strong>{expense.notes ?? '-'}</strong>
            </div>
          </div>
        </section>

        <section className="expense-detail-section">
          <div className="expense-detail-section-heading">
            <div>
              <h2>Pagamenti</h2>
              <p>{expense.payments.length ? 'Movimenti registrati per questa spesa.' : 'Nessun movimento registrato.'}</p>
            </div>
            <span className="badge">{expense.payments.length} record</span>
          </div>
          {expense.payments.length ? <div className="expense-payment-timeline">
            {expense.payments.map(payment => <article className="expense-payment-card" key={payment.id}>
              <div className="expense-payment-date">
                <span>Data pagamento</span>
                <strong>{dateLabel(payment.paymentDate)}</strong>
              </div>
              <div className="expense-payment-data">
                <div><span>Importo</span><strong>{euro(payment.amount.toString())}</strong></div>
                <div><span>Canale</span><strong>{payment.channel ?? '-'}</strong></div>
                <div><span>Banca</span><strong>{payment.bank ? `${bankIcons[payment.bank.name] ?? '🏦'} ${payment.bank.name}` : '-'}</strong></div>
                <div><span>Effettuato da</span><strong>{paidByLabel(payment.paidBy)}</strong></div>
              </div>
            </article>)}
          </div> : <div className="expense-empty-panel">Nessun pagamento registrato.</div>}
        </section>

        <section className="expense-detail-section">
          <div className="expense-detail-section-heading">
            <div>
              <h2>Allegati</h2>
              <p>{expense.attachments.length ? 'Documenti associati alla spesa.' : 'Nessun documento caricato.'}</p>
            </div>
            <span className="badge">{expense.attachments.length}</span>
          </div>
          {expense.attachments.length ? <div className="expense-attachment-panel">
            {expense.attachments.map(attachment => <a className="expense-attachment-item" key={attachment.id} href={attachment.path} target="_blank" rel="noreferrer">
              <span>📎</span>
              <strong>{attachment.originalName}</strong>
              <small>{attachment.sizeBytes ? `${Math.round(attachment.sizeBytes / 1024)} KB` : ''}</small>
            </a>)}
          </div> : <div className="expense-empty-panel">Nessun allegato caricato.</div>}
        </section>
      </article>
    </div>
  </div>;
}
