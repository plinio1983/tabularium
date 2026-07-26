import { consumeEmailVerification } from '@/lib/account-email';
import { createSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return redirectToPath('/login?error=verification_invalid', 307);
  const user = await consumeEmailVerification(token);
  if (!user) return redirectToPath('/login?error=verification_invalid', 307);
  const membership = await prisma.workspaceMember.findFirst({ where: { userId: user.id }, orderBy: { id: 'asc' } });
  if (membership) await writeAuditLog({
    workspaceId: membership.workspaceId,
    userId: user.id,
    action: 'EMAIL_VERIFIED',
    entityType: 'UserAccount',
    entityId: user.id,
    request
  });
  await createSession(user.id, membership?.workspaceId ?? null);
  return redirectToPath('/?emailVerified=1', 307);
}
