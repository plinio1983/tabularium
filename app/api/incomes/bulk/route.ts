import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';

function selectedIds(formData: FormData) {
  return formData.getAll('ids').map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0);
}

function safeReturnTo(request: Request) {
  return pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/incomes');
}

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  const formData = await request.formData();
  const action = String(formData.get('bulkAction') || '');
  const ids = selectedIds(formData);
  const redirectTo = safeReturnTo(request);

  if (!ids.length || !action) {
    return redirectToPath(redirectTo);
  }

  if (action === 'change_category') {
    const incomeCategoryId = Number(formData.get('incomeCategoryId'));
    const category = Number.isInteger(incomeCategoryId) ? await prisma.incomeCategory.findFirst({
      where: { id: incomeCategoryId, workspaceId: current.workspace.id }
    }) : null;
    if (category) {
      await prisma.income.updateMany({
        where: { id: { in: ids }, workspaceId: current.workspace.id },
        data: { incomeCategoryId: category.id }
      });
      await writeAuditLog({
        workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE',
        entityType: 'Income', metadata: { ids, operation: action, incomeCategoryId }, request
      });
    }
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
  }

  if (action === 'delete') {
    const deleted = await prisma.income.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id } });
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_DELETE',
      entityType: 'Income', metadata: { ids, deleted: deleted.count }, request
    });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_deleted' }));
  }

  if (action === 'invoice_emitted') {
    await prisma.income.updateMany({ where: { id: { in: ids }, workspaceId: current.workspace.id, isFiscal: true }, data: { invoiceStatus: 'EMESSA' } });
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE',
      entityType: 'Income', metadata: { ids, operation: action }, request
    });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
  }

  return redirectToPath(redirectTo);
}
