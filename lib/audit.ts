import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';

type AuditInput = {
  workspaceId: number;
  userId: number;
  action: string;
  entityType: string;
  entityId?: number | string | null;
  metadata?: Prisma.InputJsonValue;
  request?: Request;
};

function requestIp(request?: Request) {
  if (!request) return null;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || null;
}

export async function writeAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId === null || input.entityId === undefined ? null : String(input.entityId),
      metadata: input.metadata ?? undefined,
      ipAddress: requestIp(input.request),
      userAgent: input.request?.headers.get('user-agent')?.slice(0, 500) || null
    }
  });
}
