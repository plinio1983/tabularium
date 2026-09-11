import {filteredListHref} from '@/lib/live-search';
import LiveSearch from '@/components/LiveSearch';
import Link from 'next/link';
import BulkSelectionController from '@/components/BulkSelectionController';
import RecurringIncomeFiltersDrawer from '@/components/RecurringIncomeFiltersDrawer';
import MobileSortControl from '@/components/MobileSortControl';
import {euro} from '@/lib/money';
import {badgeClass} from '@/lib/expense-ui';
import {compareDate, compareNumber, compareText} from '@/lib/mobile-sort';

const cadenceLabels: Record<string, string> = {
    MONTHLY: 'Ogni mese', EVERY_2_MONTHS: 'Ogni 2 mesi', EVERY_3_MONTHS: 'Ogni 3 mesi',
    EVERY_6_MONTHS: 'Ogni 6 mesi', YEARLY: 'Annuale', EVERY_2_YEARS: 'Ogni 2 anni'
};
const billingLabels: Record<string, string> = {
    SAME_MONTH: 'Stesso mese', NEXT_MONTH: 'Mese successivo', CUSTOM_MONTH: 'Mese impostato'
};
const months = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const cadenceStyles: Record<string, { icon: string; className: string }> = {
    MONTHLY: {icon: '↻', className: 'tone-paid'},
    EVERY_2_MONTHS: {icon: '2M', className: 'tone-web'},
    EVERY_3_MONTHS: {icon: '3M', className: 'tone-installment'},
    EVERY_6_MONTHS: {icon: '6M', className: 'tone-services'},
    YEARLY: {icon: '12M', className: 'tone-taxes'},
    EVERY_2_YEARS: {icon: '24M', className: 'tone-neutral'}
};
const billingStyles: Record<string, { icon: string; className: string }> = {
    SAME_MONTH: {icon: 'M', className: 'tone-vat-22'}, NEXT_MONTH: {icon: '+1', className: 'tone-vat-10'},
    CUSTOM_MONTH: {icon: 'CAL', className: 'tone-vat-4'}
};
const sortOptions = [
    {value: 'active_desc', label: 'Attive prima'}, {value: 'startDate_asc', label: 'Inizio meno recente'},
    {value: 'startDate_desc', label: 'Inizio recente'}, {value: 'customer_asc', label: 'Cliente (A-Z)'},
    {value: 'customer_desc', label: 'Cliente (Z-A)'}, {value: 'description_asc', label: 'Descrizione (A-Z)'},
    {value: 'description_desc', label: 'Descrizione (Z-A)'}, {value: 'amount_desc', label: 'Importo alto'},
    {value: 'amount_asc', label: 'Importo basso'}, {value: 'cadence_asc', label: 'Cadenza (A-Z)'}
];

function dateLabel(value?: Date | string | null) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

