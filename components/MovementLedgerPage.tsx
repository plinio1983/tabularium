import Link from 'next/link';
import {prisma} from '@/lib/prisma';
import {requireWorkspace} from '@/lib/auth';
import {dateInputInTimeZone} from '@/lib/company-time';
import {ledgerFilters, ledgerPageSize, movementTypeLabels, type LedgerKind, type LedgerParams} from '@/lib/movement-ledger';
import {filteredListHref} from '@/lib/live-search';
import {euro} from '@/lib/money';
import LiveSearch from './LiveSearch';
import MovementLedgerFilters from './MovementLedgerFilters';

import {loadMovementLedger, type Group} from '@/lib/movement-ledger-data';

function Breakdown({title, rows, total}: {title: string; rows: Group[]; total: number}) {
  return <section className="card ledger-breakdown"><h3>{title}</h3>
    {rows.length ? <table><colgroup><col style={{width: '34%'}}/><col style={{width: '12%'}}/><col style={{width: '34%'}}/><col style={{width: '20%'}}/></colgroup><thead><tr><th scope="col">Nome</th><th scope="col"><abbr title="Numero di movimenti">N.</abbr></th><th scope="col">Importo</th><th scope="col">Quota</th></tr></thead>
      <tbody>{rows.map(row => {
        const share = total ? Number(row.total) / total * 100 : 0;
        return <tr key={row.id ?? 'none'}><th scope="row"><span>{row.name}</span><span className="ledger-bar" aria-hidden="true"><span style={{width: `${Math.max(0, Math.min(100, share))}%`}}/></span></th><td>{row.count}</td><td>{euro(Number(row.total))}</td><td>{share.toLocaleString('it-IT', {maximumFractionDigits: 1})}%</td></tr>;
      })}</tbody></table> : <p className="muted">Nessun movimento per i filtri selezionati.</p>}
  </section>;
}

