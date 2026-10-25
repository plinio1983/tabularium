import {latestTrackingDocumentDate, trackingDocumentAge, trackingDocumentAgeClass} from '@/lib/tracking-document-age';
import Link from 'next/link';
import {badgeClass, yesNoStyles} from '@/lib/expense-ui';
import BulkSelectionController from '@/components/BulkSelectionController';
import ProductTrackingBulkController from '@/components/ProductTrackingBulkController';
import {prisma} from '@/lib/prisma';
import {requireWorkspace, hasWorkspaceRole, workspaceOperationalRoles} from '@/lib/auth';
import {
    parseTrackingDate,
    sixMonthsAgo,
    trackingFlags,
    trackingIndicators,
    trackingEntryDateWhere
} from '@/lib/product-tracking';
import LiveSearch from '@/components/LiveSearch';
import ProductTrackingEditor from '@/components/ProductTrackingEditor';
import ProductTrackingFilters from '@/components/ProductTrackingFilters';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import InfoHint from '@/components/InfoHint';
import SortableTableController from '@/components/SortableTableController';
import ProductTrackingStatus from '@/components/ProductTrackingStatus';
import ProductTrackingReset from '@/components/ProductTrackingReset';
import {calendarDateInput, dateInputInTimeZone} from '@/lib/company-time';
import {formatItalianCompactDate} from '@/lib/date-format';

