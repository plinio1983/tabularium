import Link from 'next/link';
import {prisma} from '@/lib/prisma';
import {requireWorkspace} from '@/lib/auth';
import {dateInputInTimeZone} from '@/lib/company-time';
import {formatItalianCompactDate} from '@/lib/date-format';
import {
    ledgerFilters,
    type LedgerKind,
    ledgerPageSize,
    type LedgerParams,
    movementTypeLabels
} from '@/lib/movement-ledger';
import {filteredListHref} from '@/lib/live-search';
import {euro} from '@/lib/money';
import LiveSearch from './LiveSearch';
import SortableColumnHeader from './SortableColumnHeader';
import MovementLedgerFilters from './MovementLedgerFilters';

import {type Group, loadMovementLedger} from '@/lib/movement-ledger-data';

function Breakdown({title, rows, total}: { title: string; rows: Group[]; total: number }) {
    return <section className="card ledger-breakdown"><h3>{title}</h3>
        {rows.length ? <table>
            <colgroup>
                <col style={{width: '34%'}}/>
                <col style={{width: '12%'}}/>
                <col style={{width: '34%'}}/>
                <col style={{width: '20%'}}/>
            </colgroup>
            <thead>
            <tr>
                <th scope="col">Nome</th>
                <th scope="col"><abbr title="Numero di movimenti">N.</abbr></th>
                <th scope="col">Importo</th>
                <th scope="col">Quota</th>
            </tr>
            </thead>
            <tbody>{rows.map(row => {
                const share = total ? Number(row.total) / total * 100 : 0;
                return <tr key={row.id ?? 'none'}>
                    <th scope="row">
                        <span>{row.name}</span><span className="ledger-bar" aria-hidden="true"><span style={{width: `${Math.max(0, Math.min(100, share))}%`}}/></span>
                    </th>
                    <td>{row.count}</td>
                    <td>{euro(Number(row.total))}</td>
                    <td>{share.toLocaleString('it-IT', {maximumFractionDigits: 1})}%</td>
                </tr>;
            })}</tbody>
        </table> : <p className="muted">Nessun movimento per i filtri selezionati.</p>}
    </section>;
}

