import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const data = await request.formData();
  const ids = data.getAll('ids').map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0);
  const returnTo = pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/recurring-incomes');
  if (ids.length && String(data.get('bulkAction') || '') === 'delete') {
    const result = await prisma.recurringIncome.updateMany({
      where: {id: {in: ids}, workspaceId: access.current.workspace.id, companyId: access.current.company.id},
      data: {isActive: false}
    });
    await writeAuditLog({workspaceId: access.current.workspace.id, userId: access.current.user.id, action: 'BULK_UPDATE', entityType: 'RecurringIncome', metadata: {ids, archived: result.count}, request});
    return redirectToPath(appendFlash(returnTo, {saved: 'bulk_deleted'}));
  }
  return redirectToPath(returnTo);
}
