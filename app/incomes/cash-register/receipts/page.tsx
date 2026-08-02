import Link from 'next/link';
import CashRegisterReceiptList from '@/components/CashRegisterReceiptList';
import {requireWorkspace} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {orderPaymentMethods} from '@/lib/workspace-defaults';
import CashRegisterReceiptTrendChart from '@/components/CashRegisterReceiptTrendChart';
import {buildDailyReceiptTrend, buildDailyReceiptTrendRange} from '@/lib/cash-register-trend';
import {Prisma} from '@/generated/prisma/client';
import CashRegisterReceiptFiltersDrawer from '@/components/CashRegisterReceiptFiltersDrawer';

function value(params: Record<string, string | string[] | undefined>, key: string) {
    const item = params[key];
    return Array.isArray(item) ? item[0] ?? '' : item ?? '';
}

function dateInput(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? '' : value;
}

function romeMidnightUtc(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(candidate);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value ?? 0);
    const representedAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
    return new Date(candidate.getTime() - (representedAsUtc - candidate.getTime()));
}

function nextDateInput(value: string) {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
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
    const rawDateFrom = dateInput(value(params, 'dateFrom'));
    const rawDateTo = dateInput(value(params, 'dateTo'));
    const firstDate = rawDateFrom || rawDateTo;
    const secondDate = rawDateTo || rawDateFrom;
    const dateFrom = firstDate && secondDate && firstDate > secondDate ? secondDate : firstDate;
    const dateTo = firstDate && secondDate && firstDate > secondDate ? firstDate : secondDate;
    const hasCustomDateRange = Boolean(dateFrom && dateTo);
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
    const periodSqlFilter = hasCustomDateRange
        ? Prisma.sql`AND (("creditDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Rome')::date BETWEEN ${dateFrom}::date AND ${dateTo}::date`
        : Prisma.sql`AND "billingYear" = ${billingYear} AND "billingMonth" = ${billingMonth}`;
    const creditDateFilter = hasCustomDateRange ? {
        gte: romeMidnightUtc(dateFrom),
        lt: romeMidnightUtc(nextDateInput(dateTo)),
    } : undefined;

    const [receipts, methods, channels, dailyAggregates] = await Promise.all([
        prisma.income.findMany({
            where: {
            workspaceId: current.workspace.id,
            companyId: current.company.id,
                incomeType: 'CASH_REGISTER',
                ...(hasCustomDateRange ? {creditDate: creditDateFilter} : {billingYear, billingMonth}),
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
              ${periodSqlFilter}
              ${methodFilter}
              ${channelFilter}
              ${fiscalFilter}
            GROUP BY 1
            ORDER BY 1
        `)
    ]);
    const orderedMethods = orderPaymentMethods(methods, 'INCOME');
    const aggregates = dailyAggregates.map(item => ({day: item.day, count: item.count, total: Number(item.total)}));
    const trend = hasCustomDateRange
        ? buildDailyReceiptTrendRange(dateFrom, dateTo, aggregates)
        : buildDailyReceiptTrend(billingYear, billingMonth, aggregates);
    const total = trend.reduce((sum, point) => sum + point.total, 0);
    const receiptCount = trend.reduce((sum, point) => sum + point.count, 0);
    const selectedMethod = orderedMethods.find(item => item.id === methodId);
    const selectedChannel = channels.find(item => item.id === channelId);
    const activeFilters = [
        {label: 'Periodo', value: hasCustomDateRange
            ? `${new Date(`${dateFrom}T12:00:00Z`).toLocaleDateString('it-IT')} – ${new Date(`${dateTo}T12:00:00Z`).toLocaleDateString('it-IT')}`
            : new Intl.DateTimeFormat('it-IT', {month: 'long', year: 'numeric'}).format(new Date(billingYear, billingMonth - 1, 1))},
        ...(selectedMethod ? [{label: 'Metodo', value: `${selectedMethod.icon ? `${selectedMethod.icon} ` : ''}${selectedMethod.name}`}] : []),
        ...(selectedChannel ? [{label: 'Canale', value: `${selectedChannel.icon ? `${selectedChannel.icon} ` : ''}${selectedChannel.name}`}] : []),
        ...(fiscal === 'yes' ? [{label: 'Fiscalità', value: 'Fiscali'}] : fiscal === 'no' ? [{label: 'Fiscalità', value: 'Non fiscali'}] : []),
    ];
    const monthLinks = Array.from({length: 12}, (_, index) => {
        const query = new URLSearchParams({month: `${billingYear}-${String(index + 1).padStart(2, '0')}`});
        if (methodId) query.set('paymentMethodId', String(methodId));
        if (channelId) query.set('salesChannelId', String(channelId));
        if (fiscal === 'yes' || fiscal === 'no') query.set('fiscal', fiscal);
        const label = new Intl.DateTimeFormat('it-IT', {month: 'short'}).format(new Date(billingYear, index, 1)).replace('.', '');
        return {
            href: `/incomes/cash-register/receipts?${query}`,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            selected: !hasCustomDateRange && index + 1 === billingMonth,
        };
    });

    return <div className="grid cash-register-receipts-page">
        <div className="toolbar-card">
            <div><h2>Scontrini registratore</h2><p className="muted">{receiptCount} movimenti · {total.toLocaleString('it-IT', {style: 'currency', currency: 'EUR'})}</p></div>
            <div className="toolbar-actions">
                <Link className="btn btn-md btn-default" href="/incomes"><span className="btn-icon">↩</span>Torna a Incassi</Link>
                <Link className="btn btn-sm btn-secondary" href="/incomes/cash-register">🧮 Reg. di cassa</Link>
            </div>
        </div>
        <nav className="cash-register-receipt-period-nav" aria-label={`Mesi del ${billingYear}`}>
            <div className="btn-group cash-register-receipt-month-group">
                {monthLinks.map(item => <Link key={item.label} className={`btn btn-sm ${item.selected ? 'btn-primary is-selected' : 'btn-default'}`} aria-current={item.selected ? 'page' : undefined} href={item.href}>{item.label}</Link>)}
            </div>
            <div className="cash-register-receipt-filter-trigger">
                <CashRegisterReceiptFiltersDrawer month={month} dateFrom={rawDateFrom} dateTo={rawDateTo} paymentMethodId={methodId} salesChannelId={channelId} fiscal={fiscal} paymentMethods={orderedMethods} salesChannels={channels}/>
            </div>
        </nav>
        <div className="recurring-active-filters">
            <div>
                <span className="recurring-active-filters-title">Filtri attivi</span>
                <div className="recurring-active-filter-tags">{activeFilters.map(item =>
                    <span className="badge" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>)}</div>
            </div>
            <Link className="btn btn-xs btn-neutral recurring-active-filters-reset" href="/incomes/cash-register/receipts"><span className="btn-icon">×</span> Reset</Link>
        </div>
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
