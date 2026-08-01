import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireWorkspace } from '@/lib/auth';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import NewIncomePanel from '@/components/NewIncomePanel';
import { orderBanks, orderPaymentMethods } from '@/lib/workspace-defaults';

const cadenceLabel: Record<string,string> = { MONTHLY:'Mensile', EVERY_2_MONTHS:'Ogni 2 mesi', EVERY_3_MONTHS:'Trimestrale', EVERY_6_MONTHS:'Semestrale', YEARLY:'Annuale', EVERY_2_YEARS:'Ogni 2 anni' };
export default async function RecurringIncomesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/recurring-incomes');
  const query = (await searchParams) ?? {};
  const workspaceId = current.workspace.id;
  const [items, channels, customers, rawMethods, rawBanks] = await Promise.all([
    prisma.recurringIncome.findMany({ where: { workspaceId }, include: { customer:true, salesChannel:true, _count:{select:{generatedIncomes:true}} }, orderBy:[{isActive:'desc'},{description:'asc'}] }),
    prisma.incomeSalesChannel.findMany({ where: { workspaceId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.customer.findMany({ where: { workspaceId }, orderBy: { businessName: 'asc' } }),
    prisma.paymentMethod.findMany({ where: { workspaceId } }),
    prisma.bank.findMany({ where: { workspaceId } })
  ]);
  const methods = orderPaymentMethods(rawMethods, 'INCOME');
  const banks = orderBanks(rawBanks);
  return <div className="grid"><NewIncomePanel showToolbar={false} banks={banks.map(bank=>({...bank,isPrimary:bank.id===current.company.primaryBankId}))} paymentMethods={methods} salesChannels={channels} customers={customers} /><div className="toolbar-card record-toolbar-card"><div><h2>Entrate ricorrenti</h2><p className="muted">Gestisci le regole che generano periodicamente gli incassi.</p></div><button className="btn btn-sm btn-primary income-add-btn" type="button" data-income-new data-income-new-type="recurring"><span className="btn-icon">＋</span>Nuova entrata ricorrente</button></div>
    <ActionFeedbackBanner searchParams={query} savedMessages={{created:'Entrata ricorrente creata.',updated:'Entrata ricorrente aggiornata.'}} errorMessages={{invalid:'Controlla i dati inseriti.',not_found:'Entrata ricorrente non trovata.'}} />
    <section className="card recurring-expenses-card"><div className="list-heading recurring-list-heading"><div><h2>Lista entrate</h2><p className="muted">Risultati mostrati: {items.length}</p></div></div>
    {items.length ? <><div className="recurring-expenses-desktop-table-scroll"><table className="compact-recurring-expenses-table"><thead><tr><th>Descrizione</th><th>Cliente</th><th>Frequenza</th><th>Importo</th><th>Stato</th><th /></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><strong>{item.description}</strong><br/><small className="muted">{item.salesChannel.name} · {item._count.generatedIncomes} generati</small></td><td>{item.customer?.businessName ?? '—'}</td><td>{cadenceLabel[item.cadence] ?? item.cadence}</td><td className="recurring-table-amount">{Number(item.amount).toLocaleString('it-IT',{style:'currency',currency:'EUR'})}</td><td><span className="badge">{item.isActive?'Attiva':'Disattivata'}</span></td><td><Link className="btn btn-xs btn-default" href={`/recurring-incomes/${item.id}/edit`}>Modifica</Link></td></tr>)}</tbody></table></div><div className="recurring-expenses-mobile-list">{items.map(item=><Link className={`card recurring-mobile-item ${item.isActive?'':'recurring-mobile-item-disabled'}`} key={item.id} href={`/recurring-incomes/${item.id}/edit`}><div className="recurring-mobile-top"><div className="recurring-mobile-main-title"><strong>{item.description}</strong><span className="muted">{item.customer?.businessName ?? 'Nessun cliente'}</span></div><strong className="recurring-table-amount">{Number(item.amount).toLocaleString('it-IT',{style:'currency',currency:'EUR'})}</strong></div><div className="recurring-mobile-meta"><span>{cadenceLabel[item.cadence] ?? item.cadence}</span><span>{item.salesChannel.name}</span><span className="badge">{item.isActive?'Attiva':'Disattivata'}</span></div></Link>)}</div></> : <div className="empty-state"><p>Nessuna entrata ricorrente configurata.</p></div>}
  </section></div>;
}
