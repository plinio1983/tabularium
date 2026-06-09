import Link from 'next/link';
import BulkSelectionController from '@/components/BulkSelectionController';
import RecurringExpenseFiltersDrawer from '@/components/RecurringExpenseFiltersDrawer';
import { euro } from '@/lib/money';

const cadenceLabels: Record<string, string> = { MONTHLY:'Ogni mese', EVERY_2_MONTHS:'Ogni 2 mesi', EVERY_3_MONTHS:'Ogni 3 mesi', EVERY_6_MONTHS:'Ogni 6 mesi', YEARLY:'Annuale', EVERY_2_YEARS:'Ogni 2 anni' };
const billingLabels: Record<string, string> = { SAME_MONTH:'Stesso mese', NEXT_MONTH:'Mese successivo', CUSTOM_MONTH:'Mese impostato' };
const months = ['', 'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function dateLabel(value?: Date | string | null) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' }).format(date);
}
function dueLabel(item: any) {
  if (item.dueMonth) return `${item.dueDay ?? '-'} ${months[item.dueMonth] ?? ''}`;
  if (item.dueDay) return `Giorno ${item.dueDay}`;
  return '-';
}

type FilterOption = { id: number; name: string };

export default function RecurringExpensesList({
  items,
  filters,
  categories,
  banks,
}: {
  items: any[];
  filters?: Record<string, string | string[] | undefined>;
  categories: FilterOption[];
  banks: FilterOption[];
}) {
  const itemCount = items.length;
  return <div className="card recurring-expenses-card">
    <div className="list-heading recurring-list-heading">
      <div>
        <h2>Lista spese ricorrenti</h2>
      </div>
      <div>
        <RecurringExpenseFiltersDrawer filters={filters ?? {}} categories={categories} banks={banks} />
      </div>
    </div>
    <BulkSelectionController />
    <form id="recurringExpenseBulkForm" action="/api/recurring-expenses/bulk?returnTo=/recurring-expenses" method="post" className="bulk-actions-bar confirm-bulk-form recurring-bulk-actions-bar">
      <p className="muted">Risultati mostrati: {itemCount}</p>
      <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form="recurringExpenseBulkForm" data-edit-base="/recurring-expenses/" data-edit-suffix="" data-return-to="%2Frecurring-expenses">
        <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true"><span className="btn-icon">✎</span><span className="bulk-label">Modifica</span></a>
        <button type="submit" className="bulk-direct-link bulk-direct-danger" name="bulkAction" value="delete" data-bulk-delete data-confirm-label="Elimina" disabled><span className="btn-icon">🗑</span><span className="bulk-label">Elimina</span></button>
      </div>
    </form>
    {items.length ? <>
      <div className="recurring-expenses-list recurring-expenses-desktop-list">{items.map(item => <div className="recurring-expense-row recurring-expense-row-with-select" key={item.id}>
        <div className="recurring-expense-select"><input form="recurringExpenseBulkForm" type="checkbox" name="ids" value={item.id} aria-label={`Seleziona spesa ricorrente ${item.id}`} /></div>
        <div><span className={item.isActive ? 'status-dot is-active' : 'status-dot'} /><strong>{item.description}</strong><small>{item.supplier?.businessName || item.merchant} · {item.category?.name ?? 'Senza categoria'}</small></div>
        <div><span>Cadenza</span><strong>{cadenceLabels[item.cadence] ?? item.cadence}</strong></div>
        <div><span>Scadenza</span><strong>{dueLabel(item)}</strong></div>
        <div><span>Periodo fatt.</span><strong>{billingLabels[item.billingPeriodMode] ?? item.billingPeriodMode}{item.billingMonth ? ` · ${months[item.billingMonth]}` : ''}</strong></div>
        <div><span>Pagamento</span><strong>{item.paymentChannel ?? '-'}{item.bank ? ` · ${item.bank.name}` : ''}</strong></div>
        <div><span>Inizio</span><strong>{dateLabel(item.startDate)}</strong></div>
        <div><span>Importo</span><strong>{euro(item.amount.toString())}</strong></div>
      </div>)}</div>

      <div className="recurring-expenses-mobile-list" aria-label="Lista spese ricorrenti mobile">
        {items.map(item => {
          const cadence = cadenceLabels[item.cadence] ?? item.cadence;
          const billing = `${billingLabels[item.billingPeriodMode] ?? item.billingPeriodMode}${item.billingMonth ? ` · ${months[item.billingMonth]}` : ''}`;
          const supplier = item.supplier?.businessName || item.merchant || 'Fornitore non impostato';
          const payment = item.paymentChannel ? `${item.paymentChannel}${item.bank ? ` · ${item.bank.name}` : ''}` : 'Pagamento manuale';
          return <div className="recurring-mobile-item-shell" key={`mobile-recurring-${item.id}`}>
            <div className="recurring-mobile-select">
              <input form="recurringExpenseBulkForm" type="checkbox" name="ids" value={item.id} aria-label={`Seleziona spesa ricorrente ${item.id}`} />
            </div>
            <Link className="recurring-mobile-item-link" href={`/recurring-expenses/${item.id}`}>
            <article className={item.isActive ? "recurring-mobile-item recurring-mobile-item-active" : "recurring-mobile-item recurring-mobile-item-disabled"}>
            <div className="recurring-mobile-top">
              <div className="recurring-mobile-main-title">
                <span className={item.isActive ? 'recurring-mobile-status is-active' : 'recurring-mobile-status'}>{item.isActive ? 'ON' : 'OFF'}</span>
                <span className="badge">{cadence}</span>
                <span className="badge">{dueLabel(item)}</span>
              </div>
              <strong className="recurring-mobile-amount">{euro(item.amount.toString())}</strong>
            </div>
            <div className="recurring-mobile-top">
              <strong>{supplier}</strong>
              <div><span className="badge">{item.category?.name ?? 'Senza categoria'}</span></div>
            </div>

            <div className="recurring-mobile-description">{item.description || 'Spesa ricorrente senza descrizione'}</div>

            {/*<div className="recurring-mobile-badges">*/}
              {/*<span>{cadence}</span>*/}
              {/*<span>Scad. {dueLabel(item)}</span>*/}
            {/*</div>*/}

            <div className="recurring-mobile-meta">
              <div><span>Pagamento</span><strong>{payment}</strong></div>
              <div><span>Periodo fatt.</span><strong>{billing}</strong></div>
              <div><span>Inizio</span><strong>{dateLabel(item.startDate)}</strong></div>
            </div>
          </article>
          </Link>
          </div>;
        })}
      </div>
    </> : <p className="muted">Nessuna spesa ricorrente configurata.</p>}
  </div>;
}
