import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import RecurringExpenseDetailEditModalController from '@/components/RecurringExpenseDetailEditModalController';
import { euro } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';
import {
  badgeClass,
  bankIcons,
  categoryLabel,
  categoryTone,
  formatPeriod,
  vatKey,
  vatStyles,
  yesNoStyles
} from '@/lib/expense-ui';

const cadenceLabels: Record<string, string> = {
  MONTHLY: 'Ogni mese',
  EVERY_2_MONTHS: 'Ogni 2 mesi',
  EVERY_3_MONTHS: 'Ogni 3 mesi',
  EVERY_6_MONTHS: 'Ogni 6 mesi',
  YEARLY: 'Annuale',
  EVERY_2_YEARS: 'Ogni 2 anni'
};

const billingLabels: Record<string, string> = {
  SAME_MONTH: 'Stesso mese',
  NEXT_MONTH: 'Mese successivo',
  CUSTOM_MONTH: 'Mese impostato'
};

const accrualLabels: Record<string, string> = {
  MANUALE: 'Manuale',
  AUTOMATICA: 'Automatica'
};

const months = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function dateLabel(value?: Date | null) {
  if (!value) return '-';
  const formatted = new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(value);
  return formatted.replace(/\b([a-zàèéìòù])/, match => match.toUpperCase());
}

function booleanBadge(value: boolean) {
  const item = value ? yesNoStyles.yes : yesNoStyles.no;
  return <span className={badgeClass(item.className)}>{item.icon} {item.label}</span>;
}

function dueLabel(item: { dueDay?: number | null; dueMonth?: number | null }) {
  if (item.dueMonth) return `${item.dueDay ?? '-'} ${months[item.dueMonth] ?? ''}`;
  if (item.dueDay) return `Giorno ${item.dueDay}`;
  return '-';
}

function billingLabel(item: { billingPeriodMode: string; billingMonth?: number | null }) {
  return `${billingLabels[item.billingPeriodMode] ?? item.billingPeriodMode}${item.billingMonth ? ` · ${months[item.billingMonth]}` : ''}`;
}