function inputDefault(filters: Record<string, string | string[] | undefined>, key: string) {
    const value = filters[key];
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function creditLabel(item: any) {
    if (item.creditMonth) return `${item.creditDay ?? '-'} ${months[item.creditMonth] ?? ''}`;
    if (item.creditDay) return `Giorno ${item.creditDay}`;
    return '-';
}

export default function RecurringIncomesList({items, filters = {}, methods = [], banks = []}: {
    items: any[];
    filters?: Record<string, string | string[] | undefined>;
    methods?: Array<{id: number; name: string}>;
    banks?: Array<{id: number; name: string}>;
}) {
    const returnTo = encodeURIComponent(filteredListHref('/recurring-incomes', filters));
    const mobileSort = inputDefault(filters, 'mobileSort') || sortOptions[0].value;
  const mobileSortedItems = [...items].sort((a, b) => {
        switch (mobileSort) {
            case 'startDate_asc':
                return compareDate(a.startDate, b.startDate, 'asc');
            case 'startDate_desc':
                return compareDate(a.startDate, b.startDate, 'desc');
            case 'customer_asc':
                return compareText(a.customer?.businessName, b.customer?.businessName, 'asc');
            case 'customer_desc':
                return compareText(a.customer?.businessName, b.customer?.businessName, 'desc');
            case 'description_asc':
                return compareText(a.description, b.description, 'asc');
            case 'description_desc':
                return compareText(a.description, b.description, 'desc');
            case 'amount_desc':
                return compareNumber(a.amount, b.amount, 'desc');
            case 'amount_asc':
                return compareNumber(a.amount, b.amount, 'asc');
            case 'cadence_asc':
                return compareText(a.cadence, b.cadence, 'asc');
            default:
                return compareNumber(Number(a.isActive), Number(b.isActive), 'desc') || compareDate(a.startDate, b.startDate, 'asc');
        }
  });
  const activeFilters = [
    inputDefault(filters, 'search') ? `Ricerca: ${inputDefault(filters, 'search')}` : '',
    inputDefault(filters, 'customer') ? `Cliente: ${inputDefault(filters, 'customer')}` : '',
    inputDefault(filters, 'description') ? `Descrizione: ${inputDefault(filters, 'description')}` : '',
    inputDefault(filters, 'isActive') ? `Stato: ${inputDefault(filters, 'isActive') === 'true' ? 'Attive' : 'Disattivate'}` : '',
    inputDefault(filters, 'cadence') ? `Cadenza: ${cadenceLabels[inputDefault(filters, 'cadence')] ?? inputDefault(filters, 'cadence')}` : '',
    inputDefault(filters, 'isAutomaticCredit') ? `Accredito: ${inputDefault(filters, 'isAutomaticCredit') === 'true' ? 'Automatico' : 'Manuale'}` : ''
  ].filter(Boolean);

    const formId = 'recurringIncomeBulkForm';
    return <section className="card record-list-card recurring-expenses-card">
        <BulkSelectionController/>
        <div className="list-heading recurring-list-heading mobile-page-title recurring-income-mobile-page-title">
            <div><h2>Entrate ricorrenti</h2>
                <p className="muted">Gestisci le regole che generano periodicamente gli incassi.</p></div>
        </div>
    <LiveSearch name="search" label="Ricerca incasso ricorrente" placeholder="Cliente o descrizione"/>
    {activeFilters.length ? <div className="recurring-active-filters"><div><span className="recurring-active-filters-title">Filtri attivi</span><div className="recurring-active-filter-tags">{activeFilters.map(filter => <span className="badge" key={filter}>{filter}</span>)}</div></div><Link className="btn btn-sm btn-default recurring-active-filters-reset" href="/recurring-incomes"><span className="btn-icon">↺</span> Reset</Link></div> : null}
        <p className="muted">Risultati mostrati: {items.length}</p>
        <MobileSortControl action="/recurring-incomes" currentValue={mobileSort} options={sortOptions} searchParams={filters}/>
        <form id={formId} action={`/api/recurring-incomes/bulk?returnTo=${returnTo}`} method="post" className="bulk-actions-bar grouped-bulk-actions-bar recurring-bulk-actions-bar confirm-bulk-form" data-bulk-button-group="true">
            <label className="bulk-select-all-inline"><input type="checkbox" className="bulk-select-all" data-bulk-target={formId} aria-label="Seleziona tutte le entrate ricorrenti visibili"/></label>
            <div className="bulk-action-buttons btn-group">
                <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form={formId}>
                    <summary className="bulk-action-trigger">
                        <span className="btn-icon hidden-mobile">⚙</span><span className="hidden-sm-up">Azioni</span><span className="hidden-sm-down">Bulk actions</span>
                    </summary>
                    <div className="bulk-action-menu-panel">
                        <button className="btn btn-sm btn-default danger-menu-item bulk-menu-mobile-delete" type="submit" name="bulkAction" value="delete" data-confirm-label="Elimina">
                            <span className="btn-icon">🗑</span><span className="hidden-sm-down">Elimina selezionate</span>
                        </button>
                    </div>
                </details>
                <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form={formId} data-edit-base="/recurring-incomes/" data-edit-suffix="/edit" data-edit-trigger-attr="data-recurring-income-edit-id" data-return-to={returnTo}>
                    <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true"><span className="btn-icon">✎</span><span className="hidden-sm-down">Modifica</span></a>
                    <button type="submit" className="bulk-direct-link bulk-direct-danger hidden-xs-down" name="bulkAction" value="delete" data-bulk-delete data-confirm-label="Elimina" disabled>
                        <span className="btn-icon icon-small">🗑</span><span className="hidden-sm-down">Elimina</span>
                    </button>
                </div>
            </div>
            <div className="bulk-inner-container">
                <button className="bulk-direct-link bulk-add-link btn btn-md btn-primary" type="button" data-bulk-new data-income-new data-income-new-type="recurring" data-floating-label="Incasso ricorrente">
                    <span className="btn-icon">＋</span><span className="hidden-sm-down">Incasso ricorrente</span>
                </button>
                <RecurringIncomeFiltersDrawer filters={filters}/>
            </div>
        </form>
        {items.length ? <>
            <div className="table-scroll recurring-expenses-desktop-table-scroll">
                <table className="expenses-table compact-recurring-expenses-table">
                    <thead>
                    <tr>
                        <th className="cell-center">
                            <input type="checkbox" className="bulk-select-all" data-bulk-target={formId} aria-label="Seleziona tutte le entrate ricorrenti"/>
                        </th>
                        <th>Stato</th>
                        <th>Cliente</th>
                        <th>Descrizione</th>
                        <th>Canale</th>
                        <th className="cell-right">Importo</th>
                        <th>Cadenza</th>
                        <th>Accredito</th>
                        <th>Periodo fatt.</th>
                        <th>Inizio</th>
                    </tr>
                    </thead>
                    <tbody>{items.map(item => {
                        const status = item.archivedAt ? {
                            icon: '⌛',
                            label: 'Archiviata',
                            tone: 'tone-neutral'
                        } : item.isActive ? {icon: '✓', label: 'Attiva', tone: 'tone-yes'} : {
                            icon: '×',
                            label: 'Off',
                            tone: 'tone-critical'
                        };
                        const cadence = cadenceStyles[item.cadence] ?? {icon: '↻', className: 'tone-neutral'};
                        const billingStyle = billingStyles[item.billingPeriodMode] ?? {
                            icon: 'CAL',
                            className: 'tone-neutral'
                        };
                        const billing = `${billingLabels[item.billingPeriodMode] ?? item.billingPeriodMode}${item.billingMonth ? ` · ${months[item.billingMonth]}` : ''}`;
                        return <tr key={item.id} className="clickable-desktop-row" data-recurring-income-edit-id={item.id} aria-haspopup="dialog" aria-label={`Modifica entrata ricorrente ${item.id}`} tabIndex={0}>
                            <td className="cell-center">
                                <input form={formId} type="checkbox" name="ids" value={item.id} aria-label={`Seleziona entrata ricorrente ${item.id}`}/>
                            </td>
                            <td><span className={badgeClass(status.tone)}>{status.icon} {status.label}</span></td>
                            <td className="recurring-supplier-cell" title={item.customer?.businessName ?? ''}>
                                <span className="recurring-table-supplier-icon">↻</span>{item.customer?.businessName ?? 'Nessun cliente'}
                            </td>
                            <td className="recurring-description-cell" title={item.description}>{item.description}</td>
                            <td>
                                <span className={badgeClass('tone-web')}>{item.salesChannel?.icon ?? '◎'} {item.salesChannel?.name ?? '-'}</span>
                            </td>
                            <td className="cell-right nowrap-cell">
                                <strong className="recurring-table-amount">{euro(item.amount.toString())}</strong></td>
                            <td>
                                <span className={badgeClass(cadence.className)}>{cadence.icon} {cadenceLabels[item.cadence] ?? item.cadence}</span>
                            </td>
                            <td className="nowrap-cell">
                                <span className={badgeClass('tone-waiting')}>📅 {creditLabel(item)}</span></td>
                            <td className="nowrap-cell">
                                <span className={badgeClass(billingStyle.className)}>{billingStyle.icon} {billing}</span>
                            </td>
                            <td className="nowrap-cell">{dateLabel(item.startDate)}</td>
                        </tr>;
                    })}</tbody>
                </table>
            </div>
            <div className="recurring-expenses-mobile-list" aria-label="Lista entrate ricorrenti">
                {mobileSortedItems.map(item => {
                    const billing = `${billingLabels[item.billingPeriodMode] ?? item.billingPeriodMode}${item.billingMonth ? ` · ${months[item.billingMonth]}` : ''}`;
                    const credit = item.isAutomaticCredit ? `${item.paymentMethod?.icon ?? '•'} ${item.paymentMethod?.name ?? 'Automatico'}` : 'Manuale';
                    return <div className="recurring-mobile-item-shell" key={item.id}>
                        <div className="recurring-mobile-select">
                            <input form={formId} type="checkbox" name="ids" value={item.id} aria-label={`Seleziona entrata ricorrente ${item.id}`}/>
                        </div>
                        <Link data-recurring-income-edit-id={item.id} aria-haspopup="dialog" className="recurring-income-mobile-item-shell recurring-mobile-item-link" href={`/recurring-incomes/${item.id}/edit?returnTo=${returnTo}`}>
                            <article className={item.isActive ? 'recurring-mobile-item recurring-mobile-item-active' : 'recurring-mobile-item recurring-mobile-item-disabled'}>
                                <div className="recurring-mobile-top">
                                    <div className="recurring-mobile-main-title">
                                        <span className={item.isActive ? 'recurring-mobile-status is-active' : 'recurring-mobile-status'}>{item.archivedAt ? 'ARCHIVIATA' : item.isActive ? 'ON' : 'OFF'}</span><span className="badge tone-insurance">{cadenceLabels[item.cadence] ?? item.cadence}</span><span className="badge">{creditLabel(item)}</span>
                                    </div>
                                    <strong className="recurring-mobile-amount">{euro(item.amount.toString())}</strong>
                                </div>
                                <div className="recurring-mobile-top">
                                    <strong>{item.customer?.businessName ?? 'Nessun cliente'}</strong>
                                    <div className="recurring-mobile-right"><strong>{credit}</strong></div>
                                </div>
                                <div className="recurring-mobile-middle">
                                    <div className="recurring-mobile-description">{item.description || 'Entrata ricorrente senza descrizione'}</div>
                                    <div>
                                        <span className="badge">{item.salesChannel?.icon ?? '◎'} {item.salesChannel?.name ?? 'Senza canale'}</span>
                                    </div>
                                </div>
                                <div className="recurring-mobile-meta">
                                    <div><span>Periodo fatt.</span><strong>{billing}</strong></div>
                                    <div className="recurring-mobile-meta-right">
                                        <span>{item.endDate ? 'Periodo' : 'Inizio'}</span><strong>{dateLabel(item.startDate)}{item.endDate ? ` – ${dateLabel(item.endDate)}` : ''}</strong>
                                    </div>
                                </div>
                            </article>
                        </Link></div>;
                })}
            </div>
        </> : <p className="muted">Nessuna entrata ricorrente configurata.</p>}
    </section>;
}
