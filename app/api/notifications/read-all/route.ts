import {NextResponse} from 'next/server';
import {getWorkspaceContext} from '@/lib/auth';
import {prisma} from '@/lib/prisma';

export async function POST() {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
  const updated = await prisma.notificationRecipient.updateMany({
    where: {userId: current.user.id, readAt: null, archivedAt: null, notification: {workspaceId: current.workspace.id}},
    data: {readAt: new Date()}
  });
  return NextResponse.json({ok: true, updated: updated.count});
}
