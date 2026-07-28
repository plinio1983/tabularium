import {NextResponse} from 'next/server';
import {getWorkspaceContext} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {pathFromUrl} from '@/lib/redirect';
import {writeAuditLog} from '@/lib/audit';

export async function POST(request: Request) {
    const current = await getWorkspaceContext();
    if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
    const formData = await request.formData();
    const companyId = Number(formData.get('companyId'));
    const company = await prisma.company.findFirst({
        where: {id: companyId, workspaceId: current.workspace.id, isActive: true}
    });
    if (!company) return NextResponse.json({error: 'Società non valida'}, {status: 400});
    await prisma.authSession.update({
        where: {id: current.session.id},
        data: {activeCompanyId: company.id}
    });
    await writeAuditLog({
        workspaceId: current.workspace.id,
        userId: current.user.id,
        action: 'SWITCH',
        entityType: 'Company',
        entityId: company.id,
        metadata: {
            previousCompanyId: current.company.id,
            previousCompanyName: current.company.name,
            companyName: company.name
        },
        request
    });
    const returnTo = pathFromUrl(String(formData.get('returnTo') || '/'), '/');
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
}
