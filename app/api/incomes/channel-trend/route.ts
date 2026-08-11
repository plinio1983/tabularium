import {NextResponse} from 'next/server';
import {getWorkspaceContext} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {aggregateIncomeChannelTrend} from '@/lib/income-channel-trend';
import {zonedMidnightUtc} from '@/lib/company-time';

export async function GET(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
  const year = Number(new URL(request.url).searchParams.get('year'));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return NextResponse.json({error: 'Anno non valido'}, {status: 400});
  const records = await prisma.income.findMany({
    where: {workspaceId: current.workspace.id, companyId: current.company.id, creditDate: {gte: zonedMidnightUtc(`${year}-01-01`, current.company.timeZone), lt: zonedMidnightUtc(`${year + 1}-01-01`, current.company.timeZone)}},
    select: {amount: true, creditDate: true, salesChannelId: true, salesChannelRef: {select: {name: true, icon: true}}},
  });
  return NextResponse.json(aggregateIncomeChannelTrend(records, year, current.company.timeZone));
}
