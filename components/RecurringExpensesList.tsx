import Link from 'next/link';
import BulkSelectionController from '@/components/BulkSelectionController';
import BulkChangeCategoryModal from '@/components/BulkChangeCategoryModal';
import RecurringExpenseFiltersDrawer from '@/components/RecurringExpenseFiltersDrawer';
import RecurringExpenseDetailEditModalController from '@/components/RecurringExpenseDetailEditModalController';
import { euro } from '@/lib/money';
import { bankIcons, badgeClass, categoryLabel, categoryTone } from '@/lib/expense-ui';

const cadenceLabels: Record<string, string> = { MONTHLY:'Ogni mese', EVERY_2_MONTHS:'Ogni 2 mesi', EVERY_3_MONTHS:'Ogni 3 mesi', EVERY_6_MONTHS:'Ogni 6 mesi', YEARLY:'Annuale', EVERY_2_YEARS:'Ogni 2 anni' };
const billingLabels: Record<string, string> = { SAME_MONTH:'Stesso mese', NEXT_MONTH:'Mese successivo', CUSTOM_MONTH:'Mese impostato' };
const months = ['', 'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const cadenceStyles: Record<string, { icon: string; className: string }> = {
  MONTHLY: { icon: '↻', className: 'tone-paid' },
  EVERY_2_MONTHS: { icon: '2M', className: 'tone-web' },
  EVERY_3_MONTHS: { icon: '3M', className: 'tone-installment' },
  EVERY_6_MONTHS: { icon: '6M', className: 'tone-services' },
  YEARLY: { icon: '12M', className: 'tone-taxes' },
  EVERY_2_YEARS: { icon: '24M', className: 'tone-neutral' }
};
const billingStyles: Record<string, { icon: string; className: string }> = {
  SAME_MONTH: { icon: 'M', className: 'tone-vat-22' },
  NEXT_MONTH: { icon: '+1', className: 'tone-vat-10' },
  CUSTOM_MONTH: { icon: 'CAL', className: 'tone-vat-4' }
};

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

type FilterOption = { id: number; name: string; kind?: string; isFallback?: boolean | null };
type CategoryOption = { id: number; code?: string; name: string; icon?: string | null };
type SupplierOption = { id: number; businessName: string; alias?: string | null; email?: string | null; phone?: string | null; pec?: string | null; taxCodeSdi?: string | null; internalNotes?: string | null };

