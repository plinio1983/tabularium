import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ExpenseDetailEditModalController from '@/components/ExpenseDetailEditModalController';
import { euro } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';
import { orderExpenseCategories } from '@/lib/workspace-defaults';
import {
  badgeClass,
  bankIcons,
  categoryLabel,
  categoryTone,
  formatPeriod,
  invoiceStatusStyles,
  paymentStatusStyles,
  vatKey,
  vatStyles,
  yesNoStyles
} from '@/lib/expense-ui';

const allowedBankOrder = ['MyTu', 'Unicredit', 'Wise', 'Altra Banca'];

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

  const orderedCategories = orderExpenseCategories(categories);

  const amount = Number(expense.amount.toString());
  const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
  const residual = Math.max(0, amount - paid);
  const categoryClassName = categoryTone(expense.category);
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
  const paymentHeroLabel = isOverdue
    ? `${paymentStatusStyles.SCADUTO.icon} ${paymentStatusStyles.SCADUTO.label}`
    : `${paymentStyle.icon} ${paymentStyle.label}`;
  const paidPercent = amount > 0 ? Math.min((paid / amount) * 100, 100) : 0;

  return <div className="grid expense-detail-page">
    <ExpenseDetailEditModalController
      categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name, icon: c.icon }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name }))}
      suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, phone: s.phone, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes }))}
      returnTo={currentDetailReturnTo}
    />

    <div className="expense-detail-shell">
      <article className="expense-detail-document">
        <section className="expense-detail-hero">
          <div>
            <Link className="expense-detail-back" href={returnTo}>Indietro alla lista</Link>
            <div className="expense-detail-title-block">
              <p className="expense-detail-kicker">Spesa #{expense.id}</p>
              <h1>{expense.supplierId ? <Link href={`/suppliers/${expense.supplierId}`}>{expense.merchant}</Link> : expense.merchant}</h1>
              <div className="expense-detail-meta-line">
                <span className={expense.isRecurring ? 'recurring-expense-badge' : 'single-expense-badge'}>{expense.isRecurring ? 'Ricorrente' : 'Singola'}</span>
                <span>{expense.category ? categoryLabel(expense.category, expense.category.name) : 'Senza categoria'}</span>
                <span>Periodo {formatPeriod(expense.month, expense.year)}</span>
                <span>Ordine {dateLabel(expense.receivedDate)}</span>
              </div>
            </div>
          </div>

          <aside className="expense-detail-amount-panel">
            <span>Importo IVA inclusa</span>
            <strong>{euro(expense.amount.toString())}</strong>
            <div className="expense-detail-badge-row">
              <span className={badgeClass(vatStyle.className)}>{vatStyle.label}</span>
              <span className={badgeClass(isOverdue ? paymentStatusStyles.SCADUTO.className : paymentStyle.className)}>
                {paymentHeroLabel}
              </span>
              <span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span>
            </div>
          </aside>
        </section>

        <div className="expense-detail-action-row">
          <button className="table-action secondary" type="button" data-expense-detail-copy-id={expense.id} data-expense-copy-id={expense.id}>⧉ Copia</button>
          <Link className="table-action" href="#" data-expense-detail-edit-id={expense.id}>✎ Modifica</Link>
        </div>

        <section className="expense-detail-status-strip">
          <div>
            <span>Pagato</span>
            <strong>{euro(paid)}</strong>
          </div>
          <div>
            <span>Residuo</span>
            <strong className={residual > 0 ? 'text-warning' : 'text-ok'}>{euro(residual)}</strong>
          </div>
          <div>
            <span>Scadenza</span>
            <strong>{dateLabel(expense.dueDate)}</strong>
          </div>
          <div>
            <span>IVA versata</span>
            <strong>{euro(paidVat)}</strong>
          </div>
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
          <div className="expense-detail-info-grid">
            <div className="expense-detail-item expense-detail-item-wide">
              <span>Fornitore</span>
              <strong className="expense-detail-supplier-name">{expense.supplierId ? <Link href={`/suppliers/${expense.supplierId}`}>{expense.merchant}</Link> : expense.merchant}</strong>
            </div>
            <div className="expense-detail-item expense-detail-item-wide">
              <span>Descrizione</span>
              <strong>{expense.description ?? 'Spesa senza descrizione'}</strong>
            </div>
            <div className="expense-detail-item">
              <span>Detrazione</span>
              <strong>{booleanBadge(expense.isDeclared)}</strong>
            </div>
            <div className="expense-detail-item">
              <span>Fattura elettronica</span>
              <strong>{booleanBadge(expense.hasElectronicInvoice)}</strong>
            </div>
            <div className="expense-detail-item">
              <span>Stato fattura</span>
              <strong><span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span></strong>
            </div>
            <div className="expense-detail-item">
              <span>Stato pagamento</span>
              <strong><span className={badgeClass(isOverdue ? paymentStatusStyles.SCADUTO.className : paymentStyle.className)}>{paymentHeroLabel}</span></strong>
            </div>
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
