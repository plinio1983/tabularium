import Link from 'next/link';
import {requireWorkspace} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {euro} from '@/lib/money';
import {stripFlashRecord, stripFlashSearchParams} from '@/lib/flash';
import NewClientPanel from '@/components/NewClientPanel';
import ClientEditModalController from '@/components/ClientEditModalController';
import ClientFiltersDrawer from '@/components/ClientFiltersDrawer';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import MobileSortControl from '@/components/MobileSortControl';
import SortableTableController from '@/components/SortableTableController';
import BulkSelectionController from '@/components/BulkSelectionController';
import ClickableDesktopRows from '@/components/ClickableDesktopRows';
import SearchIcon from '@/components/SearchIcon';
import {incomeCreditSummary} from '@/lib/income-credits';
import {yearMonthInTimeZone} from '@/lib/company-time';

const input = (filters: Record<string, string | string[] | undefined>, key: string) => {
    const item = filters[key];
    return Array.isArray(item) ? item[0] ?? '' : item ?? '';
};
const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('it');
const mobileSortOptions = [
    {value: 'businessName_asc', label: 'Ragione sociale (A-Z)'}, {
        value: 'businessName_desc',
        label: 'Ragione sociale (Z-A)'
    },
    {value: 'openCount_desc', label: 'Incassi da accreditare alti'}, {
        value: 'openAmount_desc',
        label: 'Importo da accreditare alto'
    },
    {value: 'annualCount_desc', label: 'Incassi anno alti'}, {value: 'annualAmount_desc', label: 'Incassato anno alto'}
];