export default function RecurringExpensesList({
  items,
  filters,
  categories,
  banks,
  paymentMethods,
  suppliers,
}: {
  items: any[];
  filters?: Record<string, string | string[] | undefined>;
  categories: CategoryOption[];
  banks: FilterOption[];
  paymentMethods: FilterOption[];
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
    <RecurringExpenseDetailEditModalController categories={categories} banks={banks} paymentMethods={paymentMethods} suppliers={suppliers} returnTo="/recurring-expenses" />
    <div className="list-heading recurring-list-heading">
      <div>
        <h2>Lista spese ricorrenti</h2>
      </div>
      <div>
        <RecurringExpenseFiltersDrawer filters={filters ?? {}} categories={categories} banks={banks} paymentMethods={paymentMethods} />
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
    <p className="muted">Risultati mostrati: {itemCount}</p>
    <form id="recurringExpenseBulkForm" action="/api/recurring-expenses/bulk?returnTo=/recurring-expenses" method="post" className="bulk-actions-bar confirm-bulk-form recurring-bulk-actions-bar">
      <label className="bulk-select-all-inline">
        <input type="checkbox" className="bulk-select-all" data-bulk-target="recurringExpenseBulkForm" aria-label="Seleziona tutte le spese ricorrenti visibili" />
      </label>
      <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form="recurringExpenseBulkForm">
        <summary className="bulk-action-trigger"><span className="btn-icon">⚙</span><span className="bulk-label"><span className="floating-bulk-label">Bulk </span>Actions</span></summary>
        <div className="bulk-action-menu-panel">
          <BulkChangeCategoryModal
            formId="recurringExpenseBulkForm"
            action="/api/recurring-expenses/bulk?returnTo=/recurring-expenses"
            fieldName="categoryId"
            categories={categories.map(category => ({ value: String(category.id), label: category.name, icon: category.icon }))}
          />
        </div>
      </details>
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
      <div className="table-scroll recurring-expenses-desktop-table-scroll">
        <table className="expenses-table compact-recurring-expenses-table">
          <thead><tr>
            <th className="cell-center"><input type="checkbox" className="bulk-select-all" data-bulk-target="recurringExpenseBulkForm" aria-label="Seleziona tutte le spese ricorrenti" /></th>
            <th className="cell-left">Stato</th>
            <th className="cell-left">Fornitore</th>
            <th className="cell-left">Descrizione</th>
            <th className="cell-left">Categoria</th>
            <th className="cell-right">Importo</th>
            <th className="cell-left">Cadenza</th>
            <th className="cell-left">Scadenza</th>
            <th className="cell-left"><span className="th-wrap">Periodo<br />fatt.</span></th>
            <th className="cell-left">Pagamento</th>
            <th className="cell-left">Inizio</th>
          </tr></thead>
          <tbody>
            {items.map(item => {
              const supplier = item.supplier?.businessName || item.merchant || '-';
              const billing = `${billingLabels[item.billingPeriodMode] ?? item.billingPeriodMode}${item.billingMonth ? ` · ${months[item.billingMonth]}` : ''}`;
              const paymentChannelName = item.paymentMethod?.name ?? item.paymentChannel;
              const payment = paymentChannelName ? `${paymentChannelName}${item.bank ? ` · ${item.bank.name}` : ''}` : '-';
              const categoryClassName = categoryTone(item.category);
              const cadenceStyle = cadenceStyles[item.cadence] ?? { icon: '↻', className: 'tone-neutral' };
              const billingStyle = billingStyles[item.billingPeriodMode] ?? { icon: 'CAL', className: 'tone-neutral' };
              const statusStyle = item.isActive ? { icon: '✓', label: 'Attiva', className: 'tone-yes' } : { icon: '×', label: 'Off', className: 'tone-critical' };
              return <tr className="clickable-desktop-row" data-row-href={`/recurring-expenses/${item.id}`} tabIndex={0} key={item.id}>
                <td className="cell-center"><input form="recurringExpenseBulkForm" type="checkbox" name="ids" value={item.id} aria-label={`Seleziona spesa ricorrente ${item.id}`} /></td>
                <td className="cell-left"><span className={badgeClass(statusStyle.className)}>{statusStyle.icon} {statusStyle.label}</span></td>
                <td className="cell-left recurring-supplier-cell" title={supplier}><span className="recurring-table-supplier-icon">↻</span>{supplier}</td>
                <td className="cell-left recurring-description-cell" title={item.description ?? ''}>{item.description || '-'}</td>
                <td className="cell-left">{item.category ? <span title={item.category.name} className={badgeClass(categoryClassName)}>{categoryLabel(item.category, item.category.code)}</span> : <span className={badgeClass('tone-neutral')}>• ND</span>}</td>
                <td className="cell-right nowrap-cell"><strong className="recurring-table-amount">€ {euro(item.amount.toString()).replace('€', '').trim()}</strong></td>
                <td className="cell-left"><span className={badgeClass(cadenceStyle.className)}>{cadenceStyle.icon} {cadenceLabels[item.cadence] ?? item.cadence}</span></td>
                <td className="cell-left nowrap-cell"><span className={badgeClass('tone-waiting')}>📅 {dueLabel(item)}</span></td>
                <td className="cell-left nowrap-cell"><span className={badgeClass(billingStyle.className)}>{billingStyle.icon} {billing}</span></td>
                <td className="cell-left recurring-payment-cell" title={payment}>{paymentChannelName ? <span className={badgeClass(item.bank ? 'tone-bank-services' : 'tone-neutral')}>{item.bank ? `${bankIcons[item.bank.name] ?? '🏦'} ` : '• '}{payment}</span> : <span className={badgeClass('tone-neutral')}>• Manuale</span>}</td>
                <td className="cell-left nowrap-cell">{dateLabel(item.startDate)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      <div className="recurring-expenses-mobile-list" aria-label="Lista spese ricorrenti mobile">
        {items.map(item => {
          const cadence = cadenceLabels[item.cadence] ?? item.cadence;
          const billing = `${billingLabels[item.billingPeriodMode] ?? item.billingPeriodMode}${item.billingMonth ? ` · ${months[item.billingMonth]}` : ''}`;
          const supplier = item.supplier?.businessName || item.merchant || 'Fornitore non impostato';
          const paymentChannelName = item.paymentMethod?.name ?? item.paymentChannel;
          const payment = paymentChannelName ? `${paymentChannelName}${item.bank ? ` · ${item.bank.name}` : ''}` : 'Pagamento manuale';
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

            <div className="recurring-mobile-middle">
              <div className="recurring-mobile-description">{item.description || 'Spesa ricorrente senza descrizione'}</div>
              <span className="recurring-mobile-right"><strong>{payment}</strong></span>
            </div>

            {/*<div className="recurring-mobile-badges">*/}
              {/*<span>{cadence}</span>*/}
              {/*<span>Scad. {dueLabel(item)}</span>*/}
            {/*</div>*/}

            <div className="recurring-mobile-meta">
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
