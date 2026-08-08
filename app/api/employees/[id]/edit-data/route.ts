import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const {id} = await params;
  const employee = await prisma.employee.findFirst({
    where: {id: Number(id), workspaceId: access.current.workspace.id, companyId: access.current.company.id}
  });
  if (!employee) return NextResponse.json({error: 'Dipendente non trovato'}, {status: 404});
  return NextResponse.json(employee);
}
