import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {employeeInputSchema, employeePersistenceData} from '@/lib/employees';
import {appendFlash} from '@/lib/flash';
import {pathFromUrl, redirectToPath} from '@/lib/redirect';
import {writeAuditLog} from '@/lib/audit';

function returnPath(request: Request) {
  return pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/employees').replace(/([?&])new=1(&|$)/, '$1').replace(/[?&]$/, '');
}

export async function GET(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const search = new URL(request.url).searchParams.get('search')?.trim();
  const employees = await prisma.employee.findMany({
    where: {
      workspaceId: access.current.workspace.id,
      companyId: access.current.company.id,
      ...(search ? {OR: [
        {firstName: {contains: search, mode: 'insensitive'}},
        {lastName: {contains: search, mode: 'insensitive'}},
        {employeeCode: {contains: search, mode: 'insensitive'}}
      ]} : {})
    },
    select: {id: true, firstName: true, lastName: true, employeeCode: true, status: true},
    orderBy: [{status: 'asc'}, {lastName: 'asc'}, {firstName: 'asc'}],
    take: 50
  });
  return NextResponse.json(employees);
}

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const isForm = request.headers.get('content-type')?.includes('form');
  const raw = isForm ? Object.fromEntries((await request.formData()).entries()) : await request.json();
  const parsed = employeeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return isForm
      ? redirectToPath(appendFlash(returnPath(request), {error: 'invalid'}))
      : NextResponse.json({error: parsed.error.issues[0]?.message ?? 'Dati non validi'}, {status: 400});
  }
  if (parsed.data.employeeCode) {
    const duplicate = await prisma.employee.findFirst({where: {companyId: access.current.company.id, employeeCode: parsed.data.employeeCode}, select: {id: true}});
    if (duplicate) return isForm
      ? redirectToPath(appendFlash(returnPath(request), {error: 'duplicate_code'}))
      : NextResponse.json({error: 'Matricola già utilizzata'}, {status: 409});
  }
  const employee = await prisma.employee.create({data: {
    ...employeePersistenceData(parsed.data),
    workspaceId: access.current.workspace.id,
    companyId: access.current.company.id
  }});
  await writeAuditLog({workspaceId: access.current.workspace.id, userId: access.current.user.id, action: 'CREATE', entityType: 'Employee', entityId: employee.id, request});
  return isForm
    ? redirectToPath(appendFlash(returnPath(request), {saved: 'created'}))
    : NextResponse.json(employee);
}
