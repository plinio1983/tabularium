'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ensureWorkspaceDefaults } from '@/lib/workspace-defaults';
import {
  createSession,
  destroyCurrentSession,
  hashPassword,
  requireSystemAdmin,
  verifyPassword,
  type WorkspaceRoleName
} from '@/lib/auth';

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function safeNextPath(next: string) {
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  const [pathWithQuery] = next.split('#');
  const [pathname, query = ''] = pathWithQuery.split('?');
  const params = new URLSearchParams(query);
  params.delete('_rsc');
  params.delete('__flight__');
  const sanitizedQuery = params.toString();
  return `${pathname}${sanitizedQuery ? `?${sanitizedQuery}` : ''}`;
}

function parseRole(role: string): WorkspaceRoleName {
  return ['OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER'].includes(role) ? role as WorkspaceRoleName : 'VIEWER';
}

async function assignLegacyDataToWorkspace(workspaceId: number) {
  await prisma.$transaction([
    prisma.company.updateMany({ where: { workspaceId: null }, data: { workspaceId } }),
    prisma.expenseCategory.updateMany({ where: { workspaceId: null }, data: { workspaceId } }),
    prisma.bank.updateMany({ where: { workspaceId: null }, data: { workspaceId } }),
    prisma.supplier.updateMany({ where: { workspaceId: null }, data: { workspaceId } }),
    prisma.recurringExpense.updateMany({ where: { workspaceId: null }, data: { workspaceId } }),
    prisma.expense.updateMany({ where: { workspaceId: null }, data: { workspaceId } }),
    prisma.monthlyRevenue.updateMany({ where: { workspaceId: null }, data: { workspaceId } }),
    prisma.income.updateMany({ where: { workspaceId: null }, data: { workspaceId } })
  ]);
}

export async function setupFirstAdminAction(formData: FormData) {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) redirect('/admin/login');

  const email = normalizeEmail(value(formData, 'email'));
  const password = value(formData, 'password');
  const name = value(formData, 'name') || null;
  const workspaceName = value(formData, 'workspaceName') || 'Area principale';

  if (!email || password.length < 8) {
    redirect('/admin/setup?error=invalid');
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      isSystemAdmin: true,
      passwordHash: hashPassword(password)
    }
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      ownerId: user.id,
      members: {
        create: {
          userId: user.id,
          role: 'OWNER'
        }
      }
    }
  });

  await assignLegacyDataToWorkspace(workspace.id);
  await ensureWorkspaceDefaults(workspace.id);
  await createSession(user.id, workspace.id);
  redirect('/admin');
}

export async function loginAction(formData: FormData) {
  const email = normalizeEmail(value(formData, 'email'));
  const password = value(formData, 'password');
  const next = safeNextPath(value(formData, 'next') || '/');
  const failurePath = safeNextPath(value(formData, 'failurePath') || '/login');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    redirect(`${failurePath}?error=invalid&next=${encodeURIComponent(next)}`);
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    orderBy: { id: 'asc' }
  });
  await createSession(user.id, membership?.workspaceId ?? null);
  redirect(next);
}

export async function registerAction(formData: FormData) {
  const email = normalizeEmail(value(formData, 'email'));
  const password = value(formData, 'password');
  const name = value(formData, 'name') || null;
  const workspaceName = value(formData, 'workspaceName') || (name ? `Workspace di ${name}` : 'Il mio workspace');

  if (!email || password.length < 8) {
    redirect('/register?error=invalid');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect('/register?error=exists');

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hashPassword(password)
    }
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      ownerId: user.id,
      members: {
        create: {
          userId: user.id,
          role: 'OWNER'
        }
      }
    }
  });

  await ensureWorkspaceDefaults(workspace.id);
  await createSession(user.id, workspace.id);
  redirect('/register/success');
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect('/login');
}

export async function systemToggleUserAction(formData: FormData) {
  await requireSystemAdmin('/admin/users');
  const userId = Number(value(formData, 'userId'));
  const action = value(formData, 'action');
  if (!Number.isInteger(userId) || userId <= 0) redirect('/admin/users?error=invalid');
  if (action === 'system_admin_on') {
    await prisma.user.update({ where: { id: userId }, data: { isSystemAdmin: true } });
  } else if (action === 'system_admin_off') {
    await prisma.user.update({ where: { id: userId }, data: { isSystemAdmin: false } });
  } else if (action === 'activate') {
    await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
  } else if (action === 'deactivate') {
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  }
  redirect('/admin/users');
}

export async function systemCreateUserAction(formData: FormData) {
  await requireSystemAdmin('/admin/users');
  const email = normalizeEmail(value(formData, 'email'));
  const password = value(formData, 'password');
  const name = value(formData, 'name') || null;
  const workspaceName = value(formData, 'workspaceName') || (name ? `Workspace di ${name}` : 'Workspace utente');
  const isSystemAdmin = value(formData, 'isSystemAdmin') === 'on';

  if (!email || password.length < 8) {
    redirect('/admin/users?error=invalid');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect('/admin/users?error=exists');

  const user = await prisma.user.create({
    data: {
      email,
      name,
      isSystemAdmin,
      passwordHash: hashPassword(password)
    }
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      ownerId: user.id,
      members: {
        create: {
          userId: user.id,
          role: 'OWNER'
        }
      }
    }
  });

  await ensureWorkspaceDefaults(workspace.id);
  redirect('/admin/users');
}

export async function systemAssignWorkspacePermissionAction(formData: FormData) {
  await requireSystemAdmin('/admin/workspaces');
  const userId = Number(value(formData, 'userId'));
  const workspaceId = Number(value(formData, 'workspaceId'));
  const role = parseRole(value(formData, 'role'));
  const action = value(formData, 'action');
  if (!Number.isInteger(userId) || !Number.isInteger(workspaceId)) redirect('/admin/workspaces?error=invalid');

  if (action === 'remove') {
    await prisma.workspaceMember.deleteMany({ where: { userId, workspaceId } });
  } else {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      update: { role },
      create: { workspaceId, userId, role }
    });
  }
  redirect(`/admin/workspaces/${workspaceId}`);
}