const sortOptions = [
    {value: 'created_desc', label: 'Creazione recente'},
    {value: 'name_asc', label: 'Riferimento (A–Z)'},
    {value: 'name_desc', label: 'Riferimento (Z–A)'},
    {value: 'entry_desc', label: 'Ingresso recente'},
    {value: 'entry_asc', label: 'Ingresso meno recente'},
];
const dateLabel = (value: Date | null) => value ? formatItalianCompactDate(calendarDateInput(value)) : '—';
export default async function Page({searchParams}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspace('/product-trackings');
    const today = dateInputInTimeZone(current.company.timeZone);
    const raw = await searchParams;
    const allowed = ['q', 'name', 'batch', 'alias', 'from', 'to', 'invoice', 'tracking', 'indicator', 'missingEntry', 'mobileSort'];
    const filters = Object.fromEntries(allowed.flatMap(key => {
        const value = raw[key];
        return typeof value === 'string' && value ? [[key, value]] : [];
    }));
    const mobileSort = sortOptions.some(option => option.value === filters.mobileSort) ? filters.mobileSort : 'created_desc';
    let from: Date | null = null, to: Date | null = null, dateError = '';
    try {
        from = parseTrackingDate(filters.from);
        to = parseTrackingDate(filters.to);
        if (from && to && from > to) throw new Error('La data iniziale deve precedere la data finale.');
    } catch (e) {
        dateError = e instanceof Error ? e.message : 'Date non valide.';
    }
    const records = await prisma.productTracking.findMany({
        where: {
            workspaceId: current.workspace.id, companyId: current.company.id,
            ...(filters.q ? {
                OR: [...['name', 'batch', 'alias'].map(key => ({
                    [key]: {
                        contains: filters.q,
                        mode: 'insensitive' as const
                    }
                })), {supplier: {businessName: {contains: filters.q, mode: 'insensitive' as const}}}]
            } : {}),
            ...(filters.name ? {name: {contains: filters.name, mode: 'insensitive'}} : {}),
            ...(filters.batch ? {batch: {contains: filters.batch, mode: 'insensitive'}} : {}),
            ...(filters.alias ? {alias: {contains: filters.alias, mode: 'insensitive'}} : {}),
            ...trackingEntryDateWhere(from, to, filters.missingEntry === '1'),
        },
        include: {supplier: {select: {id: true, businessName: true}}, attachments: {select: {kind: true, invoiceDate: true, documentDate: true}}},
        orderBy: mobileSort.startsWith('name_') ? {name: mobileSort.endsWith('_asc') ? 'asc' : 'desc'} : mobileSort.startsWith('entry_') ? {
            entryDate: {
                sort: mobileSort.endsWith('_asc') ? 'asc' : 'desc',
                nulls: 'last'
            }
        } : {createdAt: 'desc'}
    });
    const cutoff = sixMonthsAgo(current.company.timeZone);
    const rows = dateError ? [] : records.filter(record => {
        const flags = trackingFlags(record, cutoff);
        if (filters.invoice === 'present' && flags.missingInvoice || filters.invoice === 'missing' && !flags.missingInvoice) return false;
        if (filters.tracking === 'present' && flags.missingTracking || filters.tracking === 'missing' && !flags.missingTracking) return false;
        const indicator = trackingIndicators.find(i => i.key === filters.indicator);
        return !indicator || flags[indicator.key];
    });
    const query = new URLSearchParams(filters);
    const listHref = `/product-trackings${query.size ? `?${query}` : ''}`;
    const canEdit = hasWorkspaceRole(current.membership.role, workspaceOperationalRoles);
    const labels: Record<string, string> = {
        q: 'Ricerca',
        name: 'Riferimento',
        batch: 'Lotto',
        alias: 'Nome',
        from: 'Dal',
        to: 'Al',
        invoice: 'Fattura',
        tracking: 'Tracciamento',
        indicator: 'Segnalazione',
        missingEntry: 'Ingresso mancante',
        mobileSort: 'Ordine'
    };
    return <div className="grid product-trackings-page">
        <div className="toolbar-card toolbar-card-wrap">
            <div><h2>Tracciamento prodotti</h2><p className="muted">Prodotti, lotti e documenti
                dell’azienda {current.company.name}.</p></div>
            <div className="toolbar-actions">{canEdit &&
                <ProductTrackingEditor returnTo={listHref} mobileHeaderAction/>}</div>
        </div>
        <ActionFeedbackBanner searchParams={raw} savedMessages={{
            created: 'Tracciatura creata.',
            updated: 'Tracciatura aggiornata.',
            deleted: 'Tracciatura eliminata.'
        }} errorMessages={{}}/>
        <div className="card product-tracking-summary-card">
            <section className="record-top-summary" aria-labelledby="tracking-summary-title">
                <div className="card-heading-row">
                    <div>
                        <div className="info-title-row"><h2 id="tracking-summary-title">Riepilogo tracciature</h2>
                            <InfoHint compactOnly title="Riepilogo tracciature">Dati relativi ai filtri correnti. Una
                                tracciatura può rientrare in più contatori.</InfoHint></div>
                        <p className="muted info-hint-desktop-text">Dati relativi ai filtri correnti. Una tracciatura
                            può rientrare in più contatori.</p></div>
                </div>
                <div className="record-top-summary-grid">{trackingIndicators.map(item => {
                    const count = rows.filter(r => trackingFlags(r, cutoff)[item.key]).length;
                    const params = new URLSearchParams(query);
                    params.set('indicator', item.key);
                    return <Link key={item.key} className={`record-top-summary-item ${count ? 'is-warning' : ''}`}
                                 href={`/product-trackings?${params}`}><span>{item.label}</span><strong>{count}</strong></Link>;
                })}</div>
            </section>
        </div>
        <div className="card record-list-card record-list-grid">
            <div className="list-heading recurring-list-heading">
                <div>
                    <div className="info-title-row"><h2>Lista tracciature</h2><InfoHint compactOnly
                                                                                        title="Lista tracciature">Ricerca
                        per riferimento, lotto e nome e verifica dei documenti mancanti.</InfoHint></div>
                    <p className="muted">Risultati mostrati: {rows.length}</p></div>
                <ProductTrackingFilters filters={filters}/></div>
            <LiveSearch name="q" label="Ricerca merce" placeholder="Riferimento, lotto, nome o fornitore"/>
            {Object.entries(filters).some(([key]) => key !== 'mobileSort') && <div className="recurring-active-filters">
                <div><span className="recurring-active-filters-title">Filtri attivi</span>
                    <div className="recurring-active-filter-tags">
                        {Object.entries(filters).filter(([key]) => key !== 'mobileSort').map(([key, value]) => <span
                            className="badge"
                            key={key}><strong>{labels[key]}:</strong> {trackingIndicators.find(i => i.key === value)?.label ?? ({
                            present: 'Presente',
                            missing: 'Mancante',
                            '1': 'Sì'
                        }[value] ?? value)}</span>)}
                    </div>
                </div>
                <ProductTrackingReset/>
            </div>}
            {dateError && <p role="alert" className="inline-warning">{dateError}</p>}
            <BulkSelectionController/>
            <ProductTrackingBulkController/>
            <form id="trackingBulkForm" className="bulk-actions-bar grouped-bulk-actions-bar party-bulk-actions-bar"
                  data-bulk-button-group="true" data-bulk-subject="tracciature" data-in-place-submit="true">
                <label className="bulk-select-all-inline">
                    <input type="checkbox" className="bulk-select-all" data-bulk-target="trackingBulkForm"
                           aria-label="Seleziona tutte le tracciature visibili"/>
                </label>
                <div className="bulk-action-buttons btn-group">
                    <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form="trackingBulkForm"
                         data-edit-trigger-attr="data-tracking-edit-id" data-return-to={encodeURIComponent(listHref)}>
                        {canEdit && <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true">
                            <span className="btn-icon">✎</span><span className="hidden-sm-down">Modifica</span>
                        </a>}
                        {canEdit && <button type="submit" className="bulk-direct-link is-disabled" name="bulkAction" value="delete"
                            data-bulk-shortcut data-floating-label="Elimina" data-floating-icon="🗑" disabled>
                            <span className="btn-icon">🗑</span><span className="hidden-sm-down">Elimina</span>
                        </button>}
                        <button type="submit" className="bulk-direct-link is-disabled" name="bulkAction" value="documents"
                            data-bulk-shortcut data-floating-label="Scarica documenti" aria-label="Scarica documenti" title="Scarica documenti" disabled>
                            <span className="btn-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z"/><path d="M12 10v7m-3-3 3 3 3-3"/></svg></span><span className="hidden-sm-down">Scarica documenti</span>
                        </button>
                        <button type="submit" className="bulk-direct-link is-disabled" name="bulkAction" value="invoices"
                            data-bulk-shortcut data-floating-label="Scarica fatture" aria-label="Scarica fatture" title="Scarica fatture" disabled>
                            <span className="btn-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6m-6 3a3 3 0 0 0-2-1c-2 0-3 2-3 4s1 4 3 4a3 3 0 0 0 2-1m-7-4h6m-6 2h5"/></svg></span><span className="hidden-sm-down">Scarica fatture</span>
                        </button>
                    </div>
                </div>
            </form>
            <SortableTableController/>
            <div className="table-scroll">
                <table className="table compact-table" data-sortable-table
                       data-default-sort={mobileSort.startsWith('name_') ? 'name' : mobileSort.startsWith('entry_') ? 'entry' : 'created'}
                       data-default-sort-dir={mobileSort.endsWith('_asc') ? 'asc' : 'desc'}>
                    <thead>
                    <tr>
                        <th className="cell-center"><input type="checkbox" className="bulk-select-all" data-bulk-target="trackingBulkForm"
                            aria-label="Seleziona tutte le tracciature"/></th>
                        <th data-sort-key="name">Riferimento</th>
                        <th data-sort-key="batch">Lotto</th>
                        <th data-sort-key="batch-year" data-sort-type="number">Anno</th>
                        <th data-sort-key="alias">Nome</th>
                        <th data-sort-key="supplier">Fornitore</th>
                        <th data-sort-key="in-stock" data-sort-type="number">In stock</th>
                        <th data-sort-key="entry" data-sort-type="date">Data ingresso</th>
                        <th data-sort-key="invoices" data-sort-type="number">Fatture</th>
                        <th data-sort-key="tracking" data-sort-type="number">Tracciamento</th>
                    </tr>
                    </thead>
                    <tbody>{rows.map(record => {
                        const href = `/product-trackings/${record.id}?returnTo=${encodeURIComponent(listHref)}`;
                        const invoices = record.attachments.filter(a => a.kind === 'INVOICE').length;
                        const tracking = record.attachments.filter(a => a.kind === 'TRACKING').length;
                        return <tr key={record.id} className="clickable-desktop-row" data-row-href={href} tabIndex={0}
                                   data-sort-row data-sort-name={record.name} data-sort-batch={record.batch}
                                   data-sort-alias={record.alias ?? ''} data-sort-supplier={record.supplier?.businessName ?? ''}
                                   data-sort-entry={record.entryDate?.getTime() ?? ''}
                                   data-sort-created={record.createdAt.getTime()} data-sort-invoices={invoices}
                                   data-sort-batch-year={record.batchYear} data-sort-in-stock={record.inStock ? 1 : 0}
                                   data-sort-tracking={tracking}>
                            <td className="cell-center"><input form="trackingBulkForm" type="checkbox" name="ids" value={record.id}
                                aria-label={`Seleziona tracciatura ${record.name}`}/></td>
                            <td><Link href={href}><strong>{record.name}</strong></Link></td>
                            <td>{record.batch}</td>
                            <td>{record.batchYear}</td>
                            <td>{record.alias || '—'}</td>
                            <td>{record.supplier?.businessName || '—'}</td>
                            <td><StockIndicator inStock={record.inStock}/></td>
                            <td>{dateLabel(record.entryDate)}</td>
                            <td><DocumentCount count={invoices} kind="INVOICE" attachments={record.attachments}
                                               today={today}/></td>
                            <td><DocumentCount count={tracking} kind="TRACKING" attachments={record.attachments}
                                               today={today}/></td>
                        </tr>;
                    })}</tbody>
                </table>
            </div>
            <div className="party-mobile-list mobile-record-list"
                 aria-label="Lista tracciature mobile">{rows.map(record => <article
                className="party-mobile-item mobile-record-item product-tracking-mobile-item" key={record.id}>
                <div className="mobile-record-select"><input form="trackingBulkForm" type="checkbox" name="ids" value={record.id}
                    aria-label={`Seleziona tracciatura ${record.name}`}/></div>
                <Link className="mobile-record-link party-mobile-link"
                      href={`/product-trackings/${record.id}?returnTo=${encodeURIComponent(listHref)}`}>
                    <div className="mobile-record-main">
                        <div className="mobile-record-title-row">
                            <div className="mobile-record-title-left"><strong>{record.name}</strong></div>
                            <div className="mobile-record-title-right"><span
                                className="badge">{record.batch} · {record.batchYear}</span></div>
                        </div>
                        <div className="mobile-record-subtitle"><span
                            className="party-mobile-row-grow">{record.alias || 'Nome non indicato'}</span><span
                            className="text-right">Ingresso: <strong>{dateLabel(record.entryDate)}</strong></span></div>
                        <div className="mobile-record-meta">
                            <span className="party-mobile-row">
                                <DocumentCount count={record.attachments.filter(a => a.kind === 'TRACKING').length}
                                               kind="TRACKING" attachments={record.attachments} today={today} mobile/>
                            </span>
                            <span className="party-mobile-row-right">
                                <DocumentCount count={record.attachments.filter(a => a.kind === 'INVOICE').length}
                                               kind="INVOICE" attachments={record.attachments} today={today} mobile/>
                            </span>
                        </div>
                        <div className="product-tracking-stock-supplier">
                            <StockIndicatorMobile inStock={record.inStock}/>
                            <span className="product-tracking-supplier" title={record.supplier?.businessName}>Fornitore: {record.supplier?.businessName || '—'}</span>
                        </div>
                        <ProductTrackingStatus record={record} cutoff={cutoff} showMissing={false} showOldDocument={false}/>
                    </div>
                </Link>
            </article>)}</div>
            {!rows.length && <p className="muted empty-state">Nessuna tracciatura trovata.</p>}
        </div>
    </div>;
}

