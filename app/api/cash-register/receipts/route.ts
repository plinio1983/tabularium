import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {ensureWorkspaceDefaults} from '@/lib/workspace-defaults';
import {writeAuditLog} from '@/lib/audit';
import {resolveCashRegisterBankId} from '@/lib/cash-register-bank';
import {resolveDefaultIncomeCategory} from '@/lib/income-category';

const allowedVatRates = [0, 4, 10, 22];
const ReceiptSchema = z.object({
    amount: z.coerce.number().positive().max(999999999.99),
    isFiscal: z.boolean(),
    vatRate: z.coerce.number(),
    creditDate: z.string().datetime(),
    salesChannelId: z.coerce.number().int().positive(),
    paymentMethodId: z.coerce.number().int().positive(),
    requestId: z.string().uuid()
});

function romePeriod(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Rome',
        year: 'numeric',
        month: 'numeric'
    }).formatToParts(date);
    return {
        year: Number(parts.find(part => part.type === 'year')?.value),
        month: Number(parts.find(part => part.type === 'month')?.value)
    };
}

export async function POST(request: Request) {
    const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
    if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
    const current = access.current;
    await ensureWorkspaceDefaults(current.workspace.id);
    const parsed = ReceiptSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({error: 'Dati scontrino non validi'}, {status: 400});
    const input = parsed.data;
    const vatRate = input.isFiscal ? input.vatRate : 0;
    if (!allowedVatRates.includes(vatRate)) {
        return NextResponse.json({error: 'Aliquota IVA non valida'}, {status: 400});
    }
    const date = new Date(input.creditDate);
    if (Number.isNaN(date.getTime())) return NextResponse.json({error: 'Data non valida'}, {status: 400});

    const [category, customer, method, channel] = await Promise.all([
        resolveDefaultIncomeCategory(current.workspace.id),
        prisma.customer.findFirst({where: {workspaceId: current.workspace.id, systemRole: 'CASH_REGISTER'}}),
        prisma.paymentMethod.findFirst({
            where: {
                id: input.paymentMethodId,
                workspaceId: current.workspace.id,
                cashRegisterEnabled: true,
                kind: {in: ['INCOME', 'BOTH']}
            }
        }),
        prisma.incomeSalesChannel.findFirst({
            where: {id: input.salesChannelId, workspaceId: current.workspace.id}
        })
    ]);
    if (!category || !customer || !method || !channel) {
        return NextResponse.json({error: 'Completa la configurazione del registratore di cassa'}, {status: 409});
    }
    if (!input.isFiscal && method.systemRole !== 'CASH') {
        return NextResponse.json({error: 'Gli incassi non fiscali possono essere registrati solo in contanti'}, {status: 400});
    }
    const creditBankId = await resolveCashRegisterBankId(current.workspace.id, method, channel.id);
    if (!creditBankId) {
        return NextResponse.json({error: 'Configura la banca per questo metodo e canale di vendita'}, {status: 409});
    }
    const period = romePeriod(date);

    try {
        const receipt = await prisma.income.create({
            data: {
                workspaceId: current.workspace.id,
                companyId: current.company.id,
                customerId: customer.id,
                salesChannelId: channel.id,
                incomeCategoryId: category.id,
                description: 'Incasso da banco',
                amount: input.amount,
                paymentMethodId: method.id,
                creditBankId,
                orderDate: date,
                creditDate: date,
                isCredited: true,
                billingYear: period.year,
                billingMonth: period.month,
                isFiscal: input.isFiscal,
                invoiceStatus: input.isFiscal ? 'EMESSA' : null,
                vatRate,
                incomeType: 'CASH_REGISTER',
                cashRegisterRequestId: input.requestId,
                credits: {create: {creditDate: date, paymentMethodId: method.id, bankId: creditBankId, amount: input.amount}}
            },
            include: {paymentMethodRef: true}
        });
        await writeAuditLog({
            workspaceId: current.workspace.id,
            userId: current.user.id,
            action: 'CREATE',
            entityType: 'CashRegisterReceipt',
            entityId: receipt.id,
            metadata: {amount: input.amount, isFiscal: input.isFiscal, requestId: input.requestId},
            request
        });
        return NextResponse.json({receipt}, {status: 201});
    } catch (error: unknown) {
        const existing = await prisma.income.findFirst({
            where: {workspaceId: current.workspace.id, companyId: current.company.id, cashRegisterRequestId: input.requestId},
            include: {paymentMethodRef: true}
        });
        if (existing) return NextResponse.json({receipt: existing, duplicate: true});
        throw error;
    }
}