export default async function ClientsPage({searchParams}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspace('/clients');
    const rawFilters = (await searchParams) ?? {};
    const filters = stripFlashRecord(rawFilters);
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, item]) => Array.isArray(item) ? item.forEach(value => value && query.append(key, value)) : item && query.set(key, item));
    stripFlashSearchParams(query);
    const listHref = `/clients${query.size ? `?${query}` : ''}`;
    const returnTo = encodeURIComponent(listHref);
    const currentYear = yearMonthInTimeZone(current.company.timeZone).year;
    const [customers, salesChannels] = await Promise.all([
        prisma.customer.findMany({
            where: {workspaceId: current.workspace.id},
            include: {incomes: {where: {companyId: current.company.id}, include: {credits: true}}},
            orderBy: {businessName: 'asc'}
        }),
        prisma.incomeSalesChannel.findMany({where: {workspaceId: current.workspace.id}, orderBy: [{sortOrder: 'asc'}, {name: 'asc'}]})
    ]);
    const rows = customers.map(customer => {
        const open = customer.incomes.filter(income => !income.isCredited);
        const annual = customer.incomes.filter(income => income.billingYear === currentYear);
        return {
            customer,
            openCount: open.length,
            openAmount: open.reduce((sum, income) => sum + incomeCreditSummary(income).residual, 0),
            annualCount: annual.length,
            annualAmount: annual.reduce((sum, income) => sum + Number(income.amount), 0)
        };
    }).filter(({customer}) => {
        for (const key of ['businessName', 'alias', 'email', 'vatNumber', 'taxCodeSdi', 'pec', 'iban', 'swift'] as const) if (input(filters, key) && !normalize(customer[key]).includes(normalize(input(filters, key)))) return false;
        return true;
    });
    const mobileSort = input(filters, 'mobileSort') || 'businessName_asc';
    const sortedRows = [...rows].sort((a, b) => {
        if (mobileSort === 'businessName_desc') return b.customer.businessName.localeCompare(a.customer.businessName, 'it');
        if (mobileSort === 'openCount_desc') return b.openCount - a.openCount;
        if (mobileSort === 'openAmount_desc') return b.openAmount - a.openAmount;
        if (mobileSort === 'annualCount_desc') return b.annualCount - a.annualCount;
        if (mobileSort === 'annualAmount_desc') return b.annualAmount - a.annualAmount;
        return a.customer.businessName.localeCompare(b.customer.businessName, 'it');
    });
    const active = ['businessName', 'alias', 'email', 'vatNumber', 'taxCodeSdi', 'pec', 'iban', 'swift'].filter(key => input(filters, key));

    return <div className="grid">
        <ClientEditModalController salesChannels={salesChannels}/><ClickableDesktopRows/><BulkSelectionController/>
        <div className="toolbar-card toolbar-card-wrap">
            <div>
                <h2>Clienti</h2>
                <p className="muted">Anagrafica dei clienti usati nell’inserimento degli incassi.</p>
            </div>
            <div className="toolbar-actions">
                <button className="btn btn-sm btn-primary" type="button" data-client-new>＋ Nuovo cliente</button>
            </div>
        </div>
        <NewClientPanel initialOpen={input(filters, 'new') === '1'} salesChannels={salesChannels}/>
        <ActionFeedbackBanner searchParams={rawFilters} savedMessages={{
            created: 'Cliente creato.',
            updated: 'Cliente aggiornato.',
            deleted: 'Cliente eliminato.',
            bulk_deleted: 'Clienti eliminati.'
        }} errorMessages={{
            not_found: 'Cliente non trovato.',
            in_use: 'Il cliente è collegato a degli incassi.',
            system_protected: 'Il cliente predefinito non può essere eliminato.',
            invalid_sales_channel: 'Il canale di vendita selezionato non è valido.'
        }} defaultSavedMessage="Operazione completata." defaultErrorMessage="Impossibile completare l’operazione."/>
        <div className="card record-list-card">
            <div className="list-heading recurring-list-heading">
                <div><h2>Lista clienti</h2><p className="muted">Risultati mostrati: {rows.length}</p></div>
                <ClientFiltersDrawer filters={filters}/></div>
            <form className="entity-quick-search app-quick-search-form" action="/clients" method="get" role="search">
                <label className="app-form-field-label" htmlFor="clientQuickSearch">
                    <span className="app-form-field-icon" aria-hidden="true">⌕</span>
                    <span>Ricerca cliente</span>
                </label>
                <div className="entity-quick-search-field app-quick-search-field input-group">
                    <input id="clientQuickSearch" name="businessName" defaultValue={input(filters, 'businessName')} placeholder="Nome o ragione sociale" autoComplete="off"/>
                    <button className="btn btn-sm btn-main" type="submit" aria-label="Cerca cliente"><SearchIcon/>
                    </button>
                </div>
            </form>
            <MobileSortControl action="/clients" currentValue={mobileSort} options={mobileSortOptions} searchParams={filters}/>
            {active.length ? <div className="recurring-active-filters">
                <div><span className="recurring-active-filters-title">Filtri attivi</span>
                    <div className="recurring-active-filter-tags">{active.map(key =>
                        <span className="badge" key={key}><strong>{key}:</strong> {input(filters, key)}</span>)}</div>
                </div>
                <Link className="btn btn-xs btn-neutral recurring-active-filters-reset" href="/clients">× Reset</Link>
            </div> : null}

            <form id="clientBulkForm" action={`/api/clients/bulk?returnTo=${returnTo}`} method="post" className="bulk-actions-bar grouped-bulk-actions-bar party-bulk-actions-bar confirm-bulk-form" data-bulk-button-group="true">
                <label className="bulk-select-all-inline">
                    <input type="checkbox" className="bulk-select-all" data-bulk-target="clientBulkForm"
                           aria-label="Seleziona tutti i clienti visibili"/>
                </label>
                <div className="bulk-action-buttons btn-group">
                    <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form="clientBulkForm">
                        <summary className="bulk-action-trigger">
                            <span className="btn-icon hidden-mobile">⚙</span><span className="hidden-sm-up">Actions</span><span className="hidden-sm-down">Bulk actions</span>
                        </summary>
                        <div className="bulk-action-menu-panel">
                            <button className="btn btn-sm btn-default" type="submit" name="bulkAction" value="export_csv"
                                    formAction="/api/exports/clients" formMethod="post" data-confirm-label="Esporta CSV">
                                <span className="btn-icon">⇩</span><span className="hidden-sm-down">Esporta CSV</span>
                            </button>
                            <button className="btn btn-sm btn-default danger-menu-item bulk-menu-mobile-delete" type="submit" name="bulkAction" value="delete">
                                <span className="btn-icon">🗑</span><span className="hidden-sm-down">Rimuovi selezionati</span>
                            </button>
                        </div>
                    </details>
                    <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form="clientBulkForm" data-edit-trigger-attr="data-client-edit-id">
                        <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true"><span className="btn-icon">✎</span><span className="hidden-sm-down">Modifica</span></a>
                        <button type="submit" className="bulk-direct-link bulk-direct-danger hidden-xs-down" name="bulkAction" value="delete" data-bulk-delete disabled>
                            <span className="btn-icon icon-small">🗑</span>
                            <span className="hidden-sm-down">Elimina</span>
                        </button>
                    </div>
                </div>
                <div className="bulk-inner-container">
                    <button className="bulk-direct-link btn btn-md bulk-add-link btn-primary" type="button" data-bulk-new data-client-new data-floating-label="Cliente"><span className="btn-icon">+</span><span className="hidden-sm-down">Cliente</span>
                    </button>
                </div>
            </form>
            <SortableTableController/>
            <div className="party-mobile-list mobile-record-list" aria-label="Lista clienti mobile">{sortedRows.map(({
                                                                                                                         customer,
                                                                                                                         openCount,
                                                                                                                         openAmount,
                                                                                                                         annualCount,
                                                                                                                         annualAmount
                                                                                                                     }) =>
                <div className={openCount ? 'party-mobile-item mobile-record-item mobile-record-item-overdue' : 'party-mobile-item mobile-record-item'} key={customer.id}>
                    <div className="mobile-record-select">
                        <input form="clientBulkForm" type="checkbox" name="ids" value={customer.id} disabled={Boolean(customer.systemRole)}/>
                    </div>
                    <Link className="mobile-record-link party-mobile-link" href={`/clients/${customer.id}?returnTo=${returnTo}`}>
                        <div className="mobile-record-main">
                            <div className="mobile-record-title-row">
                                <div className="mobile-record-title-left">
                                    <strong>{customer.businessName}</strong>
                                    {/*{customer.systemRole ? <span className="badge">Sistema</span> : null}*/}
                                </div>
                                <div className="mobile-record-title-right">
                                    <span className={openAmount ? 'text-warning' : 'text-ok'}>{euro(openAmount)}</span>
                                </div>
                            </div>
                            <div className="mobile-record-subtitle">
                                <span className="party-mobile-row-grow">{customer.alias || 'Nessun referente'}</span><span className="party-mobile-row-grow text-right"><strong>{openCount}</strong> incassi da accreditare</span>
                            </div>
                            <div className="mobile-record-meta">
                                <span className="party-mobile-row"><strong className="badge color-badge tone-insurance">{euro(annualAmount)}</strong> incassati {currentYear}</span><span className="badge badge-color">{annualCount} incassi {currentYear}</span>
                            </div>
                        </div>
                    </Link></div>)}{!rows.length ?
                <div className="record-empty-state">Nessun cliente trovato.</div> : null}</div>
            <div className="table-scroll">
                <table className="suppliers-table compact-suppliers-table" data-sortable-table data-default-sort="business-name" data-default-sort-dir="asc">
                    <thead>
                    <tr>
                        <th className="cell-center">
                            <input type="checkbox" className="bulk-select-all" data-bulk-target="clientBulkForm"/></th>
                        <th data-sort-key="business-name">Ragione<br/>sociale</th>
                        <th data-sort-key="alias">Referente</th>
                        <th className="text-center" data-sort-key="open-count" data-sort-type="number">Incassi<br/>non accr.
                        </th>
                        <th className="" data-sort-key="open-amount" data-sort-type="number">Importo<br/>Non accr.
                        </th>
                        <th className="text-center" data-sort-key="annual-count" data-sort-type="number">Ordini<br/>anno
                        </th>
                        <th className="text-right" data-sort-key="annual-amount" data-sort-type="number">Incassato<br/>anno
                        </th>
                    </tr>
                    </thead>
                    <tbody>{rows.map(({customer, openCount, openAmount, annualCount, annualAmount}) =>
                        <tr className="clickable-desktop-row" data-row-href={`/clients/${customer.id}?returnTo=${returnTo}`} data-sort-row data-sort-business-name={customer.businessName} data-sort-alias={customer.alias ?? ''} data-sort-open-count={openCount} data-sort-open-amount={openAmount} data-sort-annual-count={annualCount} data-sort-annual-amount={annualAmount} tabIndex={0} key={customer.id}>
                            <td className="cell-center customer-mobile-select">
                                <input form="clientBulkForm" type="checkbox" name="ids" value={customer.id} disabled={Boolean(customer.systemRole)}/>
                            </td>
                            <td>
                                <strong>{customer.businessName}</strong>
                                {/*{customer.systemRole ? <span className="badge">Sistema</span> : null}*/}
                            </td>
                            <td>{customer.alias ?? '-'}</td>
                            <td className="text-center">
                                <strong className={openCount ? 'text-warning' : ''}>{openCount}</strong></td>
                            <td className="party-amount-cell">
                                <strong className={openAmount ? 'text-warning' : 'text-ok'}>{euro(openAmount)}</strong>
                            </td>
                            <td className="text-center">
                                <strong>{annualCount}</strong>
                            </td>
                            <td className="text-right party-amount-cell">
                                <strong className="badge color-badge tone-insurance">{euro(annualAmount)}</strong>
                            </td>
                        </tr>)}{!rows.length ? <tr>
                        <td colSpan={7}>Nessun cliente trovato.</td>
                    </tr> : null}</tbody>
                </table>
            </div>
        </div>
    </div>;
}
