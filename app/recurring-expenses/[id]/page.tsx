import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import RecurringExpenseDetailEditModalController from '@/components/RecurringExpenseDetailEditModalController';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import DeleteActionButton from '@/components/DeleteActionButton';
import ExpensesList from '@/components/ExpensesList';
import { euro } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderExpenseCategories, orderPaymentMethods } from '@/lib/workspace-defaults';
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
  const encodedCurrentDetailReturnTo = encodeURIComponent(currentDetailReturnTo);

  const [item, categories, banks, paymentMethods, suppliers] = await Promise.all([
    prisma.recurringExpense.findUnique({
    where: { id: Number(id) },
    include: {
      supplier: true,
      category: true,
      bank: true,
      paymentMethod: true,
      generatedExpenses: {
        include: { category: true, supplier: true, payments: true },
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
  const orderedCategories = orderExpenseCategories(categories);
  const orderedBanks = orderBanks(banks);
  const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');
  const paymentChannelName = item.paymentMethod?.name ?? item.paymentChannel;
  const recurringDetailHref = `/recurring-expenses/${item.id}`;
  const encodedRecurringDetailHref = encodeURIComponent(recurringDetailHref);
  const flashMessages = {
    savedMessages: {
      created: 'Spesa ricorrente creata.',
      updated: 'Spesa ricorrente aggiornata.',
      deleted: 'Spesa ricorrente rimossa.'
    },
    errorMessages: {
      invalid: 'Controlla i dati della spesa ricorrente.',
      supplier_not_found: 'Fornitore non trovato. Aggiungilo prima con il pulsante Nuovo nel campo Esercente, poi salva la spesa ricorrente.',
      not_found: 'Spesa ricorrente non trovata.',
      in_use: 'La spesa ricorrente è collegata ad altri movimenti.'
    }
  };

  return <div className="grid expense-detail-page recurring-expense-detail-page">
    <RecurringExpenseDetailEditModalController
      categories={categories.map(category => ({ id: category.id, code: category.code, name: category.name, icon: category.icon }))}
      banks={orderedBanks.map(bank => ({ id: bank.id, name: bank.name, isFallback: bank.isFallback }))}
      paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback }))}
      suppliers={suppliers.map(supplier => ({ id: supplier.id, businessName: supplier.businessName, alias: supplier.alias, email: supplier.email, vatNumber: supplier.vatNumber, iban: supplier.iban, pec: supplier.pec, taxCodeSdi: supplier.taxCodeSdi, internalNotes: supplier.internalNotes }))}
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
            <Link className="btn btn-sm btn-default" href={returnTo}><span className="btn-icon">↩</span> Indietro</Link>
          </div>
          <div className="right-side">
            <button className="btn btn-sm btn-default" type="button" data-recurring-expense-detail-edit-id={item.id}>✎ Modifica</button>
            <DeleteActionButton
              action={`/api/recurring-expenses/${item.id}?returnTo=${encodeURIComponent(returnTo)}`}
              confirmMessage="Confermi la rimozione della spesa ricorrente? L’operazione non può essere annullata."
              className="btn btn-sm btn-danger"
            >
              🗑 Elimina
            </DeleteActionButton>
          </div>
        </div>

        <section className="expense-detail-hero">
          <div>
            <div className="expense-detail-title-block">
              <p className="expense-detail-kicker">
                <span>Spesa ricorrente #{item.id}</span>
                <span className={badgeClass(activeClass)}>{item.isActive ? 'ON' : 'OFF'}</span>
              </p>
              <h1>{item.supplierId ? <Link href={`/suppliers/${item.supplierId}?returnTo=${encodedCurrentDetailReturnTo}`}>{merchant}</Link> : merchant}</h1>
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
            <span>Pagamento</span>
            <strong>{item.isAutomaticPayment ? 'Automatico' : 'Manuale'}</strong>
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
              <span>Descrizione</span>
              <strong>{item.description ?? '-'}</strong>
            </div>
            <div>
              <span>Fornitore</span>
              <strong>{item.supplierId ? <Link href={`/suppliers/${item.supplierId}?returnTo=${encodedCurrentDetailReturnTo}`}>{merchant}</Link> : merchant}</strong>
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
        </section>

        <section className="expense-detail-section">
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

          <div className="recurring-generated-expenses-list">
            <ExpensesList
              expenses={item.generatedExpenses}
              returnTo={encodedRecurringDetailHref}
              showSupplierColumn={false}
              selectable
              formId="recurringGeneratedExpenseBulkForm"
              categories={orderedCategories.map(category => ({ id: category.id, code: category.code, name: category.name, icon: category.icon }))}
              banks={orderedBanks.map(bank => ({ id: bank.id, name: bank.name, isFallback: bank.isFallback }))}
              paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback }))}
              suppliers={suppliers.map(supplier => ({ id: supplier.id, businessName: supplier.businessName, alias: supplier.alias, email: supplier.email, vatNumber: supplier.vatNumber, iban: supplier.iban, pec: supplier.pec, taxCodeSdi: supplier.taxCodeSdi, internalNotes: supplier.internalNotes }))}
              mobileLabel="Spese generate mobile"
              emptyMessage="Nessuna spesa generata da questa ricorrenza."
            />
          </div>
        </section>
      </article>
    </div>
  </div>;
}
