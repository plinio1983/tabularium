import {NextResponse} from 'next/server';
import {getWorkspaceContext} from '@/lib/auth';
import {prisma} from '@/lib/prisma';

export async function GET(request: Request) {
    const current = await getWorkspaceContext();
    if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
    const companies = new URL(request.url).searchParams.get('includeInactive') === 'true'
        ? await prisma.company.findMany({
            where: {workspaceId: current.workspace.id},
            select: {id: true, name: true, isActive: true},
            orderBy: [{isDefault: 'desc'}, {name: 'asc'}, {id: 'asc'}]
        }) : current.companies;
    return NextResponse.json({
        activeCompanyId: current.company.id,
        companies: companies.map(company => ({id: company.id, name: company.name, isActive: company.isActive}))
    }, {headers: {'Cache-Control': 'no-store'}});
}
