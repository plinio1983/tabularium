import { NextResponse } from 'next/server';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { prisma } from '@/lib/prisma';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  const formData = await request.formData();
  const ids = formData.getAll('ids').map(Number).filter(id => Number.isInteger(id) && id > 0);
  const returnTo = pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/clients');
  if (!ids.length || formData.get('bulkAction') !== 'delete') return redirectToPath(returnTo);
  const where = { id: { in: ids }, workspaceId: current.workspace.id };
  const protectedCount = await prisma.customer.count({ where: { ...where, systemRole: { not: null } } });
  const linked = await prisma.income.count({ where: { customerId: { in: ids }, workspaceId: current.workspace.id } });
  if (protectedCount || linked) return redirectToPath(appendFlash(returnTo, { error: protectedCount ? 'system_protected' : 'in_use', usage: String(linked) }));
  const deleted = await prisma.customer.deleteMany({ where });
  await writeAuditLog({
    workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_DELETE',
    entityType: 'Customer', metadata: { ids, deleted: deleted.count }, request
  });
  return redirectToPath(appendFlash(returnTo, { saved: 'bulk_deleted' }));
}
