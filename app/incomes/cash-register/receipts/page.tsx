import LiveSearch from '@/components/LiveSearch';
import Link from 'next/link';
import CashRegisterReceiptList from '@/components/CashRegisterReceiptList';
import {requireWorkspace} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {orderPaymentMethods} from '@/lib/workspace-defaults';
import CashRegisterReceiptTrendChart from '@/components/CashRegisterReceiptTrendChart';
import {buildDailyReceiptTrendRange, buildMonthlyReceiptTrend} from '@/lib/cash-register-trend';
import {Prisma} from '@/generated/prisma/client';
import CashRegisterReceiptFiltersDrawer from '@/components/CashRegisterReceiptFiltersDrawer';
import CashRegisterReceiptPeriodSelector from '@/components/CashRegisterReceiptPeriodSelector';
import {resolveReceiptPeriod, receiptPeriodParams} from '@/lib/receipt-period';
import {addCalendarDays, dateInputInTimeZone, yearMonthInTimeZone, zonedMidnightUtc} from '@/lib/company-time';

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
    const search = value(params, 'search').trim();
    const searchSqlFilter = search ? Prisma.sql`AND strpos(lower(coalesce(description, '')), lower(${search})) > 0` : Prisma.empty;
    const timeZone = current.company.timeZone;
    const currentPeriod = yearMonthInTimeZone(timeZone);
    const period = resolveReceiptPeriod(params, dateInputInTimeZone(timeZone));
    const {from: dateFrom, to: dateTo, annual, year: billingYear} = period;
    const methodId = Number(value(params, 'paymentMethodId')) || null;
    const channelId = Number(value(params, 'salesChannelId')) || null;
    const fiscal = value(params, 'fiscal');
    const methodFilter = methodId ? Prisma.sql`AND "paymentMethodId" = ${methodId}` : Prisma.empty;
    const channelFilter = channelId ? Prisma.sql`AND "salesChannelId" = ${channelId}` : Prisma.empty;
    const fiscalFilter = fiscal === 'yes'
        ? Prisma.sql`AND "isFiscal" = true`
        : fiscal === 'no'
            ? Prisma.sql`AND "isFiscal" = false`
            : Prisma.empty;
    const creditDateFilter = {
        gte: zonedMidnightUtc(dateFrom, timeZone),
        lt: zonedMidnightUtc(addCalendarDays(dateTo, 1), timeZone),
    };
    const periodSqlFilter = Prisma.sql`AND "creditDate" >= ${creditDateFilter.gte} AND "creditDate" < ${creditDateFilter.lt}`;

    const [receipts, methods, channels, dailyAggregates, receiptYearBounds] = await Promise.all([
        prisma.income.findMany({
            where: {
            workspaceId: current.workspace.id,
            companyId: current.company.id,
                incomeType: 'CASH_REGISTER',
                ...(search ? {description: {contains: search.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' as const}} : {}),
                creditDate: creditDateFilter,
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
              ${searchSqlFilter}
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
    const trend = annual ? buildMonthlyReceiptTrend(billingYear, aggregates) : buildDailyReceiptTrendRange(dateFrom, dateTo, aggregates);
    const total = trend.reduce((sum, point) => sum + point.total, 0);
    const receiptCount = trend.reduce((sum, point) => sum + point.count, 0);
    const selectedMethod = orderedMethods.find(item => item.id === methodId);
    const selectedChannel = channels.find(item => item.id === channelId);
    const activeFilters = [
        ...(search ? [{label: 'Ricerca', value: search}] : []),
        {label: 'Periodo', value: `${new Date(`${dateFrom}T12:00:00Z`).toLocaleDateString('it-IT', {timeZone: 'UTC'})} – ${new Date(`${dateTo}T12:00:00Z`).toLocaleDateString('it-IT', {timeZone: 'UTC'})}`},
        ...(selectedMethod ? [{label: 'Metodo', value: `${selectedMethod.icon ? `${selectedMethod.icon} ` : ''}${selectedMethod.name}`}] : []),
        ...(selectedChannel ? [{label: 'Canale', value: `${selectedChannel.icon ? `${selectedChannel.icon} ` : ''}${selectedChannel.name}`}] : []),
        ...(fiscal === 'yes' ? [{label: 'Fiscalità', value: 'Fiscali'}] : fiscal === 'no' ? [{label: 'Fiscalità', value: 'Non fiscali'}] : []),
    ];
    const firstAvailableYear = Math.min(
        billingYear,
        currentPeriod.year,
        ...[
            receiptYearBounds._min.billingYear,
            receiptYearBounds._min.creditDate?.getUTCFullYear()
        ].filter((item): item is number => Number.isInteger(item))
    );
    const lastAvailableYear = Math.max(billingYear, currentPeriod.year);
    const years = Array.from({length: lastAvailableYear - firstAvailableYear + 1}, (_, index) => String(lastAvailableYear - index));
    const returnQuery = receiptPeriodParams('', period.quick, String(billingYear));
    if (search) returnQuery.set('search', search);
    if (period.quick === 'custom') {
        returnQuery.set('dateFrom', dateFrom);
        returnQuery.set('dateTo', dateTo);
    }
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
        <CashRegisterReceiptTrendChart key={`${dateFrom}-${dateTo}-${annual}`} points={trend} annual={annual}
            periodSelector={<CashRegisterReceiptPeriodSelector key="receipt-period" dateQuick={period.quick} dateYear={String(billingYear)} years={years}/>}/>
        <CashRegisterReceiptList
            headerContent={<>
                <div className="recurring-active-filters">
                    <div>
                        <span className="recurring-active-filters-title">Filtri attivi</span>
                        <div className="recurring-active-filter-tags">{activeFilters.map(item =>
                            <span className="badge" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>)}</div>
                    </div>
                    <Link className="btn btn-xs btn-neutral recurring-active-filters-reset" href="/incomes/cash-register/receipts"><span className="btn-icon">×</span> Reset</Link>
                </div>
                <LiveSearch name="search" label="Ricerca scontrino" placeholder="Descrizione scontrino"/>
            </>}
            returnTo={receiptListReturnTo}
            filtersTrigger={<CashRegisterReceiptFiltersDrawer key="receipt-filters" search={search} dateQuick={period.quick} dateYear={String(billingYear)} years={years} dateFrom={dateFrom} dateTo={dateTo} paymentMethodId={methodId} salesChannelId={channelId} fiscal={fiscal} paymentMethods={orderedMethods} salesChannels={channels}/>}
            receipts={receipts.map(receipt => ({
                id: receipt.id,
                description: receipt.description,
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
