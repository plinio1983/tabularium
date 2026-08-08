import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {employeeInputSchema, employeePersistenceData} from '@/lib/employees';
import {appendFlash} from '@/lib/flash';
import {pathFromUrl, redirectToPath} from '@/lib/redirect';
import {writeAuditLog} from '@/lib/audit';

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const {id} = await params;
  const employeeId = Number(id);
  const returnTo = pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/employees');
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const employee = await prisma.employee.findFirst({where: {id: employeeId, workspaceId: access.current.workspace.id, companyId: access.current.company.id}, select: {id: true}});
  if (!employee) return redirectToPath(appendFlash(returnTo, {error: 'not_found'}));
  const action = String(raw._action || 'update');
  if (action === 'delete') {
    await prisma.employee.delete({where: {id: employeeId}});
    await writeAuditLog({workspaceId: access.current.workspace.id, userId: access.current.user.id, action: 'DELETE', entityType: 'Employee', entityId: employeeId, request});
    return redirectToPath(appendFlash('/employees', {saved: 'deleted'}));
  }
  if (action === 'deactivate' || action === 'activate') {
    const status = action === 'activate' ? 'ACTIVE' : 'INACTIVE';
    await prisma.employee.update({where: {id: employeeId}, data: {status}});
    await writeAuditLog({workspaceId: access.current.workspace.id, userId: access.current.user.id, action: 'UPDATE', entityType: 'Employee', entityId: employeeId, metadata: {status}, request});
    return redirectToPath(appendFlash(returnTo, {saved: status === 'ACTIVE' ? 'activated' : 'deactivated'}));
  }
  const parsed = employeeInputSchema.safeParse(raw);
  if (!parsed.success) return redirectToPath(appendFlash(returnTo, {error: 'invalid'}));
  if (parsed.data.employeeCode) {
    const duplicate = await prisma.employee.findFirst({where: {companyId: access.current.company.id, employeeCode: parsed.data.employeeCode, NOT: {id: employeeId}}, select: {id: true}});
    if (duplicate) return redirectToPath(appendFlash(returnTo, {error: 'duplicate_code'}));
  }
  await prisma.employee.update({where: {id: employeeId}, data: employeePersistenceData(parsed.data)});
  await writeAuditLog({workspaceId: access.current.workspace.id, userId: access.current.user.id, action: 'UPDATE', entityType: 'Employee', entityId: employeeId, request});
  return redirectToPath(appendFlash(returnTo, {saved: 'updated'}));
}
