import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ExpenseDetailEditModalController from '@/components/ExpenseDetailEditModalController';
import { euro } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';
import {
  badgeClass,
  bankIcons,
  categoryStyles,
  formatPeriod,
  invoiceStatusStyles,
  paymentStatusStyles,
  vatKey,
  vatStyles,
  yesNoStyles
} from '@/lib/expense-ui';

const allowedBankOrder = ['MyTu', 'Unicredit', 'Wise', 'Altra Banca'];
const allowedCategoryOrder = [
  'Servizi Bancari',
  'Assicurazioni',
  'Affitti/Utenze',
  'Servizi Web',
  'Spedizioni/Corrieri',
  'Tasse/Imposte',
  'Altri Servizi',
  'Merce/Forniture',
  'Articoli di Supporto',
  'Prestazioni/Dipendenti',
  'Rateizzazione'
];

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

export default async function ExpenseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/expenses');
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/expenses';
  const encodedReturnTo = encodeURIComponent(returnTo);
  const currentDetailReturnTo = `/expenses/${id}?returnTo=${encodedReturnTo}`;
  const encodedCurrentDetailReturnTo = encodeURIComponent(currentDetailReturnTo);
  const [expense, categories, banks, suppliers] = await Promise.all([
    prisma.expense.findUnique({
      where: { id: Number(id) },
      include: { category: true, bank: true, supplier: true, payments: { include: { bank: true }, orderBy: { id: 'asc' } }, attachments: true }
    }),
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  if (!expense || expense.workspaceId !== current.workspace.id) notFound();

  const orderedBanks = allowedBankOrder
    .map(name => banks.find(bank => bank.name === name))
    .filter(Boolean) as typeof banks;

  const orderedCategories = allowedCategoryOrder
    .map(name => categories.find(category => category.name === name))
    .filter(Boolean) as typeof categories;

  const amount = Number(expense.amount.toString());
  const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
  const residual = Math.max(0, amount - paid);
  const categoryStyle = expense.category?.name ? categoryStyles[expense.category.name] : undefined;
  const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
  const invoiceStyle = invoiceStatusStyles[expense.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
  const vatStyle = vatStyles[vatKey(expense.vatRate)] ?? vatStyles['22'];
  const vatRate = Number(expense.vatRate.toString());
  const paidVat = vatRate ? Math.min(amount, paid) * (vatRate / (100 + vatRate)) : 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = expense.dueDate ? new Date(expense.dueDate) : null;
  dueDate?.setHours(0, 0, 0, 0);
  const isOverdue = residual > 0 && dueDate !== null && dueDate < today;
  const paymentHeroClass = isOverdue
    ? 'expense-detail-hero-side-overdue'
    : expense.paymentStatus === 'COMPLETATO'
      ? 'expense-detail-hero-side-paid'
      : expense.paymentStatus === 'DA_PAGARE'
        ? 'expense-detail-hero-side-unpaid'
        : 'expense-detail-hero-side-partial';
  const paymentHeroLabel = isOverdue
    ? `${paymentStatusStyles.SCADUTO.icon} ${paymentStatusStyles.SCADUTO.label}`
    : `${paymentStyle.icon} ${paymentStyle.label}`;

  return <div className="grid expense-detail-page">
    <ExpenseDetailEditModalController
      categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name }))}
      suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, phone: s.phone, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes }))}
      returnTo={currentDetailReturnTo}
    />

    <section className="expense-detail-hero card">
      <div className="actions-row expense-detail-actions">
        <Link className="table-action secondary" href={returnTo}>↩ Indietro</Link>
        <button className="table-action secondary" type="button" data-expense-detail-copy-id={expense.id} data-expense-copy-id={expense.id}>⧉ Copia</button>
        <Link className="table-action" href="#" data-expense-detail-edit-id={expense.id}>✎ Modifica</Link>
      </div>
      <div className="expense-detail-hero-main">
        <div className="expense-detail-hero-main-meta">
          <div className={expense.isRecurring ? 'badge color-badge recurring-expense-badge' : 'badge color-badge single-expense-badge'}>{expense.isRecurring ? 'R' : 'S'}</div>
          <div className="expense-detail-eyebrow">Dettaglio spesa #{expense.id}</div>
        </div>
        <h2>{expense.supplierId ? <Link href={`/suppliers/${expense.supplierId}`}>{expense.merchant}</Link> : expense.merchant}</h2>
        <div className="expense-detail-supplier">
          <span>{expense.description ?? 'Spesa senza descrizione'}</span>
        </div>
        <div className="expense-detail-hero-meta">
          {/*<span>{formatPeriod(expense.month, expense.year)}</span>*/}
          <span>{expense.category ? `${categoryStyle?.icon ?? '•'} ${expense.category.name}` : 'Senza categoria'}</span>
          <span className="expense-detail-hero-order-date">Data ordine:<br/>
            <strong>{dateLabel(expense.receivedDate)}</strong>
          </span>
        </div>
      </div>
      <div className="expense-detail-hero-side-wrap">
        <span className="text-pre">{dateLabel(expense.dueDate)}</span>
        <div className={`expense-detail-hero-side ${paymentHeroClass}`}>
          <span className="expense-detail-side-label">Importo</span>
          <strong>{euro(expense.amount.toString())}</strong>
          <div className="detail-money-row">
            {/*<span className={badgeClass(vatStyle.className)}>{vatStyle.label}</span>*/}
            <span className="expense-detail-hero-side-status">{paymentHeroLabel}</span>
            <span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span>
          </div>
        </div>
      </div>
    </section>

    <section className="expense-detail-priority-grid">
      <div className="expense-detail-priority-card supplier-card">
        <span>Fornitore</span>
        <strong>{expense.supplierId ? <Link href={`/suppliers/${expense.supplierId}`}>{expense.merchant}</Link> : expense.merchant}</strong>
        <div className="expense-detail-supplier">
          <span>{expense.description ?? 'Spesa senza descrizione'}</span>
        </div>
        <small>{expense.category ? <span className={badgeClass(categoryStyle?.className)}>{categoryStyle?.icon ?? '•'} {expense.category.name}</span> : 'Senza categoria'}</small>
      </div>
      <div className="expense-detail-priority-card amount-card">
        <span>Importo</span>
        <strong>{euro(expense.amount.toString())}</strong>
        <small>di cui IVA: {euro(paidVat)}
          &nbsp;&nbsp;<span className={badgeClass(vatStyle.className)}>{vatStyle.label}</span>
        </small>
      </div>
      <div className="expense-detail-priority-card status-card">
        <span>Stato Pagamento</span>
        <strong><span className={badgeClass(paymentStyle.className)}>{paymentStyle.icon} {paymentStyle.label}</span></strong>
        <small>Residuo: <b className={residual > 0 ? 'text-warning' : 'text-ok'}>{euro(residual)}</b></small>
      </div>
      <div className="expense-detail-priority-card due-card">
        <span>Scadenza</span>
        <strong>{dateLabel(expense.dueDate)}</strong>
        <small>Data ordine: {dateLabel(expense.receivedDate)}</small>
        <small>Periodo contabile:&nbsp;&nbsp;
          <span className="badge">{formatPeriod(expense.month, expense.year)}</span>
        </small>
      </div>
      <div className="expense-detail-priority-card declared-card">
        <span>Detrazione:&nbsp;&nbsp;
          <strong>{booleanBadge(expense.isDeclared)}</strong>
        </span>
        <span>Fattura Elett:&nbsp;&nbsp;
          {booleanBadge(expense.hasElectronicInvoice)}
        </span>
        <span>Stato Fattura: <span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span></span>
      </div>
    </section>

    <div className="card">
      <h2>Note</h2>
      <div className="detail-grid expense-detail-secondary-grid">
        <strong>{expense.notes ?? '-'}</strong>
      </div>
    </div>

    <section className="card expense-detail-payments-card">
      <div className="expense-detail-section-title">
        <div>
          <h2>Pagamenti</h2>
          <p className="muted">Movimenti registrati per questa spesa.</p>
        </div>
        <span className="badge">{expense.payments.length} record</span>
      </div>

      <div className="table-scroll expense-payments-desktop">
        <table className="expense-payments-table">
          <thead><tr><th>Data pagamento</th><th>Canale</th><th>Banca</th><th>Importo</th><th>Effettuato da</th></tr></thead>
          <tbody>
            {expense.payments.length ? expense.payments.map(payment => <tr key={payment.id}>
              <td>{dateLabel(payment.paymentDate)}</td>
              <td>{payment.channel ?? '-'}</td>
              <td>{payment.bank ? `${bankIcons[payment.bank.name] ?? '🏦'} ${payment.bank.name}` : '-'}</td>
              <td><strong>{euro(payment.amount.toString())}</strong></td>
              <td>{paidByLabel(payment.paidBy)}</td>
            </tr>) : <tr><td colSpan={5}>Nessun pagamento registrato.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="expense-payments-mobile">
        {expense.payments.length ? expense.payments.map(payment => <article className="expense-payment-mobile-card" key={`mobile-payment-${payment.id}`}>
          <div className="expense-payment-mobile-top">
            <strong>{euro(payment.amount.toString())}</strong>
            <span>{dateLabel(payment.paymentDate)}</span>
          </div>
          <div className="expense-payment-mobile-row"><span>Canale</span><b>{payment.channel ?? '-'}</b></div>
          <div className="expense-payment-mobile-row"><span>Banca</span><b>{payment.bank ? `${bankIcons[payment.bank.name] ?? '🏦'} ${payment.bank.name}` : '-'}</b></div>
          <div className="expense-payment-mobile-row"><span>Effettuato da</span><b>{paidByLabel(payment.paidBy)}</b></div>
        </article>) : <p className="muted">Nessun pagamento registrato.</p>}
      </div>
    </section>

    <div className="card">
      <h2>Allegati ({expense.attachments.length})</h2>
      {expense.attachments.length ? <ul className="attachment-list">
        {expense.attachments.map(attachment => <li key={attachment.id}>
          <a href={attachment.path} target="_blank" rel="noreferrer">{attachment.originalName}</a>
          <span>{attachment.sizeBytes ? `${Math.round(attachment.sizeBytes / 1024)} KB` : ''}</span>
        </li>)}
      </ul> : <p className="muted">Nessun allegato caricato.</p>}
    </div>
  </div>;
}
