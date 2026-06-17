import { NextResponse } from 'next/server';
import { getYearReport } from '@/lib/reports';
import { getWorkspaceContext } from '@/lib/auth';

export async function GET(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year') ?? 2026);
  return NextResponse.json(await getYearReport(year, current.workspace.id));
}
