import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, pbkdf2Sync, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const sessionCookieName = 'tabularium_session';
const sessionTtlDays = 14;
const sessionTtlSeconds = sessionTtlDays * 24 * 60 * 60;
const passwordIterations = 120000;
const passwordKeyLength = 64;
const passwordDigest = 'sha512';

export type WorkspaceRoleName = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, passwordIterations, passwordKeyLength, passwordDigest).toString('hex');
  return `pbkdf2:${passwordIterations}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash) return false;
  const [scheme, iterationsRaw, salt, hash] = storedHash.split(':');
  if (scheme !== 'pbkdf2' || !iterationsRaw || !salt || !hash) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  const candidate = pbkdf2Sync(password, salt, iterations, passwordKeyLength, passwordDigest).toString('hex');
  return candidate === hash;
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: number, workspaceId?: number | null) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + sessionTtlDays);

  await prisma.authSession.create({
    data: {
      tokenHash: tokenHash(token),
      userId,
      workspaceId: workspaceId ?? null,
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionTtlSeconds,
    expires: expiresAt
  });
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const tokens = cookieStore.getAll(sessionCookieName).map(cookie => cookie.value).filter(Boolean);
  if (tokens.length) {
    await prisma.authSession.deleteMany({ where: { tokenHash: { in: tokens.map(tokenHash) } } });
  }
  cookieStore.delete(sessionCookieName);
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const tokens = Array.from(new Set(cookieStore.getAll(sessionCookieName).map(cookie => cookie.value).filter(Boolean)));
  if (!tokens.length) return null;

  const sessions = await prisma.authSession.findMany({
    where: { tokenHash: { in: tokens.map(tokenHash) } },
    include: {
      user: true,
      workspace: true
    }
  });
  const session = sessions.find(item => item.expiresAt > new Date() && item.user.isActive);

  if (!session) return null;

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.userId },
    include: { workspace: true },
    orderBy: { id: 'asc' }
  });
  const currentMembership = memberships.find(membership => membership.workspaceId === session.workspaceId) ?? memberships[0] ?? null;

  return {
    session,
    user: session.user,
    workspace: currentMembership?.workspace ?? session.workspace,
    membership: currentMembership,
    memberships
  };
}

export async function requireSession(nextPath = '/') {
  const current = await getCurrentSession();
  if (!current) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return current;
}

export async function requireWorkspace(nextPath = '/') {
  const current = await requireSession(nextPath);
  if (!current.workspace || !current.membership) redirect('/admin');
  return {
    ...current,
    workspace: current.workspace,
    membership: current.membership
  };
}

export async function getWorkspaceContext() {
  const current = await getCurrentSession();
  if (!current?.workspace || !current.membership) return null;
  return {
    ...current,
    workspace: current.workspace,
    membership: current.membership
  };
}

export async function requireWorkspaceRole(roles: WorkspaceRoleName[], nextPath = '/admin') {
  const current = await requireWorkspace(nextPath);
  if (!roles.includes(current.membership.role as WorkspaceRoleName)) redirect('/account/workspace');
  return current;
}

export async function requireSystemAdmin(nextPath = '/admin') {
  const current = await getCurrentSession();
  if (!current) redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  if (!current.user.isSystemAdmin) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}&error=forbidden`);
  }
  return current;
}

export function canManageUsers(role?: string | null) {
  return role === 'OWNER' || role === 'ADMIN';
}