export default async function RecurringExpenseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/recurring-expenses');
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/recurring-expenses';
  const currentDetailReturnTo = `/recurring-expenses/${id}?returnTo=${encodeURIComponent(returnTo)}`;

  const [item, categories, banks, suppliers] = await Promise.all([
    prisma.recurringExpense.findUnique({
    where: { id: Number(id) },
    include: {
      supplier: true,
      category: true,
      bank: true,
      generatedExpenses: {
        include: { category: true, payments: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { receivedDate: 'desc' }],
        take: 24
      }
    }
  }),
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  if (!item || item.workspaceId !== current.workspace.id) notFound();

  const categoryClassName = categoryTone(item.category);
  const vatStyle = vatStyles[vatKey(item.vatRate)] ?? vatStyles['22'];
  const generatedTotal = item.generatedExpenses.reduce((sum, expense) => sum + Number(expense.amount.toString()), 0);
  const merchant = item.supplier?.businessName || item.merchant;
  const activeClass = item.isActive ? 'tone-yes' : 'tone-critical';

  return <div className="grid">
    <RecurringExpenseDetailEditModalController
      categories={categories.map(category => ({ id: category.id, code: category.code, name: category.name, icon: category.icon }))}
      banks={banks.map(bank => ({ id: bank.id, name: bank.name }))}
      suppliers={suppliers.map(supplier => ({ id: supplier.id, businessName: supplier.businessName, alias: supplier.alias, email: supplier.email, phone: supplier.phone, pec: supplier.pec, taxCodeSdi: supplier.taxCodeSdi, internalNotes: supplier.internalNotes }))}
      returnTo={currentDetailReturnTo}
    />

    <section className="expense-detail-hero card recurring-detail-hero">
      <div className="actions-row expense-detail-actions">
        <Link className="table-action secondary" href={returnTo}>↩ Indietro</Link>
        <Link className="table-action" href="#" data-recurring-expense-detail-edit-id={item.id}>✎ Modifica</Link>
      </div>
      <div className="expense-detail-hero-main">
        <div className="expense-detail-hero-main-meta">
          <div className={badgeClass(activeClass)}>{item.isActive ? 'ON' : 'OFF'}</div>
          <div className="expense-detail-eyebrow">Spesa ricorrente #{item.id}</div>
        </div>
        <h2>{item.supplierId ? <Link href={`/suppliers/${item.supplierId}`}>{merchant}</Link> : merchant}</h2>
        <div className="expense-detail-supplier">
          <span>{item.description ?? 'Spesa ricorrente senza descrizione'}</span>
        </div>
        <div className="expense-detail-hero-meta">
          <span>{item.category ? categoryLabel(item.category, item.category.name) : 'Senza categoria'}</span>
          <span>Inizio:<br /><strong>{dateLabel(item.startDate)}</strong></span>
          {/*<span>Stato:<br /><strong>{item.isActive ? 'Attiva' : 'Disattivata'}</strong></span>*/}
        </div>
      </div>
      <div className="expense-detail-hero-side-wrap">
        <span className="text-pre">{cadenceLabels[item.cadence] ?? item.cadence}</span>
        <div className={item.isActive ? 'expense-detail-hero-side expense-detail-hero-side-paid' : 'expense-detail-hero-side expense-detail-hero-side-unpaid'}>
          <span className="expense-detail-side-label">Importo ricorrente</span>
          <strong>{euro(item.amount.toString())}</strong>
          <div className="detail-money-row">
            <span className={badgeClass(activeClass)}>{item.isActive ? 'Regola attiva' : 'Regola disattivata'}</span>
            <span className={badgeClass(vatStyle.className)}>{vatStyle.label}</span>
          </div>
        </div>
      </div>
    </section>

    <section className="expense-detail-priority-grid recurring-detail-priority-grid">
      <div className="expense-detail-priority-card supplier-card">
        <span>Fornitore</span>
        <strong>{item.supplierId ? <Link href={`/suppliers/${item.supplierId}`}>{merchant}</Link> : merchant}</strong>
        <small>{item.category ? <span className={badgeClass(categoryClassName)}>{categoryLabel(item.category, item.category.name)}</span> : 'Senza categoria'}</small>
      </div>
      <div className="expense-detail-priority-card amount-card">
        <span>Importo</span>
        <strong>{euro(item.amount.toString())}</strong>
        <small><span className={badgeClass(vatStyle.className)}>{vatStyle.label}</span></small>
      </div>
      <div className="expense-detail-priority-card status-card">
        <span>Cadenza</span>
        <strong>{cadenceLabels[item.cadence] ?? item.cadence}</strong>
        <small>Scadenza: {dueLabel(item)}</small>
      </div>
      <div className="expense-detail-priority-card due-card">
        <span>Periodo fatturazione</span>
        <strong>{billingLabel(item)}</strong>
        <small>Competenza: {accrualLabels[item.accrualType] ?? item.accrualType}</small>
      </div>
      <div className="expense-detail-priority-card declared-card">
        <span>Detrazione:&nbsp;&nbsp;<strong>{booleanBadge(item.isDeclared)}</strong></span>
        <span>Fattura Elett:&nbsp;&nbsp;{booleanBadge(item.hasElectronicInvoice)}</span>
        <span>Pagamento automatico:&nbsp;&nbsp;{booleanBadge(Boolean(item.paymentChannel || item.bankId))}</span>
      </div>
    </section>

    <section className="card recurring-detail-grid-card">
      <div className="expense-detail-section-title">
        <div>
          <h2>Regola di pagamento</h2>
          <p className="muted">Metodo, banca e note configurate per la ricorrenza.</p>
        </div>
      </div>
      <div className="detail-grid expense-detail-secondary-grid">
        <div><span>Canale pagamento</span><strong>{item.paymentChannel ?? '-'}</strong></div>
        <div><span>Banca</span><strong>{item.bank ? `${bankIcons[item.bank.name] ?? '🏦'} ${item.bank.name}` : '-'}</strong></div>
        <div><span>Giorno scadenza</span><strong>{dueLabel(item)}</strong></div>
        <div><span>Data inizio</span><strong>{dateLabel(item.startDate)}</strong></div>
        <div className="full"><span>Note</span><strong>{item.notes ?? '-'}</strong></div>
      </div>
    </section>

    <section className="card expense-detail-payments-card">
      <div className="expense-detail-section-title">
        <div>
          <h2>Spese generate</h2>
          <p className="muted">Ultime spese create da questa regola ricorrente.</p>
        </div>
        <span className="badge">{item.generatedExpenses.length} record · {euro(generatedTotal)}</span>
      </div>

      <div className="table-scroll recurring-generated-desktop">
        <table className="expense-payments-table recurring-generated-table">
          <thead><tr><th>Periodo</th><th>Data ordine</th><th>Descrizione</th><th>Importo</th><th>Dettaglio</th></tr></thead>
          <tbody>
            {item.generatedExpenses.length ? item.generatedExpenses.map(expense => <tr key={expense.id}>
              <td>{formatPeriod(expense.month, expense.year)}</td>
              <td>{dateLabel(expense.receivedDate)}</td>
              <td>{expense.description ?? '-'}</td>
              <td><strong>{euro(expense.amount.toString())}</strong></td>
              <td><Link className="table-action secondary icon-action" href={`/expenses/${expense.id}?returnTo=${encodeURIComponent(`/recurring-expenses/${item.id}`)}`}>👁</Link></td>
            </tr>) : <tr><td colSpan={5}>Nessuna spesa generata da questa ricorrenza.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="expense-payments-mobile">
        {item.generatedExpenses.length ? item.generatedExpenses.map(expense => <Link className="expense-payment-mobile-card recurring-generated-mobile-card" href={`/expenses/${expense.id}?returnTo=${encodeURIComponent(`/recurring-expenses/${item.id}`)}`} key={`generated-mobile-${expense.id}`}>
          <div className="expense-payment-mobile-top">
            <strong>{euro(expense.amount.toString())}</strong>
            <span>{formatPeriod(expense.month, expense.year)}</span>
          </div>
          <div className="expense-payment-mobile-row"><span>Data ordine</span><b>{dateLabel(expense.receivedDate)}</b></div>
          <div className="expense-payment-mobile-row"><span>Descrizione</span><b>{expense.description ?? '-'}</b></div>
        </Link>) : <p className="muted">Nessuna spesa generata da questa ricorrenza.</p>}
      </div>
    </section>
  </div>;
}
