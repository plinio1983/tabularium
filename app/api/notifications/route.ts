import {NextResponse} from 'next/server';
import {getWorkspaceContext} from '@/lib/auth';
import {prisma} from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});

  const params = new URL(request.url).searchParams;
  const limit = Math.min(50, Math.max(1, Number(params.get('limit')) || 15));
  const unreadOnly = params.get('status') === 'unread';
  const activeCompanyOnly = params.get('company') === 'active';
  const now = new Date();
  const baseWhere = {
    userId: current.user.id,
    archivedAt: null,
    ...(unreadOnly ? {readAt: null} : {}),
    notification: {
      workspaceId: current.workspace.id,
      AND: [
        {OR: [{expiresAt: null}, {expiresAt: {gt: now}}]},
        ...(activeCompanyOnly ? [{OR: [{companyId: null}, {companyId: current.company.id}]}] : [])
      ]
    }
  };
  const [recipients, unreadCount] = await Promise.all([
    prisma.notificationRecipient.findMany({
      where: baseWhere,
      include: {notification: {include: {company: {select: {id: true, name: true}}}}},
      orderBy: {notification: {occurredAt: 'desc'}},
      take: limit
    }),
    prisma.notificationRecipient.count({
      where: {
        userId: current.user.id,
        readAt: null,
        archivedAt: null,
        notification: {workspaceId: current.workspace.id, OR: [{expiresAt: null}, {expiresAt: {gt: now}}]}
      }
    })
  ]);

  return NextResponse.json({
    unreadCount,
    notifications: recipients.map(recipient => ({
      id: recipient.notification.id.toString(),
      type: recipient.notification.type,
      severity: recipient.notification.severity,
      title: recipient.notification.title,
      message: recipient.notification.message,
      actionUrl: recipient.notification.actionUrl,
      occurredAt: recipient.notification.occurredAt.toISOString(),
      readAt: recipient.readAt?.toISOString() ?? null,
      company: recipient.notification.company
    }))
  });
}
