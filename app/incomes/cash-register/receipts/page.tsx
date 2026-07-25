import Link from 'next/link';
import CashRegisterReceiptList from '@/components/CashRegisterReceiptList';
import {requireWorkspace} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {orderPaymentMethods} from '@/lib/workspace-defaults';

function value(params: Record<string, string | string[] | undefined>, key: string) {
    const item = params[key];
    return Array.isArray(item) ? item[0] ?? '' : item ?? '';
}

export const dynamic = 'force-dynamic';

export default async function CashRegisterReceiptsPage({searchParams}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspace('/incomes/cash-register/receipts');
    const params = (await searchParams) ?? {};
    const month = value(params, 'month') || new Date().toISOString().slice(0, 7);
    const methodId = Number(value(params, 'paymentMethodId')) || null;
    const channelId = Number(value(params, 'salesChannelId')) || null;
    const fiscal = value(params, 'fiscal');
    const match = month.match(/^(\d{4})-(\d{2})$/);
    const billingYear = match ? Number(match[1]) : new Date().getFullYear();
    const billingMonth = match ? Number(match[2]) : new Date().getMonth() + 1;

    const [receipts, methods, channels] = await Promise.all([
        prisma.income.findMany({
            where: {
                workspaceId: current.workspace.id,
                incomeType: 'CASH_REGISTER',
                billingYear,
                billingMonth,
                ...(methodId ? {paymentMethodId: methodId} : {}),
                ...(channelId ? {salesChannelId: channelId} : {}),
                ...(fiscal === 'yes' ? {isFiscal: true} : fiscal === 'no' ? {isFiscal: false} : {})
            },
            include: {paymentMethodRef: true, salesChannelRef: true},
            orderBy: [{creditDate: 'desc'}, {id: 'desc'}],
            take: 1000
        }),
        prisma.paymentMethod.findMany({
            where: {workspaceId: current.workspace.id, cashRegisterEnabled: true, kind: {in: ['INCOME', 'BOTH']}}
        }),
        prisma.incomeSalesChannel.findMany({where: {workspaceId: current.workspace.id}, orderBy: {name: 'asc'}})
    ]);
    const orderedMethods = orderPaymentMethods(methods, 'INCOME');
    const total = receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0);

    return <div className="grid cash-register-receipts-page">
        <div className="toolbar-card">
            <div><h2>Scontrini registratore</h2><p className="muted">{receipts.length} movimenti · {total.toLocaleString('it-IT', {style: 'currency', currency: 'EUR'})}</p></div>
            <div className="toolbar-actions">
                <Link className="btn btn-md btn-default" href="/incomes"><span className="btn-icon">↩</span>Torna a Incassi</Link>
                <Link className="btn btn-md btn-secondary" href="/incomes/cash-register">🧮 Reg. di cassa</Link>
            </div>
        </div>
        <form className="card cash-register-receipt-filters">
            <input type="month" name="month" defaultValue={month}/>
            <select name="paymentMethodId" defaultValue={methodId ?? ''}>
                <option value="">Tutti i metodi</option>
                {orderedMethods.map(method => <option value={method.id} key={method.id}>{method.icon ?? ''} {method.name}</option>)}
            </select>
            <select name="salesChannelId" defaultValue={channelId ?? ''}>
                <option value="">Tutti i canali</option>
                {channels.map(channel => <option value={channel.id} key={channel.id}>{channel.icon ?? ''} {channel.name}</option>)}
            </select>
            <select name="fiscal" defaultValue={fiscal}>
                <option value="">Fiscali e non fiscali</option>
                <option value="yes">Fiscali</option>
                <option value="no">Non fiscali</option>
            </select>
            <button className="btn btn-sm btn-primary" type="submit">Filtra</button>
        </form>
        <CashRegisterReceiptList
            receipts={receipts.map(receipt => ({
                id: receipt.id,
                amount: Number(receipt.amount),
                creditDate: receipt.creditDate.toISOString(),
                isFiscal: receipt.isFiscal,
                vatRate: Number(receipt.vatRate),
                salesChannelId: receipt.salesChannelId,
                paymentMethodId: receipt.paymentMethodId,
                salesChannel: receipt.salesChannelRef.name,
                salesChannelIcon: receipt.salesChannelRef.icon,
                paymentMethod: receipt.paymentMethodRef.name,
                paymentMethodIcon: receipt.paymentMethodRef.icon
            }))}
        />
    </div>;
}