function DocumentCount({count, kind, attachments, today, mobile = false}: {
    attachments: Array<{ kind: string; invoiceDate: Date | null; documentDate: Date | null }>;
    today: string;
    count: number;
    kind: 'INVOICE' | 'TRACKING';
    mobile?: boolean
}) {
    if (!count) return <span className="badge color-badge tone-warning">
        <span className="hidden-sm-down">
            {kind === 'INVOICE' ? 'Fattura mancante' : 'Tracciamento mancante'}
        </span>
        <span className="hidden-sm-up">
            {kind === 'INVOICE' ? 'Fatt. mancante' : 'Tracc. mancante'}
        </span>
    </span>;
    const latest = latestTrackingDocumentDate(attachments.filter(item => item.kind === kind).map(item => kind === 'INVOICE' ? item.invoiceDate : item.documentDate));
    const age = trackingDocumentAge(latest, today);
    return <span className="tracking-document-count">
        <span className="badge">{count}</span>
        <span className="hidden-sm-up">{mobile ? kind === 'INVOICE' ? ' Fatt.' : ' Tracc.' : null}</span>
        <span className="hidden-sm-down">{mobile ? kind === 'INVOICE' ? ' Fatture' : ' Tracciamento' : null}</span>
        <small className={trackingDocumentAgeClass(age)}
               title={latest ? `Documento più recente: ${formatItalianCompactDate(latest)}` : 'Nessuna data documento disponibile'}> {age.label}</small>
    </span>;
}

function StockIndicator({inStock}: {inStock: boolean}) {
    return <span className={badgeClass(inStock ? yesNoStyles.yes.className : 'tone-muted')}>{inStock ? 'In stock' : 'Out of stock'}</span>;
}
function StockIndicatorMobile({inStock}: {inStock: boolean}) {
    return <span className={badgeClass(inStock ? yesNoStyles.yes.className : 'tone-muted')}>{inStock ? '✓ Stock' : '× Stock'}</span>;
}
