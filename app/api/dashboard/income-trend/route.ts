import {NextResponse} from 'next/server';
import {getWorkspaceContext} from '@/lib/auth';
import {getIncomeTrendData, type IncomeTrendInterval} from '@/lib/income-trend';

export async function GET(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});

  const params = new URL(request.url).searchParams;
  const year = Number(params.get('year'));
  const rawInterval = params.get('interval');
  const completedOnly = params.get('completed') === '1';
  const interval: IncomeTrendInterval = rawInterval === 'day' || rawInterval === 'week' ? rawInterval : 'month';
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({error: 'Anno non valido'}, {status: 400});
  }

  return NextResponse.json(await getIncomeTrendData(year, interval, current.workspace.id, current.company.id, completedOnly, current.company.timeZone));
}
