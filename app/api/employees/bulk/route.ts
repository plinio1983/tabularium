import {NextResponse} from 'next/server';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {appendFlash} from '@/lib/flash';
import {prisma} from '@/lib/prisma';
import {pathFromUrl, redirectToPath} from '@/lib/redirect';
import {writeAuditLog} from '@/lib/audit';

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const formData = await request.formData();
  const ids = formData.getAll('ids').map(Number).filter(id => Number.isInteger(id) && id > 0);
  const returnTo = pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/employees');
  if (!ids.length || formData.get('bulkAction') !== 'delete') return redirectToPath(returnTo);
  const deleted = await prisma.employee.deleteMany({where: {id: {in: ids}, workspaceId: access.current.workspace.id, companyId: access.current.company.id}});
  await writeAuditLog({workspaceId: access.current.workspace.id, userId: access.current.user.id, action: 'BULK_DELETE', entityType: 'Employee', metadata: {ids, deleted: deleted.count}, request});
  return redirectToPath(appendFlash(returnTo, {saved: 'bulk_deleted'}));
}
