import {NextResponse} from 'next/server';
import {getWorkspaceContext} from '@/lib/auth';
import {searchDashboard} from '@/lib/dashboard-search';

export async function GET(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({error: 'Autenticazione richiesta.'}, {status: 401});
  const q = new URL(request.url).searchParams.get('q') ?? '';
  try {
    const groups = await searchDashboard(q, {workspaceId: current.workspace.id, companyId: current.company.id});
    return NextResponse.json({groups}, {headers: {'Cache-Control': 'private, no-store'}});
  } catch (error) {
    console.error('Dashboard search failed', error);
    return NextResponse.json({error: 'Ricerca non disponibile. Riprova.'}, {status: 500});
  }
}
