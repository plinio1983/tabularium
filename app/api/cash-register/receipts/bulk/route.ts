import {NextResponse} from 'next/server';
import {getWorkspaceContext} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {pathFromUrl, redirectToPath} from '@/lib/redirect';

function selectedIds(formData: FormData) {
    return formData.getAll('ids')
        .map(value => Number(value))
        .filter(value => Number.isInteger(value) && value > 0);
}

export async function POST(request: Request) {
    const current = await getWorkspaceContext();
    if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
    const formData = await request.formData();
    const returnTo = pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/incomes/cash-register/receipts');
    if (String(formData.get('bulkAction') ?? '') !== 'delete') return redirectToPath(returnTo);
    const ids = selectedIds(formData);
    if (ids.length) {
        await prisma.income.deleteMany({
            where: {
                id: {in: ids},
                workspaceId: current.workspace.id,
                incomeType: 'CASH_REGISTER'
            }
        });
    }
    return redirectToPath(returnTo);
}
