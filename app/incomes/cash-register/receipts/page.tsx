import Link from 'next/link';
import CashRegisterReceiptList from '@/components/CashRegisterReceiptList';
import {requireWorkspace} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {orderPaymentMethods} from '@/lib/workspace-defaults';
import CashRegisterReceiptTrendChart from '@/components/CashRegisterReceiptTrendChart';
import {buildDailyReceiptTrend, buildDailyReceiptTrendRange} from '@/lib/cash-register-trend';
import {Prisma} from '@/generated/prisma/client';
import CashRegisterReceiptFiltersDrawer from '@/components/CashRegisterReceiptFiltersDrawer';
import SelectedButtonGroupScroller from '@/components/SelectedButtonGroupScroller';
import {addCalendarDays, monthInputInTimeZone, yearMonthInTimeZone, zonedMidnightUtc} from '@/lib/company-time';
import YearNavigationSelect from '@/components/YearNavigationSelect';

function value(params: Record<string, string | string[] | undefined>, key: string) {
    const item = params[key];
    return Array.isArray(item) ? item[0] ?? '' : item ?? '';
}

function dateInput(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? '' : value;
}

export const dynamic = 'force-dynamic';

export default async function CashRegisterReceiptsPage({searchParams}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspace('/incomes/cash-register/receipts');
    const params = (await searchParams) ?? {};
    const timeZone = current.company.timeZone;
    const currentPeriod = yearMonthInTimeZone(timeZone);
    const month = value(params, 'month') || monthInputInTimeZone(timeZone);
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
    const billingYear = match ? Number(match[1]) : currentPeriod.year;
    const billingMonth = match ? Number(match[2]) : currentPeriod.month;
    const methodFilter = methodId ? Prisma.sql`AND "paymentMethodId" = ${methodId}` : Prisma.empty;
    const channelFilter = channelId ? Prisma.sql`AND "salesChannelId" = ${channelId}` : Prisma.empty;
    const fiscalFilter = fiscal === 'yes'
        ? Prisma.sql`AND "isFiscal" = true`
        : fiscal === 'no'
            ? Prisma.sql`AND "isFiscal" = false`
            : Prisma.empty;
    const periodSqlFilter = hasCustomDateRange
        ? Prisma.sql`AND (("creditDate" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date BETWEEN ${dateFrom}::date AND ${dateTo}::date`
        : Prisma.sql`AND "billingYear" = ${billingYear} AND "billingMonth" = ${billingMonth}`;
    const creditDateFilter = hasCustomDateRange ? {
        gte: zonedMidnightUtc(dateFrom, timeZone),
        lt: zonedMidnightUtc(addCalendarDays(dateTo, 1), timeZone),
    } : undefined;

    const [receipts, methods, channels, dailyAggregates, receiptYearBounds] = await Promise.all([
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
                to_char((("creditDate" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date, 'YYYY-MM-DD') AS day,
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
        `),
        prisma.income.aggregate({
            where: {workspaceId: current.workspace.id, companyId: current.company.id, incomeType: 'CASH_REGISTER'},
            _min: {billingYear: true, creditDate: true}
        })
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
    const firstAvailableYear = Math.min(
        billingYear,
        currentPeriod.year,
        ...[
            receiptYearBounds._min.billingYear,
            receiptYearBounds._min.creditDate?.getUTCFullYear()
        ].filter((item): item is number => Number.isInteger(item))
    );
    const lastAvailableYear = Math.max(billingYear, currentPeriod.year);
    const yearLinks = Array.from({length: lastAvailableYear - firstAvailableYear + 1}, (_, index) => lastAvailableYear - index)
        .map(navYear => {
            const navMonth = navYear === currentPeriod.year ? Math.min(billingMonth, currentPeriod.month) : billingMonth;
            const query = new URLSearchParams({month: `${navYear}-${String(navMonth).padStart(2, '0')}`});
            if (methodId) query.set('paymentMethodId', String(methodId));
            if (channelId) query.set('salesChannelId', String(channelId));
            if (fiscal === 'yes' || fiscal === 'no') query.set('fiscal', fiscal);
            return {year: navYear, href: `/incomes/cash-register/receipts?${query}`};
        });
    const returnQuery = new URLSearchParams();
    if (month) returnQuery.set('month', month);
    if (rawDateFrom) returnQuery.set('dateFrom', rawDateFrom);
    if (rawDateTo) returnQuery.set('dateTo', rawDateTo);
    if (methodId) returnQuery.set('paymentMethodId', String(methodId));
    if (channelId) returnQuery.set('salesChannelId', String(channelId));
    if (fiscal === 'yes' || fiscal === 'no') returnQuery.set('fiscal', fiscal);
    const receiptListReturnTo = `/incomes/cash-register/receipts${returnQuery.size ? `?${returnQuery}` : ''}`;

    return <div className="grid cash-register-receipts-page">
        <div className="toolbar-card">
            <div><h2>Scontrini registratore</h2><p className="muted">{receiptCount} movimenti · {total.toLocaleString('it-IT', {style: 'currency', currency: 'EUR'})}</p></div>
            <div className="toolbar-actions">
                <Link className="btn btn-sm btn-default" href="/incomes"><span className="btn-icon">↩</span>Torna a Incassi</Link>
                <Link className="btn btn-sm btn-secondary" href="/incomes/cash-register">🧮 Reg. di cassa</Link>
            </div>
        </div>
        <nav className="cash-register-receipt-period-nav" aria-label={`Mesi del ${billingYear}`}>
            <SelectedButtonGroupScroller className="btn-group cash-register-receipt-month-group" showControls wrapperClassName="cash-register-receipt-month-scroller">
                {monthLinks.map(item => <Link key={item.label} className={`btn btn-sm ${item.selected ? 'btn-primary is-selected' : 'btn-default'}`} aria-current={item.selected ? 'page' : undefined} href={item.href}>{item.label}</Link>)}
            </SelectedButtonGroupScroller>
            <YearNavigationSelect options={yearLinks} year={billingYear}/>
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
            returnTo={receiptListReturnTo}
            filtersTrigger={<CashRegisterReceiptFiltersDrawer month={month} dateFrom={rawDateFrom} dateTo={rawDateTo} paymentMethodId={methodId} salesChannelId={channelId} fiscal={fiscal} paymentMethods={orderedMethods} salesChannels={channels}/>}
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
