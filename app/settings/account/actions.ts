'use server';

import { redirect } from 'next/navigation';
import { getCurrentSession, hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';
import { issueEmailVerification } from '@/lib/account-email';

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function accountError(code: string) {
  redirect(`/settings/account?error=${encodeURIComponent(code)}`);
}

export async function updateAccountAction(formData: FormData) {
  const current = await getCurrentSession();
  if (!current) redirect('/login?next=/settings/account');

  const name = value(formData, 'name') || null;
  const email = normalizeEmail(value(formData, 'email'));

  if (!email) accountError('invalid');

  if (email !== current.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== current.user.id) accountError('email_exists');
  }

  const emailChanged = email !== current.user.email;
  const updatedUser = await prisma.user.update({
    where: { id: current.user.id },
    data: {
      name,
      email,
      ...(emailChanged ? { emailVerifiedAt: null, googleEmailVerified: false } : {})
    }
  });
  if (emailChanged) {
    await prisma.authSession.deleteMany({
      where: { userId: current.user.id }
    });
  }
  if (current.workspace) await writeAuditLog({
    workspaceId: current.workspace.id,
    userId: current.user.id,
    action: 'UPDATE',
    entityType: 'UserAccount',
    entityId: current.user.id,
    metadata: {
      emailChanged,
      passwordChanged: false
    }
  });
  if (emailChanged) {
    await issueEmailVerification(updatedUser);
    redirect(`/register/success?verification=required&email=${encodeURIComponent(updatedUser.email)}`);
  }

  redirect('/settings/account?saved=1');
}

function passwordError(code: string): never {
  redirect(`/settings/account/password?error=${encodeURIComponent(code)}`);
}

export async function updatePasswordAction(formData: FormData) {
  const current = await getCurrentSession();
  if (!current) redirect('/login?next=/settings/account/password');

  const currentPassword = value(formData, 'currentPassword');
  const newPassword = value(formData, 'newPassword');
  const confirmPassword = value(formData, 'confirmPassword');

  if (current.user.passwordHash && !currentPassword) passwordError('invalid');
  if (current.user.passwordHash && !verifyPassword(currentPassword, current.user.passwordHash)) passwordError('password');
  if (!newPassword || newPassword.length < 10) passwordError('password_short');
  if (newPassword !== confirmPassword) passwordError('password_mismatch');

  await prisma.$transaction([
    prisma.user.update({
      where: {id: current.user.id},
      data: {passwordHash: hashPassword(newPassword)}
    }),
    prisma.authSession.deleteMany({
      where: {userId: current.user.id, id: {not: current.session.id}}
    })
  ]);

  if (current.workspace) await writeAuditLog({
    workspaceId: current.workspace.id,
    userId: current.user.id,
    action: 'UPDATE',
    entityType: 'UserAccount',
    entityId: current.user.id,
    metadata: {emailChanged: false, passwordChanged: true}
  });

  redirect('/settings/account/password?saved=1');
}

export async function revokeOtherSessionsAction() {
  const current = await getCurrentSession();
  if (!current) redirect('/login?next=/settings/account');
  const result = await prisma.authSession.deleteMany({
    where: { userId: current.user.id, id: { not: current.session.id } }
  });
  if (current.workspace) await writeAuditLog({
    workspaceId: current.workspace.id,
    userId: current.user.id,
    action: 'REVOKE_SESSIONS',
    entityType: 'UserAccount',
    entityId: current.user.id,
    metadata: { revoked: result.count }
  });
  redirect(`/settings/account?sessionsRevoked=${result.count}`);
}
