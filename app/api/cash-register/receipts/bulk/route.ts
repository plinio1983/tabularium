import {NextResponse} from 'next/server';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {pathFromUrl, redirectToPath} from '@/lib/redirect';
import {writeAuditLog} from '@/lib/audit';

function selectedIds(formData: FormData) {
    return formData.getAll('ids')
        .map(value => Number(value))
        .filter(value => Number.isInteger(value) && value > 0);
}

export async function POST(request: Request) {
    const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
    if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
    const current = access.current;
    const formData = await request.formData();
    const returnTo = pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/incomes/cash-register/receipts');
    if (String(formData.get('bulkAction') ?? '') !== 'delete') return redirectToPath(returnTo);
    const ids = selectedIds(formData);
    if (ids.length) {
        const deleted = await prisma.income.deleteMany({
            where: {
                id: {in: ids},
                workspaceId: current.workspace.id,
                companyId: current.company.id,
                incomeType: 'CASH_REGISTER'
            }
        });
        await writeAuditLog({
            workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_DELETE',
            entityType: 'CashRegisterReceipt', metadata: {ids, deleted: deleted.count}, request
        });
    }
    return redirectToPath(returnTo);
}