export default async function MovementLedgerPage({kind, searchParams}: {
    kind: LedgerKind;
    searchParams?: Promise<LedgerParams>
}) {
    const isPayment = kind === 'payments';
    const path = isPayment ? '/expenses/payments' : '/incomes/credits';
    const documentPath = isPayment ? '/expenses' : '/incomes';
    const title = isPayment ? 'Pagamenti' : 'Accrediti';
    const current = await requireWorkspace(path);
    const params = await searchParams ?? {};
    const filters = ledgerFilters(params, dateInputInTimeZone(current.company.timeZone));
    const {
        summary,
        total,
        groups,
        options,
        channels,
        rows,
        page,
        pages
    } = await loadMovementLedger(prisma, kind, current.workspace.id, current.company.id, current.company.timeZone, filters);
    const returnTo = filteredListHref(path, {...params, page: String(page)});
    const pageHref = (next: number) => filteredListHref(path, {...params, page: String(next)});
    const sortHeader = (column: typeof filters.sort, label: string) => <SortableColumnHeader key={column} label={label}
                                                                                             direction={filters.sort === column ? filters.direction : undefined}
                                                                                             href={filteredListHref(path, {
                                                                                                 ...params,
                                                                                                 sort: column,
                                                                                                 direction: filters.sort === column && filters.direction === 'asc' ? 'desc' : 'asc',
                                                                                                 page: '1'
                                                                                             })}/>;
    const namedOptions = (dimension: string) => options.filter(item => item.dimension === dimension).map(item => ({
        id: Number(item.id),
        name: item.name
    })).sort((a, b) => a.name.localeCompare(b.name, 'it'));
    const types = options.filter(item => item.dimension === 'type').map(item => ({
        id: item.id,
        name: movementTypeLabels[item.id] ?? item.name
    }));
    const breakdown = (dimension: string) => groups.filter(row => row.dimension === dimension).sort((a, b) => Number(b.total) - Number(a.total));
    const dateLabel = (date: Date | null) => date ? formatItalianCompactDate(dateInputInTimeZone(current.company.timeZone, date)) : 'Senza data';
    const interval = filters.dateMode === 'all' ? 'Tutte le date' : filters.dateMode === 'undated' ? 'Movimenti senza data' : `${filters.period.from.split('-').reverse().join('/')} – ${filters.period.to.split('-').reverse().join('/')}`;
    const activeFilters = [
        {label: 'Periodo', value: interval},
        {label: 'Ricerca', value: filters.search},
        {
            label: 'Metodo',
            value: filters.methodId ? namedOptions('method').find(item => item.id === filters.methodId)?.name ?? String(filters.methodId) : ''
        },
        {
            label: 'Banca / conto',
            value: filters.noBank ? 'Non specificato' : filters.bankId ? namedOptions('bank').find(item => item.id === filters.bankId)?.name ?? String(filters.bankId) : ''
        },
        {label: 'Tipo', value: filters.type ? movementTypeLabels[filters.type] ?? filters.type : ''},
        {
            label: 'Canale di vendita',
            value: filters.salesChannelId ? channels.find(item => item.id === filters.salesChannelId)?.name ?? String(filters.salesChannelId) : ''
        },
    ].filter(item => item.value);
    return <div className="grid movement-ledger-page">
        <div className="toolbar-card">
            <div><h2>{title}</h2>
                <p className="muted">{isPayment ? 'Pagamenti registrati sulle spese, comprese le buste paga.' : 'Accrediti registrati sugli incassi, compresi gli scontrini.'}</p>
            </div>
            <div className="toolbar-actions">
                <Link className="btn btn-md btn-default" href={documentPath}><span className="btn-icon" aria-hidden="true">↩</span>Torna a {isPayment ? 'Spese' : 'Incassi'}
                </Link><Link className="btn btn-md btn-default" href={isPayment ? '/incomes/credits' : '/expenses/payments'}><span className="btn-icon" aria-hidden="true">{isPayment ? '↙' : '↗'}</span>{isPayment ? 'Accrediti' : 'Pagamenti'}
            </Link></div>
        </div>
        <section className="card ledger-overview">
            <MovementLedgerFilters path={path} quick={filters.period.quick} year={String(filters.period.year)} from={filters.period.from} to={filters.period.to} methods={namedOptions('method')} banks={namedOptions('bank')} types={types} channels={channels}/>
            <p className="muted">{interval} · {current.company.name}</p>
            <div className="ledger-kpis">
                <div><span>Totale {title.toLowerCase()}</span><strong>{euro(total)}</strong></div>
                <div><span>Movimenti</span><strong>{summary.count}</strong></div>
                <div><span>Importo medio</span><strong>{euro(summary.count ? total / summary.count : 0)}</strong></div>
            </div>
        </section>
        <div className="ledger-breakdowns">
            <Breakdown title="Per metodo" rows={breakdown('method')} total={total}/><Breakdown title="Per banca / conto" rows={breakdown('bank')} total={total}/>
        </div>
        <section className="card ledger-list">
            <div className="ledger-list-header"><h3>Lista {title.toLowerCase()}</h3>
                <div id="ledger-list-filter-trigger"/>
            </div>
            <div className="recurring-active-filters">
                <div>
                    <div className="flex justify-start align-start">
                        <span className="flex-grow recurring-active-filters-title">Filtri attivi</span>
                        <Link className="btn btn-xs btn-neutral recurring-active-filters-reset" href={path} scroll={false}><span className="btn-icon">×</span> Reset</Link>
                    </div>
                    <div className="flex justify-end align-start">
                        <div className="recurring-active-filter-tags">{activeFilters.map(item =>
                            <span className="badge" key={item.label}><strong>{item.label}:</strong> {item.value}</span>)}</div>
                    </div>
                </div>
            </div>
            <LiveSearch name="search" label={isPayment ? 'Cerca pagamento' : 'Cerca accredito'} placeholder="Nome, descrizione o numero del documento"/>
            <p className="muted">{summary.count ? `${(page - 1) * ledgerPageSize + 1}–${Math.min(page * ledgerPageSize, summary.count)} di ${summary.count}` : 'Nessun movimento per i filtri selezionati.'}</p>
            {rows.length ?
                <div className="mobile-record-list ledger-mobile-list" aria-label={`Lista ${title.toLowerCase()}`}>
                    {rows.map(row => <div className="mobile-record-item" key={row.id}>
                        <Link className="mobile-record-link" href={`${documentPath}/${row.documentId}?returnTo=${encodeURIComponent(returnTo)}`}>
                            <div className="mobile-record-main">
                                <div className="mobile-record-meta ledger-mobile-meta">
                                    <span className="ledger-mobile-reference" title={movementTypeLabels[row.type] ?? row.type}>{isPayment ? 'Spesa' : 'Incasso'} #{row.documentId}</span>
                                    <span className="ledger-mobile-method" title={row.method}><span aria-hidden="true">{row.methodIcon || '•'}</span> {row.method}</span>
                                    <span className="mobile-record-date">{dateLabel(row.date)}</span>
                                </div>
                                <div className="mobile-record-title-row">
                                    <strong title={row.party}>{row.party}</strong>
                                    <span className="ledger-mobile-amount">{euro(Number(row.amount))}</span>
                                </div>
                                <div className="mobile-record-footer ledger-mobile-footer">
                                    <span className="ledger-mobile-description" title={row.description || 'Nessuna descrizione'}>{row.description || 'Nessuna descrizione'}</span>
                                    <span className="ledger-mobile-bank" title={row.bank}>{row.bank}</span>
                                </div>
                            </div>
                        </Link>
                    </div>)}
                </div> : null}
            {rows.length ? <table className="ledger-table">
                <thead>
                <tr>{sortHeader('date', 'Data')}{sortHeader('party', isPayment ? 'Beneficiario' : 'Cliente / canale')}{sortHeader('description', 'Descrizione')}{sortHeader('method', 'Metodo')}{sortHeader('bank', 'Banca / conto')}{sortHeader('amount', 'Importo')}{sortHeader('documentId', 'Documento')}</tr>
                </thead>
                <tbody>{rows.map(row => <tr key={row.id}>
                    <td data-label="Data">{dateLabel(row.date)}</td>
                    <td data-label={isPayment ? 'Beneficiario' : 'Cliente / canale'}>{row.party}</td>
                    <td data-label="Descrizione">{row.description || '—'}<small>{movementTypeLabels[row.type] ?? row.type}</small>
                    </td>
                    <td data-label="Metodo"><span aria-hidden="true">{row.methodIcon || '•'}</span> {row.method}</td>
                    <td data-label="Banca / conto">{row.bank}</td>
                    <td data-label="Importo"><strong>{euro(Number(row.amount))}</strong></td>
                    <td data-label="Documento">
                        <Link href={`${documentPath}/${row.documentId}?returnTo=${encodeURIComponent(returnTo)}`}>Apri {isPayment ? 'spesa' : 'incasso'} #{row.documentId}</Link>
                    </td>
                </tr>)}</tbody>
            </table> : null}
            {pages > 1 ? <nav className="ledger-pagination" aria-label="Pagine movimenti">{page > 1 ?
                <Link className="btn btn-md btn-default" href={pageHref(page - 1)} scroll={false}>
                    <span className="btn-icon" aria-hidden="true">←</span>Prec.
                </Link> :
                <span/>}
                <span>Pagina {page} di {pages}</span>{page < pages ?
                    <Link className="btn btn-md btn-default" href={pageHref(page + 1)} scroll={false}>Succ.
                        <span className="btn-icon" aria-hidden="true">→</span></Link> :
                    <span/>}</nav> : null}
        </section>
    </div>;
}
