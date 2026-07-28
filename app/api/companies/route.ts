import {NextResponse} from 'next/server';
import {getWorkspaceContext} from '@/lib/auth';

export async function GET() {
    const current = await getWorkspaceContext();
    if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
    return NextResponse.json({
        activeCompanyId: current.company.id,
        companies: current.companies.map(company => ({id: company.id, name: company.name}))
    });
}
