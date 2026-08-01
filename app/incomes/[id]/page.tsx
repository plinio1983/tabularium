import Link from 'next/link';
import {notFound} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import IncomeEditModalController from '@/components/IncomeEditModalController';
import DetailBackButton from '@/components/DetailBackButton';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import DeleteActionButton from '@/components/DeleteActionButton';
import {euro} from '@/lib/money';
import {requireWorkspace} from '@/lib/auth';
import {orderBanks, orderPaymentMethods} from '@/lib/workspace-defaults';
import {detailBackHref} from '@/lib/detail-navigation';
import {
    badgeClass,
    fiscalStyles,
    incomeCreditStatusStyles,
    incomeInvoiceStatusStyles,
    salesChannelTone
} from '@/lib/income-ui';
import {vatRateLabel, yesNoStyles} from "@/lib/expense-ui";
import {incomeCreditSummary} from '@/lib/income-credits';

function dateLabel(value?: Date | null) {
    if (!value) return '-';
    const formatted = new Intl.DateTimeFormat('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(value);
    return formatted.replace(/\b([a-zàèéìòù])/, match => match.toUpperCase());
}

function vatAmountFromGross(amount: number, vatRate: number) {
    if (!vatRate) return 0;
    return amount * (vatRate / (100 + vatRate));
}

function formatPeriod(month: number, year: number) {
    const monthName = new Intl.DateTimeFormat('it-IT', {month: 'long'}).format(new Date(year, month - 1, 1));
    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

function booleanBadge(value: boolean) {
    const item = value ? fiscalStyles.yes : fiscalStyles.no;
    return <span className={badgeClass(item.className)}>{item.icon} {item.label}</span>;
}

function booleanBadgeSimple(value: boolean) {
    const item = value ? fiscalStyles.yes : fiscalStyles.no;
    return `${item.icon} ${item.label}`;
}


function localDateKey(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function isIncomeCreditOverdue(income: { isCredited: boolean; expectedCreditDate: Date | null }) {
    return !income.isCredited && Boolean(income.expectedCreditDate) && localDateKey(income.expectedCreditDate!) < localDateKey(new Date());
}

function incomeCreditStatus(income: { isCredited: boolean; expectedCreditDate: Date | null; credited: number }) {
    if (income.isCredited) return incomeCreditStatusStyles.ACCREDITATO;
    if (income.credited > 0) return incomeCreditStatusStyles.PARZIALE;
    return isIncomeCreditOverdue(income) ? incomeCreditStatusStyles.SCADUTO : incomeCreditStatusStyles.DA_ACCREDITARE;
}

function fiscalBadge(value: boolean) {
    const item = value ? yesNoStyles.yes : yesNoStyles.no;
    const label = value ? '✓ Fiscale' : '× Non Fisc.';
    return <span className={badgeClass(item.className)}>{label}</span>;
}

export default async function IncomeDetailPage({params, searchParams}: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspace('/incomes');
    const {id} = await params;
    const query = (await searchParams) ?? {};
    const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
    const returnTo = detailBackHref(rawReturnTo, `/incomes/${id}`, '/incomes');
    const encodedReturnTo = encodeURIComponent(returnTo);
    const currentDetailReturnTo = `/incomes/${id}?returnTo=${encodedReturnTo}`;
    const [income, banks, paymentMethods, salesChannels, customers] = await Promise.all([
        prisma.income.findFirst({
            where: {id: Number(id), workspaceId: current.workspace.id, companyId: current.company.id},
            include: {
                paymentMethodRef: true,
                creditBank: true,
                salesChannelRef: true,
                customer: true
                ,credits: {include: {paymentMethod: true, bank: true}, orderBy: [{creditDate: 'asc'}, {id: 'asc'}]}
            }
        }),
        prisma.bank.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.paymentMethod.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.incomeSalesChannel.findMany({where: {workspaceId: current.workspace.id}, orderBy: [{sortOrder: 'asc'}, {name: 'asc'}]}),
        prisma.customer.findMany({where: {workspaceId: current.workspace.id}, orderBy: {businessName: 'asc'}})
    ]);
    if (!income) notFound();
    const orderedBanks = orderBanks(banks);
    const incomePaymentMethods = orderPaymentMethods(paymentMethods, 'INCOME');

    const amount = Number(income.amount.toString());
    const creditSummary = incomeCreditSummary(income);
    const vatRate = Number(income.vatRate.toString());
    const vatAmount = income.isFiscal ? vatAmountFromGross(amount, vatRate) : 0;
    const netAmount = amount - vatAmount;
    // const supplierName = income.description?.trim() || 'Non indicato';
    const customerName = income.customer?.businessName?.trim() || 'Non indicato';
    const title = customerName !== 'Non indicato' ? customerName : `Incasso ${income.salesChannelRef.name}`;
    const incomePaymentMethodName = income.paymentMethodRef.name;
    const incomeCreditChannelName = income.creditBank.name;
    const salesTone = salesChannelTone(income.salesChannelRef.code);
    const invoiceStyle = incomeInvoiceStatusStyles[income.invoiceStatus || 'NONE'] ?? incomeInvoiceStatusStyles.NONE;
    const creditStatus = incomeCreditStatus({...income, credited: creditSummary.credited});
    const detailToneClass = isIncomeCreditOverdue(income)
        ? 'income-row-overdue'
        : income.invoiceStatus === 'NON_INVIATA' || income.invoiceStatus === 'PARZIALE'
            ? 'income-row-warning'
            : '';
    const flashMessages = {
        savedMessages: {
            created: 'Incasso creato.',
            updated: 'Incasso aggiornato.',
            deleted: 'Incasso rimosso.'
        },
        errorMessages: {
            invalid: 'Controlla i campi dell’incasso.',
            not_found: 'Incasso non trovato.',
            in_use: 'L’incasso è collegato ad altri movimenti.'
        }
    };

    return <div className="grid record-detail-page income-detail-page">
        <IncomeEditModalController
            returnTo={currentDetailReturnTo}
            banks={orderedBanks.map(bank => ({id: bank.id, name: bank.name, icon: bank.icon, isFallback: bank.isFallback, isPrimary: bank.id === current.company.primaryBankId}))}
            paymentMethods={incomePaymentMethods.map(method => ({
                id: method.id,
                name: method.name,
                icon: method.icon,
                kind: method.kind,
                isFallback: method.isFallback,
                isIncomeDefault: method.isIncomeDefault
            }))}
            salesChannels={salesChannels}
            customers={customers}
        />
        <ActionFeedbackBanner
            searchParams={query}
            savedMessages={flashMessages.savedMessages}
            errorMessages={flashMessages.errorMessages}
            defaultSavedMessage="Operazione completata."
            defaultErrorMessage="Impossibile completare l’operazione."
        />

        <div className="record-detail-shell">
            <article className={['record-detail-document', 'income-detail-document', detailToneClass].filter(Boolean).join(' ')}>
                <div className="record-detail-action-row">
                    <div className="left-side">
                        <DetailBackButton href={returnTo} />
                    </div>
                    <div className="right-side">
                        <Link className="btn btn-sm btn-default" href="#" data-income-edit-id={income.id}>✎ Modifica</Link>
                        <DeleteActionButton
                            action={`/api/incomes/${income.id}?returnTo=${encodedReturnTo}`}
                            confirmMessage="Confermi la rimozione dell’incasso? L’operazione non può essere annullata."
                            className="btn btn-sm btn-danger"
                        >
                            🗑 Elimina
                        </DeleteActionButton>
                    </div>
                </div>

                <section className="record-detail-hero">
                    <div>
                        <div className="record-detail-title-block">
                            <p className="record-detail-kicker">Incasso #{income.id}</p>
                            <h1>{income.customer ? <Link href={`/clients/${income.customer.id}`}>{title}</Link> : title}</h1>
                            <div className="income-detail-description">{income.description?.trim()}</div>
                            {/*<div className="record-detail-meta-line">*/}
                            {/*    {fiscalBadge(income.isFiscal)}*/}
                            {/*    <span>{income.salesChannelRef.icon ?? '  •  '} {income.salesChannelRef.name}</span>*/}
                            {/*</div>*/}
                        </div>
                    </div>

                    <aside className="record-detail-amount-panel">
                        <div className="record-detail-amount-panel-header-row">
                            <span className="record-detail-amount-panel-header">IVA inclusa</span>
                            <strong className="badge">{vatRateLabel(vatRate)}</strong>
                        </div>
                        <strong>{euro(amount)}</strong>
                        <div className="record-detail-badge-row">
                            <span className={badgeClass(creditStatus.className)}>{creditStatus.icon} {creditStatus.label}</span>
                            {/*<span className={badgeClass(paymentStyle?.className)}>{paymentStyle?.icon ?? '  •  '} {incomePaymentMethodName}</span>*/}
                            <span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} Fatt. {invoiceStyle.label}</span>
                        </div>
                    </aside>
                </section>

                <section className="record-detail-status-strip">
                    <div>
                        <span>Imponibile</span>
                        <strong>{euro(netAmount)}</strong>
                    </div>
                    <div>
                        <span>IVA</span>
                        <strong>{euro(vatAmount)} ({vatRateLabel(income.vatRate)})</strong>
                    </div>
                    <div className="record-detail-payment">
                        {/*<div className="record-detail-payment-icon">{creditStatus.icon}</div>*/}
                        <span>Stato</span>
                        <strong>{creditStatus.icon} {creditStatus.label}</strong>
                    </div>
                    <div>
                        <span>Fattura</span>
                        <strong>{invoiceStyle.icon} {invoiceStyle.label}</strong>
                    </div>
                </section>
                <div className="record-detail-progress" aria-label={`Accreditato ${Math.min(100, amount ? creditSummary.credited / amount * 100 : 0).toFixed(0)}%`}>
                    <span style={{width: `${Math.min(100, amount ? creditSummary.credited / amount * 100 : 0)}%`}}/>
                </div>

                <section className="record-detail-section">
                    <div className="record-detail-section-heading">
                        <div>
                            <h2>Dati incasso</h2>
                            <p>Canale, accredito e metodo di pagamento.</p>
                        </div>
                    </div>
                    <div className="record-detail-item record-detail-item-wide">
                        <span>Descrizione</span>
                        <strong>{income.description ?? 'Nessuna descrizione inserita.'}</strong>
                    </div>
                    <div className="record-detail-status-strip">
                        <div className="span-2"><span>Cliente</span><strong>{income.customer ?
                            <Link href={`/clients/${income.customer.id}`}>{income.customer.businessName}</Link> : 'Non assegnato'}</strong>
                        </div>
                        <div>
                            <span>Incasso</span>
                            <strong>{euro(amount)}</strong>
                        </div>
                        <div>
                            <span>Canale</span><strong className={salesTone}>{income.salesChannelRef.icon ?? '  •  '} {income.salesChannelRef.name}</strong>
                        </div>
                        <div><span>Data ordine</span><strong>{dateLabel(income.orderDate ?? income.creditDate)}</strong></div>
                        <div><span>Accreditato</span><strong>{euro(creditSummary.credited)}</strong></div>
                        <div><span>Residuo</span><strong>{euro(creditSummary.residual)}</strong></div>
                    </div>
                </section>

                <section className="record-detail-section">
                    <div className="record-detail-section-heading">
                        <div><h2>Accrediti</h2><p>Movimenti registrati per questo incasso.</p></div>
                    </div>
                    {income.credits.length ? <div className="app-record-form record-detail-payment-summary-list">
                        {income.credits.map(credit => <article className="payment-row payment-summary-row" key={credit.id}>
                            <div className="payment-summary-primary"><span className="payment-summary-kicker">Accredito effettuato</span><strong className="payment-summary-amount">{euro(Number(credit.amount))}</strong></div>
                            <div className="payment-summary-date"><span>Data accredito</span><strong>{dateLabel(credit.creditDate)}</strong></div>
                            <div className="payment-summary-meta">
                                <div><span>Metodo</span><strong>{credit.paymentMethod.icon ?? '•'} {credit.paymentMethod.name}</strong></div>
                                <div><span>Banca</span><strong>{credit.bank.icon ?? '•'} {credit.bank.name}</strong></div>
                            </div>
                        </article>)}
                    </div> : <p className="muted">Nessun accredito registrato.</p>}
                </section>

                <section className="record-detail-section">
                    <div className="record-detail-section-heading">
                        <div>
                            <h2>Dati contabili</h2>
                            <p>Periodo fiscale, rilevanza, IVA e fatturazione.</p>
                        </div>
                    </div>
                    <div className="record-detail-status-strip">
                        <div>
                            <span>Contabilità</span><strong>{formatPeriod(income.billingMonth, income.billingYear)}</strong>
                        </div>
                        {/*<div><span>Fiscale</span><strong>{booleanBadge(income.isFiscal)}</strong></div>*/}
                        <div><span>Fiscale</span><strong>{booleanBadgeSimple(income.isFiscal)}</strong></div>
                        <div><span>IVA</span><strong>{vatRate}%</strong></div>
                        <div><span>Fattura</span><strong>{invoiceStyle.icon} {invoiceStyle.label}</strong></div>
                        {/*<div><span>Imponibile</span><strong>{euro(netAmount)}</strong></div>*/}
                        {/*<div><span>Importo IVA</span><strong>{euro(vatAmount)}</strong></div>*/}
                    </div>
                </section>

                <section className="record-detail-section">
                    <div className="record-detail-section-heading">
                        <div>
                            <h2>Note</h2>
                            <p>Annotazioni interne collegate all’incasso.</p>
                        </div>
                    </div>
                    <div className="record-detail-item record-detail-item-wide">
                        <span>Note</span>
                        <strong className="displayed-notes">{income.notes ?? 'Nessuna nota inserita.'}</strong>
                    </div>
                </section>
            </article>
        </div>
    </div>;
}
