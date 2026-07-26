import {redirect} from 'next/navigation';
import CashRegister from '@/components/CashRegister';
import {requireWorkspace} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {ensureWorkspaceDefaults, orderPaymentMethods} from '@/lib/workspace-defaults';

export const dynamic = 'force-dynamic';

function romeDateLocal(date: Date) {
    const values = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Rome',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => values.find(value => value.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
}

function paramValue(params: Record<string, string | string[] | undefined>, key: string) {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
}

export default async function CashRegisterPage({searchParams}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspace('/incomes/cash-register');
    await ensureWorkspaceDefaults(current.workspace.id);
    const params = (await searchParams) ?? {};
    const editId = Number(paramValue(params, 'editId')) || null;
    const copyId = Number(paramValue(params, 'copyId')) || null;
    const sourceId = editId ?? copyId;
    const [workspace, methods, channels, sourceReceipt] = await Promise.all([
        prisma.workspace.findUnique({
            where: {id: current.workspace.id},
            select: {cashRegisterSalesChannelId: true, cashRegisterPrimaryPaymentMethodId: true}
        }),
        prisma.paymentMethod.findMany({
            where: {
                workspaceId: current.workspace.id,
                cashRegisterEnabled: true,
                kind: {in: ['INCOME', 'BOTH']}
            }
        }),
        prisma.incomeSalesChannel.findMany({
            where: {workspaceId: current.workspace.id},
            orderBy: [{sortOrder: 'asc'}, {name: 'asc'}]
        }),
        sourceId ? prisma.income.findFirst({
            where: {id: sourceId, workspaceId: current.workspace.id, incomeType: 'CASH_REGISTER'}
        }) : null
    ]);
    if (sourceId && !sourceReceipt) redirect('/incomes/cash-register/receipts');
    if (!workspace?.cashRegisterSalesChannelId || !methods.length || !channels.length) {
        redirect('/settings/payment-credit?error=cash_register_invalid');
    }
    return <CashRegister
        methods={orderPaymentMethods(methods, 'INCOME').map(method => ({
            id: method.id,
            name: method.name,
            icon: method.icon,
            systemRole: method.systemRole
        }))}
        channels={channels.map(channel => ({
            id: channel.id,
            name: channel.name,
            icon: channel.icon
        }))}
        defaultChannelId={workspace.cashRegisterSalesChannelId}
        primaryMethodId={workspace.cashRegisterPrimaryPaymentMethodId}
        initialDate={romeDateLocal(sourceReceipt?.creditDate ?? new Date())}
        mode={editId ? 'edit' : copyId ? 'copy' : 'create'}
        initialReceipt={sourceReceipt ? {
            id: sourceReceipt.id,
            amount: Number(sourceReceipt.amount),
            isFiscal: sourceReceipt.isFiscal,
            vatRate: Number(sourceReceipt.vatRate),
            salesChannelId: sourceReceipt.salesChannelId,
            paymentMethodId: sourceReceipt.paymentMethodId
        } : null}
    />;
}
