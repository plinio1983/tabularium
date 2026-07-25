import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getWorkspaceContext} from '@/lib/auth';
import {prisma} from '@/lib/prisma';

const UpdateSchema = z.object({
    amount: z.coerce.number().positive(),
    isFiscal: z.boolean(),
    vatRate: z.coerce.number(),
    creditDate: z.string().datetime(),
    salesChannelId: z.coerce.number().int().positive(),
    paymentMethodId: z.coerce.number().int().positive()
});

function romePeriod(date: Date) {
    const values = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Rome', year: 'numeric', month: 'numeric'
    }).formatToParts(date);
    return {
        year: Number(values.find(item => item.type === 'year')?.value),
        month: Number(values.find(item => item.type === 'month')?.value)
    };
}

export async function PATCH(request: Request, {params}: { params: Promise<{ id: string }> }) {
    const current = await getWorkspaceContext();
    if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
    const id = Number((await params).id);
    const parsed = UpdateSchema.safeParse(await request.json());
    if (!Number.isInteger(id) || !parsed.success) return NextResponse.json({error: 'Dati non validi'}, {status: 400});
    const input = parsed.data;
    const vatRate = input.isFiscal ? input.vatRate : 0;
    if (![0, 4, 10, 22].includes(vatRate)) return NextResponse.json({error: 'Aliquota non valida'}, {status: 400});
    const date = new Date(input.creditDate);
    const [receipt, channel, method] = await Promise.all([
        prisma.income.findFirst({where: {id, workspaceId: current.workspace.id, incomeType: 'CASH_REGISTER'}}),
        prisma.incomeSalesChannel.findFirst({where: {id: input.salesChannelId, workspaceId: current.workspace.id}}),
        prisma.paymentMethod.findFirst({
            where: {id: input.paymentMethodId, workspaceId: current.workspace.id, cashRegisterEnabled: true}
        })
    ]);
    if (!receipt) return NextResponse.json({error: 'Scontrino non trovato'}, {status: 404});
    if (!channel || !method?.cashRegisterDefaultBankId) return NextResponse.json({error: 'Configurazione non valida'}, {status: 409});
    const period = romePeriod(date);
    const updated = await prisma.income.update({
        where: {id},
        data: {
            amount: input.amount,
            isFiscal: input.isFiscal,
            vatRate,
            invoiceStatus: input.isFiscal ? 'EMESSA' : null,
            creditDate: date,
            billingYear: period.year,
            billingMonth: period.month,
            salesChannelId: channel.id,
            paymentMethodId: method.id,
            creditBankId: method.cashRegisterDefaultBankId
        }
    });
    return NextResponse.json({receipt: updated});
}

export async function DELETE(_: Request, {params}: { params: Promise<{ id: string }> }) {
    const current = await getWorkspaceContext();
    if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return NextResponse.json({error: 'ID non valido'}, {status: 400});
    const result = await prisma.income.deleteMany({
        where: {id, workspaceId: current.workspace.id, incomeType: 'CASH_REGISTER'}
    });
    if (!result.count) return NextResponse.json({error: 'Scontrino non trovato'}, {status: 404});
    return NextResponse.json({ok: true});
}
