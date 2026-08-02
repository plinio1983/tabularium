import Link from 'next/link';
import CashRegisterReceiptList from '@/components/CashRegisterReceiptList';
import {requireWorkspace} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {orderPaymentMethods} from '@/lib/workspace-defaults';
import CashRegisterReceiptTrendChart from '@/components/CashRegisterReceiptTrendChart';
import {buildDailyReceiptTrend} from '@/lib/cash-register-trend';
import {Prisma} from '@/generated/prisma/client';

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
    const methodFilter = methodId ? Prisma.sql`AND "paymentMethodId" = ${methodId}` : Prisma.empty;
    const channelFilter = channelId ? Prisma.sql`AND "salesChannelId" = ${channelId}` : Prisma.empty;
    const fiscalFilter = fiscal === 'yes'
        ? Prisma.sql`AND "isFiscal" = true`
        : fiscal === 'no'
            ? Prisma.sql`AND "isFiscal" = false`
            : Prisma.empty;

    const [receipts, methods, channels, dailyAggregates] = await Promise.all([
        prisma.income.findMany({
            where: {
            workspaceId: current.workspace.id,
            companyId: current.company.id,
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
        prisma.incomeSalesChannel.findMany({where: {workspaceId: current.workspace.id}, orderBy: [{sortOrder: 'asc'}, {name: 'asc'}]}),
        prisma.$queryRaw<Array<{day: string; count: number; total: string}>>(Prisma.sql`
            SELECT
                to_char((("creditDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Rome')::date, 'YYYY-MM-DD') AS day,
                count(*)::int AS count,
                coalesce(sum(amount), 0)::text AS total
            FROM "Income"
            WHERE "workspaceId" = ${current.workspace.id}
              AND "companyId" = ${current.company.id}
              AND "incomeType" = 'CASH_REGISTER'
              AND "billingYear" = ${billingYear}
              AND "billingMonth" = ${billingMonth}
              ${methodFilter}
              ${channelFilter}
              ${fiscalFilter}
            GROUP BY 1
            ORDER BY 1
        `)
    ]);
    const orderedMethods = orderPaymentMethods(methods, 'INCOME');
    const trend = buildDailyReceiptTrend(
        billingYear,
        billingMonth,
        dailyAggregates.map(item => ({day: item.day, count: item.count, total: Number(item.total)})),
    );
    const total = trend.reduce((sum, point) => sum + point.total, 0);
    const receiptCount = trend.reduce((sum, point) => sum + point.count, 0);

    return <div className="grid cash-register-receipts-page">
        <div className="toolbar-card">
            <div><h2>Scontrini registratore</h2><p className="muted">{receiptCount} movimenti · {total.toLocaleString('it-IT', {style: 'currency', currency: 'EUR'})}</p></div>
            <div className="toolbar-actions">
                <Link className="btn btn-md btn-default" href="/incomes"><span className="btn-icon">↩</span>Torna a Incassi</Link>
                <Link className="btn btn-sm btn-secondary" href="/incomes/cash-register">🧮 Reg. di cassa</Link>
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
        <CashRegisterReceiptTrendChart points={trend}/>
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
