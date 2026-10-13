import Link from 'next/link';
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
import {calendarDateInput} from '@/lib/company-time';
import {formatItalianCompactDate} from '@/lib/date-format';

const sortOptions = [
    {value: 'created_desc', label: 'Creazione recente'},
    {value: 'name_asc', label: 'Nome (A–Z)'},
    {value: 'name_desc', label: 'Nome (Z–A)'},
    {value: 'entry_desc', label: 'Ingresso recente'},
    {value: 'entry_asc', label: 'Ingresso meno recente'},
];
const dateLabel = (value: Date | null) => value ? formatItalianCompactDate(calendarDateInput(value)) : '—';
export default async function Page({searchParams}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspace('/product-trackings');
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
                OR: ['name', 'batch', 'alias'].map(key => ({
                    [key]: {
                        contains: filters.q,
                        mode: 'insensitive' as const
                    }
                }))
            } : {}),
            ...(filters.name ? {name: {contains: filters.name, mode: 'insensitive'}} : {}),
            ...(filters.batch ? {batch: {contains: filters.batch, mode: 'insensitive'}} : {}),
            ...(filters.alias ? {alias: {contains: filters.alias, mode: 'insensitive'}} : {}),
            ...trackingEntryDateWhere(from, to, filters.missingEntry === '1'),
        },
        include: {attachments: {select: {kind: true, invoiceDate: true}}},
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
        name: 'Nome',
        batch: 'Lotto',
        alias: 'Alias',
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
            <div className="toolbar-actions">{canEdit && <ProductTrackingEditor returnTo={listHref} mobileHeaderAction/>}</div>
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
                        per nome, lotto e alias e verifica dei documenti mancanti.</InfoHint></div>
                    <p className="muted">Risultati mostrati: {rows.length}</p></div>
                <ProductTrackingFilters filters={filters}/></div>
            <LiveSearch name="q" label="Ricerca merce" placeholder="Nome, lotto o alias"/>
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
            <SortableTableController/>
            <div className="table-scroll">
                <table className="table compact-table" data-sortable-table
                       data-default-sort={mobileSort.startsWith('name_') ? 'name' : mobileSort.startsWith('entry_') ? 'entry' : 'created'}
                       data-default-sort-dir={mobileSort.endsWith('_asc') ? 'asc' : 'desc'}>
                    <thead>
                    <tr>
                        <th data-sort-key="name">Nome</th>
                        <th data-sort-key="batch">Lotto</th>
                        <th data-sort-key="alias">Alias</th>
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
                                   data-sort-alias={record.alias ?? ''}
                                   data-sort-entry={record.entryDate?.getTime() ?? ''}
                                   data-sort-created={record.createdAt.getTime()} data-sort-invoices={invoices}
                                   data-sort-tracking={tracking}>
                            <td><Link href={href}><strong>{record.name}</strong></Link></td>
                            <td>{record.batch}</td>
                            <td>{record.alias || '—'}</td>
                            <td>{dateLabel(record.entryDate)}</td>
                            <td><DocumentCount count={invoices} kind="INVOICE"/></td>
                            <td><DocumentCount count={tracking} kind="TRACKING"/></td>
                        </tr>;
                    })}</tbody>
                </table>
            </div>
            <div className="party-mobile-list mobile-record-list"
                 aria-label="Lista tracciature mobile">{rows.map(record => <article
                className="party-mobile-item mobile-record-item product-tracking-mobile-item" key={record.id}>
                <Link className="mobile-record-link party-mobile-link"
                      href={`/product-trackings/${record.id}?returnTo=${encodeURIComponent(listHref)}`}>
                    <div className="mobile-record-main">
                        <div className="mobile-record-title-row">
                            <div className="mobile-record-title-left"><strong>{record.name}</strong></div>
                            <div className="mobile-record-title-right"><span
                                className="badge">Lotto {record.batch}</span></div>
                        </div>
                        <div className="mobile-record-subtitle"><span
                            className="party-mobile-row-grow">{record.alias || 'Nessun alias'}</span><span
                            className="text-right">Ingresso: <strong>{dateLabel(record.entryDate)}</strong></span></div>
                        <div className="mobile-record-meta">
                            <span className="party-mobile-row">
                                <DocumentCount count={record.attachments.filter(a => a.kind === 'TRACKING').length} kind="TRACKING" mobile/>
                            </span>
                            <span className="party-mobile-row-right">
                                <DocumentCount count={record.attachments.filter(a => a.kind === 'INVOICE').length} kind="INVOICE" mobile/>
                            </span>
                        </div>
                        <ProductTrackingStatus record={record} cutoff={cutoff} showMissing={false}/>
                    </div>
                </Link>
            </article>)}</div>
            {!rows.length && <p className="muted empty-state">Nessuna tracciatura trovata.</p>}
        </div>
    </div>;
}

function DocumentCount({count, kind, mobile = false}: {
    count: number;
    kind: 'INVOICE' | 'TRACKING';
    mobile?: boolean
}) {
    if (!count) return <span
        className="badge color-badge tone-warning">{kind === 'INVOICE' ? 'Fattura mancante' : 'Tracciamento mancante'}</span>;
    return <><span
        className="badge">{count}</span>{mobile ? kind === 'INVOICE' ? ' Fatture' : ' Tracciamento' : null}</>;
}
