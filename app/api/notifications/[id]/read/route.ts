import {NextResponse} from 'next/server';
import {getWorkspaceContext} from '@/lib/auth';
import {prisma} from '@/lib/prisma';

export async function POST(_request: Request, context: {params: Promise<{id: string}>}) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
  const {id} = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({error: 'Notifica non valida'}, {status: 400});

  const updated = await prisma.notificationRecipient.updateMany({
    where: {notificationId: BigInt(id), userId: current.user.id, notification: {workspaceId: current.workspace.id}},
    data: {readAt: new Date()}
  });
  if (!updated.count) return NextResponse.json({error: 'Notifica non trovata'}, {status: 404});
  return NextResponse.json({ok: true});
}
