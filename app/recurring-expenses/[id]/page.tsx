import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import RecurringExpenseDetailEditModalController from '@/components/RecurringExpenseDetailEditModalController';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import { euro } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderPaymentMethods } from '@/lib/workspace-defaults';
import { stripFlashParams } from '@/lib/flash';
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
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? stripFlashParams(rawReturnTo) : '/recurring-expenses';
  const currentDetailReturnTo = `/recurring-expenses/${id}?returnTo=${encodeURIComponent(returnTo)}`;

  const [item, categories, banks, paymentMethods, suppliers] = await Promise.all([
    prisma.recurringExpense.findUnique({
    where: { id: Number(id) },
    include: {
      supplier: true,
      category: true,
      bank: true,
      paymentMethod: true,
      generatedExpenses: {
        include: { category: true, payments: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { receivedDate: 'desc' }],
        take: 24
      }
    }
    }),
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  if (!item || item.workspaceId !== current.workspace.id) notFound();

  const categoryClassName = categoryTone(item.category);
  const vatStyle = vatStyles[vatKey(item.vatRate)] ?? vatStyles['22'];
  const generatedTotal = item.generatedExpenses.reduce((sum, expense) => sum + Number(expense.amount.toString()), 0);
  const merchant = item.supplier?.businessName || item.merchant;
  const activeClass = item.isActive ? 'tone-yes' : 'tone-critical';
  const orderedBanks = orderBanks(banks);
  const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');
  const paymentChannelName = item.paymentMethod?.name ?? item.paymentChannel;
  const flashMessages = {
    savedMessages: {
      created: 'Spesa ricorrente creata.',
      updated: 'Spesa ricorrente aggiornata.',
      deleted: 'Spesa ricorrente rimossa.'
    },
    errorMessages: {
      invalid: 'Controlla i dati della spesa ricorrente.',
      not_found: 'Spesa ricorrente non trovata.',
      in_use: 'La spesa ricorrente è collegata ad altri movimenti.'
    }
  };

  return <div className="grid expense-detail-page recurring-expense-detail-page">
    <RecurringExpenseDetailEditModalController
      categories={categories.map(category => ({ id: category.id, code: category.code, name: category.name, icon: category.icon }))}
      banks={orderedBanks.map(bank => ({ id: bank.id, name: bank.name, isFallback: bank.isFallback }))}
      paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback }))}
      suppliers={suppliers.map(supplier => ({ id: supplier.id, businessName: supplier.businessName, alias: supplier.alias, email: supplier.email, phone: supplier.phone, pec: supplier.pec, taxCodeSdi: supplier.taxCodeSdi, internalNotes: supplier.internalNotes }))}
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
      <article className="expense-detail-document recurring-detail-document">
        <div className="expense-detail-action-row">
          <div className="left-side">
            <Link className="table-action secondary" href={returnTo}>↩ Indietro</Link>
          </div>
          <div className="right-side">
            <Link className="table-action" href="#" data-recurring-expense-detail-edit-id={item.id}>✎ Modifica</Link>
          </div>
        </div>

        <section className="expense-detail-hero">
          <div>
            <div className="expense-detail-title-block">
              <p className="expense-detail-kicker">
                <span>Spesa ricorrente #{item.id}</span>
                <span className={badgeClass(activeClass)}>{item.isActive ? 'ON' : 'OFF'}</span>
              </p>
              <h1>{item.supplierId ? <Link href={`/suppliers/${item.supplierId}`}>{merchant}</Link> : merchant}</h1>
              <div className="expense-detail-meta-line">
                <span>{item.category ? categoryLabel(item.category, item.category.name) : 'Senza categoria'}</span>
                <span>{item.description ?? 'Spesa ricorrente senza descrizione'}</span>
              </div>
            </div>
          </div>

          <aside className="expense-detail-amount-panel">
            <div className="expense-detail-amount-panel-header-row">
              <span className="expense-detail-amount-panel-header">Importo ricorrente</span>
              <span className={badgeClass(vatStyle.className)}>{vatStyle.label}</span>
            </div>
            <strong>{euro(item.amount.toString())}</strong>
            <div className="expense-detail-badge-row">
              <span className={badgeClass(activeClass)}>{item.isActive ? 'Regola attiva' : 'Regola disattivata'}</span>
              <span className="badge">{cadenceLabels[item.cadence] ?? item.cadence}</span>
            </div>
          </aside>
        </section>

        <section className="expense-detail-status-strip">
          <div>
            <span>Cadenza</span>
            <strong>{cadenceLabels[item.cadence] ?? item.cadence}</strong>
          </div>
          <div>
            <span>Scadenza</span>
            <strong>{dueLabel(item)}</strong>
          </div>
          <div>
            <span>Fatturazione</span>
            <strong>{billingLabel(item)}</strong>
          </div>
          <div>
            <span>Competenza</span>
            <strong>{accrualLabels[item.accrualType] ?? item.accrualType}</strong>
          </div>
        </section>
        <div className="expense-detail-progress" aria-label={item.isActive ? 'Regola attiva' : 'Regola disattivata'}>
          <span style={{ width: item.isActive ? '100%' : '0%' }} />
        </div>

        <section className="expense-detail-section">
          <div className="expense-detail-section-heading">
            <div>
              <h2>Dati ricorrenza</h2>
              <p>Fornitore, categoria e impostazioni fiscali della regola.</p>
            </div>
          </div>
          <div className="expense-detail-status-strip">
            <div>
              <span>Fornitore</span>
              <strong>{item.supplierId ? <Link href={`/suppliers/${item.supplierId}`}>{merchant}</Link> : merchant}</strong>
            </div>
            <div>
              <span>Categoria</span>
              <strong>{item.category ? categoryLabel(item.category, item.category.name) : 'Senza categoria'}</strong>
            </div>
            <div>
              <span>Data inizio</span>
              <strong>{dateLabel(item.startDate)}</strong>
            </div>
            <div>
              <span>Stato</span>
              <strong>{item.isActive ? '✓ Attiva' : '× Disattivata'}</strong>
            </div>
            <div>
              <span>Detrazione</span>
              <strong>{booleanBadge(item.isDeclared)}</strong>
            </div>
            <div>
              <span>F. elettronica</span>
              <strong>{booleanBadge(item.hasElectronicInvoice)}</strong>
            </div>
          </div>
        </section>

        <section className="expense-detail-section">
          <div className="expense-detail-section-heading">
            <div>
              <h2>Regola di pagamento</h2>
              <p>Metodo, banca e note configurate per la ricorrenza.</p>
            </div>
          </div>
          <div className="expense-detail-status-strip">
            <div>
              <span>Canale pagamento</span>
              <strong>{paymentChannelName ?? '-'}</strong>
            </div>
            <div>
              <span>Banca</span>
              <strong>{item.bank ? `${bankIcons[item.bank.name] ?? '🏦'} ${item.bank.name}` : '-'}</strong>
            </div>
            <div>
              <span>Pagamento automatico</span>
              <strong>{Boolean(paymentChannelName || item.bankId) ? '✓ Si' : '× No'}</strong>
            </div>
            <div>
              <span>Giorno scadenza</span>
              <strong>{dueLabel(item)}</strong>
            </div>
          </div>
          <div className="expense-detail-item expense-detail-item-wide">
            <span>Note</span>
            <strong>{item.notes ?? '-'}</strong>
          </div>
        </section>

        <section className="expense-detail-section">
          <div className="expense-detail-section-heading">
            <div>
              <h2>Spese generate</h2>
              <p>Ultime spese create da questa regola ricorrente.</p>
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
      </article>
    </div>
  </div>;
}
