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
  return pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/suppliers');
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

  if (action === 'delete') {
    const protectedCount = await prisma.supplier.count({ where: { id: { in: ids }, workspaceId: current.workspace.id, systemRole: { not: null } } });
    if (protectedCount > 0) return redirectToPath(appendFlash(redirectTo, { error: 'system_protected' }));
    const linkedUsage = await prisma.expense.count({ where: { supplierId: { in: ids }, workspaceId: current.workspace.id } })
      + await prisma.recurringExpense.count({ where: { supplierId: { in: ids }, workspaceId: current.workspace.id } });
    if (linkedUsage > 0) {
      return redirectToPath(appendFlash(redirectTo, { error: 'in_use', usage: String(linkedUsage) }));
    }
    const deleted = await prisma.supplier.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id } });
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_DELETE',
      entityType: 'Supplier', metadata: { ids, deleted: deleted.count }, request
    });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_deleted' }));
  }

  return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
}
