import Link from 'next/link';
import BulkSelectionController from '@/components/BulkSelectionController';
import RecurringExpenseFiltersDrawer from '@/components/RecurringExpenseFiltersDrawer';
import RecurringExpenseDetailEditModalController from '@/components/RecurringExpenseDetailEditModalController';
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

function inputDefault(filters: Record<string, string | string[] | undefined>, key: string) {
  const value = filters[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function optionLabel(options: FilterOption[], value: string) {
  const id = Number(value);
  return options.find(option => option.id === id)?.name ?? value;
}

const activeLabels: Record<string, string> = {
  true: 'Attive',
  false: 'Disattivate'
};

const paymentChannelLabels: Record<string, string> = {
  Addebito: 'Addebito',
  Bonifico: 'Bonifico',
  'RID Bancario': 'RID Bancario',
  'Modello F24': 'Modello F24',
  'Carta di Debito': 'Carta di Debito',
  PayPal: 'PayPal',
  Mooney: 'Mooney',
  Cash: 'Cash'
};

type FilterOption = { id: number; name: string };
type CategoryOption = { id: number; code?: string; name: string };
type SupplierOption = { id: number; businessName: string; alias?: string | null; email?: string | null; phone?: string | null; pec?: string | null; taxCodeSdi?: string | null; internalNotes?: string | null };

export default function RecurringExpensesList({
  items,
  filters,
  categories,
  banks,
  suppliers,
}: {
  items: any[];
  filters?: Record<string, string | string[] | undefined>;
  categories: CategoryOption[];
  banks: FilterOption[];
  suppliers: SupplierOption[];
}) {
  const itemCount = items.length;
  const currentFilters = filters ?? {};
  const activeFilterItems = [
    inputDefault(currentFilters, 'merchant') ? `Fornitore: ${inputDefault(currentFilters, 'merchant')}` : '',
    inputDefault(currentFilters, 'description') ? `Descrizione: ${inputDefault(currentFilters, 'description')}` : '',
    inputDefault(currentFilters, 'categoryId') ? `Categoria: ${optionLabel(categories, inputDefault(currentFilters, 'categoryId'))}` : '',
    inputDefault(currentFilters, 'isActive') ? `Stato: ${activeLabels[inputDefault(currentFilters, 'isActive')] ?? inputDefault(currentFilters, 'isActive')}` : '',
    inputDefault(currentFilters, 'cadence') ? `Cadenza: ${cadenceLabels[inputDefault(currentFilters, 'cadence')] ?? inputDefault(currentFilters, 'cadence')}` : '',
    inputDefault(currentFilters, 'billingPeriodMode') ? `Periodo: ${billingLabels[inputDefault(currentFilters, 'billingPeriodMode')] ?? inputDefault(currentFilters, 'billingPeriodMode')}` : '',
    inputDefault(currentFilters, 'paymentChannel') ? `Pagamento: ${paymentChannelLabels[inputDefault(currentFilters, 'paymentChannel')] ?? inputDefault(currentFilters, 'paymentChannel')}` : '',
    inputDefault(currentFilters, 'bankId') ? `Banca: ${optionLabel(banks, inputDefault(currentFilters, 'bankId'))}` : '',
    inputDefault(currentFilters, 'amountMin') ? `Importo min: ${inputDefault(currentFilters, 'amountMin')}` : '',
    inputDefault(currentFilters, 'amountMax') ? `Importo max: ${inputDefault(currentFilters, 'amountMax')}` : '',
  ].filter(Boolean);
  return <div className="card recurring-expenses-card">
    <RecurringExpenseDetailEditModalController categories={categories} banks={banks} suppliers={suppliers} returnTo="/recurring-expenses" />
    <div className="list-heading recurring-list-heading">
      <div>
        <h2>Lista spese ricorrenti</h2>
      </div>
      <div>
        <RecurringExpenseFiltersDrawer filters={filters ?? {}} categories={categories} banks={banks} />
      </div>
    </div>
    {activeFilterItems.length ? <div className="recurring-active-filters">
      <div>
        <span className="recurring-active-filters-title">Filtri attivi</span>
        <div className="recurring-active-filter-tags">
          {activeFilterItems.map(item => <span className="badge" key={item}>{item}</span>)}
        </div>
      </div>
      <Link className="table-action secondary recurring-active-filters-reset" href="/recurring-expenses">↺ Reset</Link>
    </div> : null}

    <BulkSelectionController />
    <script dangerouslySetInnerHTML={{ __html: `
      document.addEventListener('click', function(event) {
        const row = event.target.closest && event.target.closest('[data-row-href]');
        if (!row) return;
        if (window.matchMedia && !window.matchMedia('(min-width: 761px)').matches) return;
        if (event.target.closest('a, button, input, select, textarea, label, summary, details')) return;
        const href = row.getAttribute('data-row-href');
        if (href) window.location.href = href;
      });
      document.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target && event.target.matches && event.target.matches('[data-row-href]') ? event.target : null;
        if (!row) return;
        if (window.matchMedia && !window.matchMedia('(min-width: 761px)').matches) return;
        event.preventDefault();
        const href = row.getAttribute('data-row-href');
        if (href) window.location.href = href;
      });
    ` }} />
    <form id="recurringExpenseBulkForm" action="/api/recurring-expenses/bulk?returnTo=/recurring-expenses" method="post" className="bulk-actions-bar confirm-bulk-form recurring-bulk-actions-bar">
      <p className="muted">Risultati mostrati: {itemCount}</p>
      <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form="recurringExpenseBulkForm" data-edit-base="/recurring-expenses/" data-edit-suffix="" data-edit-trigger-attr="data-recurring-expense-detail-edit-id" data-return-to="%2Frecurring-expenses">
        <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true"><span className="btn-icon">✎</span><span className="bulk-label">Modifica</span></a>
        <button type="submit" className="bulk-direct-link bulk-direct-danger" name="bulkAction" value="delete" data-bulk-delete data-confirm-label="Elimina" disabled><span className="btn-icon">🗑</span><span className="bulk-label">Elimina</span></button>
      </div>
      <div className="bulk-inner-container">
        <button className="bulk-direct-link button-standard primary-action" type="button" data-bulk-new data-recurring-expense-new data-floating-label="Spesa ricorrente">
          <span className="btn-icon">+</span>
          <span className="bulk-label">Spesa ricorrente</span>
        </button>
      </div>
    </form>
    {items.length ? <>
      <div className="recurring-expenses-list recurring-expenses-desktop-list">{items.map(item => <div className="recurring-expense-row recurring-expense-row-with-select clickable-desktop-row" data-row-href={`/recurring-expenses/${item.id}`} role="link" tabIndex={0} key={item.id}>
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
