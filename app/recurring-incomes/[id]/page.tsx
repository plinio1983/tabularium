import DeleteActionButton from '@/components/DeleteActionButton';
import {notFound} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import {requireWorkspace} from '@/lib/auth';
import {euro} from '@/lib/money';
import {stripFlashParams} from '@/lib/flash';
import {orderBanks, orderPaymentMethods} from '@/lib/workspace-defaults';
import RecurringStateProvider from '@/components/RecurringStateProvider';
import RecurringStateToggle from '@/components/RecurringStateToggle';
import RecurringDetailState from '@/components/RecurringDetailState';
import RecurringDetailActionsMenu from '@/components/RecurringDetailActionsMenu';
import RecurringIncomeEditModal from '@/components/RecurringIncomeEditModal';
import DetailBackButton from '@/components/DetailBackButton';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import IncomesList from '@/components/IncomesList';

const cadenceLabels: Record<string, string> = {
    MONTHLY: 'Ogni mese', EVERY_2_MONTHS: 'Ogni 2 mesi', EVERY_3_MONTHS: 'Ogni 3 mesi',
    EVERY_6_MONTHS: 'Ogni 6 mesi', YEARLY: 'Annuale', EVERY_2_YEARS: 'Ogni 2 anni'
};
const billingLabels: Record<string, string> = {
    SAME_MONTH: 'Stesso mese', NEXT_MONTH: 'Mese successivo', CUSTOM_MONTH: 'Mese impostato'
};
const months = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
function dateLabel(value: Date) {
    return new Intl.DateTimeFormat('it-IT', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(value);
}

export default async function RecurringIncomeDetailPage({params, searchParams}: {
    params: Promise<{id: string}>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const current = await requireWorkspace('/recurring-incomes');
    const id = Number((await params).id);
    if (!Number.isSafeInteger(id) || id <= 0) notFound();
    const query = (await searchParams) ?? {};
    const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
    const returnTo = rawReturnTo && /^\/recurring-incomes(?:\?|$)/.test(rawReturnTo)
        ? stripFlashParams(rawReturnTo) : '/recurring-incomes';
    const detailHref = `/recurring-incomes/${id}?returnTo=${encodeURIComponent(returnTo)}`;
    const encodedDetailHref = encodeURIComponent(detailHref);
    const workspaceId = current.workspace.id;
    const companyId = current.company.id;
    const [item, channels, customers, rawMethods, rawBanks] = await Promise.all([
        prisma.recurringIncome.findFirst({
            where: {id, workspaceId, companyId},
            include: {
                customer: true, salesChannel: true, incomeCategory: true, paymentMethod: true, bank: true,
                generatedIncomes: {
                    where: {workspaceId, companyId},
                    include: {customer: true, salesChannelRef: true, paymentMethodRef: true, creditBank: true, credits: true, attachments: true},
                    orderBy: [{billingYear: 'desc'}, {billingMonth: 'desc'}, {id: 'desc'}], take: 24
                }
            }
        }),
        prisma.incomeSalesChannel.findMany({where: {workspaceId}, orderBy: [{sortOrder: 'asc'}, {name: 'asc'}]}),
        prisma.customer.findMany({where: {workspaceId}, orderBy: {businessName: 'asc'}}),
        prisma.paymentMethod.findMany({where: {workspaceId}}),
        prisma.bank.findMany({where: {workspaceId}})
    ]);
    if (!item) notFound();
    const methods = orderPaymentMethods(rawMethods, 'INCOME');
    const banks = orderBanks(rawBanks).map(bank => ({...bank, isPrimary: bank.id === current.company.primaryBankId}));
    const {customer, salesChannel, incomeCategory, paymentMethod, bank, generatedIncomes, ...rule} = item;
    const editableItem = {...rule, amount: item.amount.toString(), vatRate: item.vatRate.toString()};
    const stateProps = {kind: 'income' as const, id, active: item.isActive, archived: Boolean(item.archivedAt)};
    const cadence = cadenceLabels[item.cadence] ?? item.cadence;
    const creditDay = item.creditMonth ? `${item.creditDay ?? '-'} ${months[item.creditMonth]}` : item.creditDay ? `Giorno ${item.creditDay}` : '-';
    const billing = `${billingLabels[item.billingPeriodMode] ?? item.billingPeriodMode}${item.billingMonth ? ` · ${months[item.billingMonth]}` : ''}`;
    const generatedTotal = generatedIncomes.reduce((sum, income) => sum + Number(income.amount), 0);
    const actions = <>
        <div className="left-side"><DetailBackButton href={returnTo}/></div>
        <div className="right-side">
            <RecurringStateToggle {...stateProps} returnTo={encodedDetailHref}/>
            <RecurringDetailActionsMenu>
                <summary className="btn btn-sm btn-default" aria-label="Azioni entrata ricorrente" title="Azioni entrata ricorrente">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                </summary>
                <div className="recurring-detail-actions-panel">
                    <button className="btn btn-sm btn-option" type="button" data-recurring-income-edit-id={id}><span className="btn-icon">✎</span> Modifica</button>
                    <DeleteActionButton action={`/api/recurring-incomes/${id}?returnTo=${encodeURIComponent(returnTo)}`}
                        confirmMessage="Confermi la rimozione dell’entrata ricorrente? L’operazione non può essere annullata. Gli incassi già generati saranno mantenuti."
                        className="btn btn-sm btn-danger"><span className="btn-icon">🗑</span> Elimina</DeleteActionButton>
                </div>
            </RecurringDetailActionsMenu>
            <div className="recurring-detail-actions-inline">
                <button className="btn btn-sm btn-default" type="button" data-recurring-income-edit-id={id}><span className="btn-icon">✎</span> Modifica</button>
                    <DeleteActionButton action={`/api/recurring-incomes/${id}?returnTo=${encodeURIComponent(returnTo)}`}
                        confirmMessage="Confermi la rimozione dell’entrata ricorrente? L’operazione non può essere annullata. Gli incassi già generati saranno mantenuti."
                        className="btn btn-sm btn-danger"><span className="btn-icon">🗑</span> Elimina</DeleteActionButton>
            </div>
        </div>
    </>;
    return <RecurringStateProvider>
        <RecurringIncomeEditModal items={[editableItem]} channels={channels} customers={customers} methods={methods} banks={banks}>
            <div className="grid record-detail-page recurring-record-detail-page">
                <ActionFeedbackBanner searchParams={query}
                    savedMessages={{updated: 'Entrata ricorrente aggiornata.', activated: 'Ricorrenza attivata.', deactivated: 'Ricorrenza disattivata.'}}
                    errorMessages={{invalid_state: 'Impossibile cambiare stato: aggiorna la data di fine delle ricorrenze scadute prima di riattivarle.', invalid: 'Controlla i dati inseriti.'}}/>
                <div className="record-detail-shell">
                    <div className="record-detail-action-row hidden-sm-up">{actions}</div>
                    <article className="record-detail-document recurring-detail-document">
                        <div className="record-detail-action-row hidden-sm-down">{actions}</div>
                        <section className="record-detail-hero">
                            <div className="record-detail-title-block">
                                <p className="record-detail-kicker"><span>Entrata ricorrente #{id}</span></p>
                                <p className="record-detail-kicker"><RecurringDetailState {...stateProps} variant="badge"/></p>
                                <h1>{customer?.businessName ?? item.description}</h1>
                                <div className="record-detail-meta-line"><span>{salesChannel.name}</span><span>{item.description}</span></div>
                            </div>
                            <aside className="record-detail-amount-panel">
                                <div className="record-detail-amount-panel-header-row"><span className="record-detail-amount-panel-header">Importo ricorrente</span></div>
                                <strong>{euro(item.amount.toString())}</strong>
                                <div className="record-detail-badge-row"><RecurringDetailState {...stateProps} variant="summary"/><span className="badge">{cadence}</span></div>
                            </aside>
                        </section>
                        <section className="record-detail-status-strip">
                            <div><span>Cadenza</span><strong>{cadence}</strong></div>
                            <div><span>Giorno incasso</span><strong>{creditDay}</strong></div>
                            <div><span>Fatturazione</span><strong>{billing}</strong></div>
                            <div><span>Incasso</span><strong>{item.isAutomaticCredit ? 'Automatico' : 'Manuale'}</strong></div>
                        </section>
                        <RecurringDetailState {...stateProps} variant="progress"/>
                        <section className="record-detail-section">
                            <div className="record-detail-section-heading"><div><h2>Dati ricorrenza</h2><p>Dati e impostazioni della regola.</p></div></div>
                            <div className="record-detail-status-strip">
                                <div><span>Descrizione</span><strong>{item.description}</strong></div>
                                <div><span>Cliente</span><strong>{customer?.businessName ?? '-'}</strong></div>
                                <div><span>Canale di vendita</span><strong>{salesChannel.name}</strong></div>
                                <div><span>Categoria</span><strong>{incomeCategory.name}</strong></div>
                                <div><span>Data inizio</span><strong>{dateLabel(item.startDate)}</strong></div>
                                <div><span>Data di fine</span><strong>{item.endDate ? dateLabel(item.endDate) : 'Senza scadenza'}</strong></div>
                                <div><span>Stato</span><RecurringDetailState {...stateProps} variant="text"/></div>
                                <div><span>Fiscale</span><strong>{item.isFiscal ? '✓ Si' : '× No'}</strong></div>
                                <div><span>IVA</span><strong>{item.vatRate.toString()}%</strong></div>
                            </div>
                        </section>
                        <section className="record-detail-section">
                            <div className="record-detail-section-heading"><div><h2>Regola di incasso</h2><p>Metodo e banca configurati per la ricorrenza.</p></div></div>
                            <div className="record-detail-status-strip">
                                <div><span>Metodo di incasso</span><strong>{paymentMethod?.name ?? '-'}</strong></div>
                                <div><span>Banca</span><strong>{bank?.name ?? '-'}</strong></div>
                                <div><span>Incasso automatico</span><strong>{item.isAutomaticCredit ? '✓ Si' : '× No'}</strong></div>
                                <div><span>Giorno incasso</span><strong>{creditDay}</strong></div>
                            </div>
                        </section>
                        <section className="record-detail-section"><div className="record-detail-item record-detail-item-wide"><span>Note</span><strong className="displayed-notes">{item.notes ?? '-'}</strong></div></section>
                        <section className="record-detail-section">
                            <div className="record-detail-section-heading"><div><h2>Entrate generate</h2><p>Ultime entrate create da questa regola ricorrente.</p></div><span className="badge">{generatedIncomes.length} record · {euro(generatedTotal)}</span></div>
                            <IncomesList incomes={generatedIncomes} returnTo={encodedDetailHref} banks={banks} paymentMethods={methods} salesChannels={channels} customers={customers} timeZone={current.company.timeZone} emptyMessage="Nessuna entrata generata da questa ricorrenza."/>
                        </section>
                    </article>
                </div>
            </div>
        </RecurringIncomeEditModal>
    </RecurringStateProvider>;
}
