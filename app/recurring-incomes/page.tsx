import {prisma} from '@/lib/prisma';
import {requireWorkspace} from '@/lib/auth';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import NewIncomePanel from '@/components/NewIncomePanel';
import RecurringIncomesList from '@/components/RecurringIncomesList';
import {orderBanks, orderPaymentMethods} from '@/lib/workspace-defaults';
import {stripFlashRecord} from '@/lib/flash';

export default async function RecurringIncomesPage({searchParams}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspace('/recurring-incomes');
    const query = (await searchParams) ?? {};
    const filters = stripFlashRecord(query);
    const workspaceId = current.workspace.id;
    const filterValue = (key: string) => {
        const value = filters[key];
        return (Array.isArray(value) ? value[0] ?? '' : value ?? '').trim();
    };
    const customer = filterValue('customer');
    const description = filterValue('description');
    const isActive = filterValue('isActive');
    const cadence = filterValue('cadence');
    const isAutomaticCredit = filterValue('isAutomaticCredit');
    const [items, channels, customers, rawMethods, rawBanks] = await Promise.all([
        prisma.recurringIncome.findMany({
            where: {
                workspaceId,
                companyId: current.company.id,
                ...(customer ? {customer: {businessName: {contains: customer, mode: 'insensitive' as const}}} : {}),
                ...(description ? {description: {contains: description, mode: 'insensitive' as const}} : {}),
                ...(['true', 'false'].includes(isActive) ? {isActive: isActive === 'true'} : {}),
                ...(cadence ? {cadence} : {}),
                ...(['true', 'false'].includes(isAutomaticCredit) ? {isAutomaticCredit: isAutomaticCredit === 'true'} : {}),
            },
            include: {customer: true, salesChannel: true, paymentMethod: true, bank: true},
            orderBy: [{isActive: 'desc'}, {startDate: 'asc'}]
        }),
        prisma.incomeSalesChannel.findMany({where: {workspaceId}, orderBy: [{sortOrder: 'asc'}, {name: 'asc'}]}),
        prisma.customer.findMany({where: {workspaceId}, orderBy: {businessName: 'asc'}}),
        prisma.paymentMethod.findMany({where: {workspaceId}}),
        prisma.bank.findMany({where: {workspaceId}})
    ]);
    const methods = orderPaymentMethods(rawMethods, 'INCOME');
    const banks = orderBanks(rawBanks);
    return <div className="grid"><NewIncomePanel showToolbar={false} banks={banks.map(bank => ({
        ...bank,
        isPrimary: bank.id === current.company.primaryBankId
    }))} paymentMethods={methods} salesChannels={channels} customers={customers}/>
        <div className="toolbar-card record-toolbar-card">
            <div><h2>Entrate ricorrenti</h2>
                <p className="muted">Gestisci le regole che generano periodicamente gli incassi.</p></div>
        </div>
        <ActionFeedbackBanner searchParams={query} savedMessages={{
            created: 'Entrata ricorrente creata.',
            updated: 'Entrata ricorrente aggiornata.'
        }} errorMessages={{invalid: 'Controlla i dati inseriti.', not_found: 'Entrata ricorrente non trovata.'}}/>
        <RecurringIncomesList items={items} filters={filters}/>
    </div>;
}
