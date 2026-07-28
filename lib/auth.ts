import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const sessionCookieName = 'tabularium_session';
const sessionTtlDays = 14;
const sessionTtlSeconds = sessionTtlDays * 24 * 60 * 60;
const passwordIterations = 120000;
const passwordKeyLength = 64;
const passwordDigest = 'sha512';

export type WorkspaceRoleName = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER';
export const workspaceOperationalRoles: WorkspaceRoleName[] = ['OWNER', 'ADMIN', 'ACCOUNTANT'];
export const workspaceManagementRoles: WorkspaceRoleName[] = ['OWNER', 'ADMIN'];

export function hasWorkspaceRole(role: string | null | undefined, roles: WorkspaceRoleName[]) {
  return roles.includes(role as WorkspaceRoleName);
}

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
  const candidate = pbkdf2Sync(password, salt, iterations, passwordKeyLength, passwordDigest);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: number, workspaceId?: number | null) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + sessionTtlDays);

  const activeCompany = workspaceId ? await prisma.company.findFirst({
    where: {workspaceId, isActive: true},
    orderBy: [{isDefault: 'desc'}, {id: 'asc'}]
  }) : null;
  await prisma.authSession.create({
    data: {
      tokenHash: tokenHash(token),
      userId,
      workspaceId: workspaceId ?? null,
      activeCompanyId: activeCompany?.id ?? null,
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
  cookieStore.set(sessionCookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0)
  });
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const tokens = Array.from(new Set(cookieStore.getAll(sessionCookieName).map(cookie => cookie.value).filter(Boolean)));
  if (!tokens.length) return null;

  const sessions = await prisma.authSession.findMany({
    where: { tokenHash: { in: tokens.map(tokenHash) } },
    include: {
      user: true,
      workspace: true,
      activeCompany: true
    }
  });
  const now = new Date();
  const expiredSessionIds = sessions.filter(item => item.expiresAt <= now).map(item => item.id);
  if (expiredSessionIds.length) {
    await prisma.authSession.deleteMany({ where: { id: { in: expiredSessionIds } } });
  }
  const session = sessions.find(item =>
    item.expiresAt > now
    && item.user.isActive
    && Boolean(item.user.emailVerifiedAt || item.user.googleEmailVerified)
  );

  if (!session) return null;

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.userId },
    include: { workspace: true },
    orderBy: { id: 'asc' }
  });
  const currentMembership = memberships.find(membership => membership.workspaceId === session.workspaceId) ?? memberships[0] ?? null;
  const workspaceId = currentMembership?.workspaceId ?? session.workspaceId;
  const companies = workspaceId ? await prisma.company.findMany({
    where: {workspaceId, isActive: true},
    orderBy: [{isDefault: 'desc'}, {name: 'asc'}, {id: 'asc'}]
  }) : [];
  const activeCompany = companies.find(company => company.id === session.activeCompanyId) ?? companies[0] ?? null;
  if (activeCompany && session.activeCompanyId !== activeCompany.id) {
    await prisma.authSession.update({where: {id: session.id}, data: {activeCompanyId: activeCompany.id}});
  }

  return {
    session,
    user: session.user,
    workspace: currentMembership?.workspace ?? session.workspace,
    membership: currentMembership,
    memberships,
    company: activeCompany,
    companies
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
  if (!current.company) redirect('/settings/company-settings');
  return {
    ...current,
    workspace: current.workspace,
    membership: current.membership,
    company: current.company
  };
}

export async function getWorkspaceContext() {
  const current = await getCurrentSession();
  if (!current?.workspace || !current.membership || !current.company) return null;
  return {
    ...current,
    workspace: current.workspace,
    membership: current.membership,
    company: current.company
  };
}

export async function getWorkspaceApiAccess(roles: WorkspaceRoleName[]) {
  const current = await getWorkspaceContext();
  if (!current) {
    return {
      ok: false as const,
      status: 401 as const,
      error: 'Autenticazione richiesta'
    };
  }
  if (!hasWorkspaceRole(current.membership.role, roles)) {
    return {
      ok: false as const,
      status: 403 as const,
      error: 'Permessi insufficienti'
    };
  }
  return {
    ok: true as const,
    current
  };
}

export async function requireWorkspaceRole(roles: WorkspaceRoleName[], nextPath = '/admin') {
  const current = await requireWorkspace(nextPath);
  if (!hasWorkspaceRole(current.membership.role, roles)) redirect('/account/workspace');
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