export default async function MovementLedgerPage({kind, searchParams}: {kind: LedgerKind; searchParams?: Promise<LedgerParams>}) {
  const isPayment = kind === 'payments';
  const path = isPayment ? '/expenses/payments' : '/incomes/credits';
  const documentPath = isPayment ? '/expenses' : '/incomes';
  const title = isPayment ? 'Pagamenti' : 'Accrediti';
  const current = await requireWorkspace(path);
  const params = await searchParams ?? {};
  const filters = ledgerFilters(params, dateInputInTimeZone(current.company.timeZone));
  const {summary, total, groups, options, channels, rows, page, pages} = await loadMovementLedger(prisma, kind, current.workspace.id, current.company.id, current.company.timeZone, filters);
  const returnTo = filteredListHref(path, {...params, page: String(page)});
  const pageHref = (next: number) => filteredListHref(path, {...params, page: String(next)});
  const namedOptions = (dimension: string) => options.filter(item => item.dimension === dimension).map(item => ({id: Number(item.id), name: item.name})).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const types = options.filter(item => item.dimension === 'type').map(item => ({id: item.id, name: movementTypeLabels[item.id] ?? item.name}));
  const breakdown = (dimension: string) => groups.filter(row => row.dimension === dimension).sort((a, b) => Number(b.total) - Number(a.total));
  const dateLabel = (date: Date | null) => date ? date.toLocaleDateString('it-IT', {timeZone: current.company.timeZone}) : 'Senza data';
  const interval = filters.dateMode === 'all' ? 'Tutte le date' : filters.dateMode === 'undated' ? 'Movimenti senza data' : `${filters.period.from.split('-').reverse().join('/')} – ${filters.period.to.split('-').reverse().join('/')}`;
  const activeFilters = [
    filters.search && `Ricerca: ${filters.search}`,
    filters.methodId && `Metodo: ${namedOptions('method').find(item => item.id === filters.methodId)?.name ?? filters.methodId}`,
    filters.noBank ? 'Banca / conto: non specificato' : filters.bankId && `Banca / conto: ${namedOptions('bank').find(item => item.id === filters.bankId)?.name ?? filters.bankId}`,
    filters.type && `Tipo: ${movementTypeLabels[filters.type] ?? filters.type}`,
    filters.salesChannelId && `Canale di vendita: ${channels.find(item => item.id === filters.salesChannelId)?.name ?? filters.salesChannelId}`,
  ].filter(Boolean);
  return <div className="grid movement-ledger-page">
    <div className="toolbar-card"><div><h2>{title}</h2><p className="muted">{isPayment ? 'Pagamenti registrati sulle spese, comprese le buste paga.' : 'Accrediti registrati sugli incassi, compresi gli scontrini.'}</p></div><div className="toolbar-actions"><Link className="btn btn-md btn-default" href={documentPath}>Torna a {isPayment ? 'Spese' : 'Incassi'}</Link><Link className="btn btn-md btn-default" href={isPayment ? '/incomes/credits' : '/expenses/payments'}>{isPayment ? 'Accrediti' : 'Pagamenti'}</Link></div></div>
    <section className="card ledger-overview">
      <MovementLedgerFilters path={path} quick={filters.period.quick} year={String(filters.period.year)} from={filters.period.from} to={filters.period.to} methods={namedOptions('method')} banks={namedOptions('bank')} types={types} channels={channels}/>
      <p className="muted">{interval} · {current.company.name}</p>
      {activeFilters.length ? <div className="ledger-active-filters">{activeFilters.map(label => <span className="badge" key={String(label)}>{label}</span>)}</div> : null}
      <div className="ledger-kpis"><div><span>Totale {title.toLowerCase()}</span><strong>{euro(total)}</strong></div><div><span>Movimenti</span><strong>{summary.count}</strong></div><div><span>Importo medio</span><strong>{euro(summary.count ? total / summary.count : 0)}</strong></div></div>
    </section>
    <div className="ledger-breakdowns"><Breakdown title="Per metodo" rows={breakdown('method')} total={total}/><Breakdown title="Per banca / conto" rows={breakdown('bank')} total={total}/></div>
    <section className="card ledger-list"><h3>Lista {title.toLowerCase()}</h3><LiveSearch name="search" label={isPayment ? 'Cerca pagamento' : 'Cerca accredito'} placeholder="Nome, descrizione o numero del documento"/>
      <p className="muted">{summary.count ? `${(page - 1) * ledgerPageSize + 1}–${Math.min(page * ledgerPageSize, summary.count)} di ${summary.count}` : 'Nessun movimento per i filtri selezionati.'}</p>
      {rows.length ? <table className="ledger-table"><thead><tr><th scope="col">Data</th><th scope="col">{isPayment ? 'Beneficiario' : 'Cliente / canale'}</th><th scope="col">Descrizione</th><th scope="col">Metodo</th><th scope="col">Banca / conto</th><th scope="col">Importo</th><th scope="col">Documento</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>
        <td data-label="Data">{dateLabel(row.date)}</td><td data-label={isPayment ? 'Beneficiario' : 'Cliente / canale'}>{row.party}</td><td data-label="Descrizione">{row.description || '—'}<small>{movementTypeLabels[row.type] ?? row.type}</small></td><td data-label="Metodo">{row.method}</td><td data-label="Banca / conto">{row.bank}</td><td data-label="Importo"><strong>{euro(Number(row.amount))}</strong></td><td data-label="Documento"><Link href={`${documentPath}/${row.documentId}?returnTo=${encodeURIComponent(returnTo)}`}>Apri {isPayment ? 'spesa' : 'incasso'} #{row.documentId}</Link></td>
      </tr>)}</tbody></table> : null}
      {pages > 1 ? <nav className="ledger-pagination" aria-label="Pagine movimenti">{page > 1 ? <Link className="btn btn-md btn-default" href={pageHref(page - 1)} scroll={false}>Precedente</Link> : <span/>}<span>Pagina {page} di {pages}</span>{page < pages ? <Link className="btn btn-md btn-default" href={pageHref(page + 1)} scroll={false}>Successiva</Link> : <span/>}</nav> : null}
    </section>
  </div>;
}
