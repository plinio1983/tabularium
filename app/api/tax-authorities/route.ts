import {NextResponse} from 'next/server';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {ensureWorkspaceDefaults} from '@/lib/workspace-defaults';

export async function GET() {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  await ensureWorkspaceDefaults(access.current.workspace.id);
  const records = await prisma.taxAuthority.findMany({
    where: {workspaceId: access.current.workspace.id, isActive: true},
    orderBy: [{name: 'asc'}]
  });
  return NextResponse.json(records);
}
