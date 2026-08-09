import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {writeAuditLog} from '@/lib/audit';
import {yearMonthInTimeZone} from '@/lib/company-time';

const UpdateSchema = z.object({
    amount: z.coerce.number().positive(),
    isFiscal: z.boolean(),
    vatRate: z.coerce.number(),
    creditDate: z.string().datetime(),
    salesChannelId: z.coerce.number().int().positive(),
    description: z.string().trim().max(200).optional(),
    paymentMethodId: z.coerce.number().int().positive(),
    bankId: z.coerce.number().int().positive()
});

export async function PATCH(request: Request, {params}: { params: Promise<{ id: string }> }) {
    const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
    if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
    const current = access.current;
    const id = Number((await params).id);
    const parsed = UpdateSchema.safeParse(await request.json());
    if (!Number.isInteger(id) || !parsed.success) return NextResponse.json({error: 'Dati non validi'}, {status: 400});
    const input = parsed.data;
    const vatRate = input.isFiscal ? input.vatRate : 0;
    if (![0, 4, 10, 22].includes(vatRate)) return NextResponse.json({error: 'Aliquota non valida'}, {status: 400});
    const date = new Date(input.creditDate);
    const [receipt, channel, method, bank] = await Promise.all([
        prisma.income.findFirst({where: {id, workspaceId: current.workspace.id, companyId: current.company.id, incomeType: 'CASH_REGISTER'}}),
        prisma.incomeSalesChannel.findFirst({where: {id: input.salesChannelId, workspaceId: current.workspace.id}}),
        prisma.paymentMethod.findFirst({
            where: {id: input.paymentMethodId, workspaceId: current.workspace.id, cashRegisterEnabled: true, kind: {in: ['INCOME', 'BOTH']}}
        }),
        prisma.bank.findFirst({where: {id: input.bankId, workspaceId: current.workspace.id}})
    ]);
    if (!receipt) return NextResponse.json({error: 'Scontrino non trovato'}, {status: 404});
    if (!channel || !method || !bank) return NextResponse.json({error: 'Configurazione non valida'}, {status: 409});
    if (!input.isFiscal && method.systemRole !== 'CASH') {
        return NextResponse.json({error: 'Gli incassi non fiscali possono essere registrati solo in contanti'}, {status: 400});
    }
    const creditBankId = bank.id;
    const period = yearMonthInTimeZone(current.company.timeZone, date);
    const updated = await prisma.income.update({
        where: {id},
        data: {
            amount: input.amount,
            description: input.description || 'Incasso da banco',
            isFiscal: input.isFiscal,
            vatRate,
            invoiceStatus: input.isFiscal ? 'EMESSA' : null,
            orderDate: date,
            creditDate: date,
            billingYear: period.year,
            billingMonth: period.month,
            salesChannelId: channel.id,
            paymentMethodId: method.id,
            creditBankId,
            isCredited: true,
            dueDate: null,
            credits: {
                deleteMany: {},
                create: {creditDate: date, paymentMethodId: method.id, bankId: creditBankId, amount: input.amount}
            }
        }
    });
    await writeAuditLog({
        workspaceId: current.workspace.id, userId: current.user.id, action: 'UPDATE',
        entityType: 'CashRegisterReceipt', entityId: id,
        metadata: {amount: input.amount, isFiscal: input.isFiscal, description: input.description || null}, request
    });
    return NextResponse.json({receipt: updated});
}

export async function DELETE(request: Request, {params}: { params: Promise<{ id: string }> }) {
    const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
    if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
    const current = access.current;
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return NextResponse.json({error: 'ID non valido'}, {status: 400});
    const result = await prisma.income.deleteMany({
        where: {id, workspaceId: current.workspace.id, companyId: current.company.id, incomeType: 'CASH_REGISTER'}
    });
    if (!result.count) return NextResponse.json({error: 'Scontrino non trovato'}, {status: 404});
    await writeAuditLog({
        workspaceId: current.workspace.id, userId: current.user.id, action: 'DELETE',
        entityType: 'CashRegisterReceipt', entityId: id, request
    });
    return NextResponse.json({ok: true});
}
