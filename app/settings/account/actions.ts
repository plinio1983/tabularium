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
  const currentPassword = value(formData, 'currentPassword');
  const newPassword = value(formData, 'newPassword');
  const confirmPassword = value(formData, 'confirmPassword');

  if (!email) accountError('invalid');
  if (current.user.passwordHash && !currentPassword) accountError('invalid');
  if (current.user.passwordHash && !verifyPassword(currentPassword, current.user.passwordHash)) accountError('password');
  if (!current.user.passwordHash && currentPassword) accountError('password');
  if (newPassword || confirmPassword) {
    if (newPassword.length < 10) accountError('password_short');
    if (newPassword !== confirmPassword) accountError('password_mismatch');
  }

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
      ...(emailChanged ? { emailVerifiedAt: null, googleEmailVerified: false } : {}),
      ...(newPassword ? { passwordHash: hashPassword(newPassword) } : {})
    }
  });
  if (newPassword || emailChanged) {
    await prisma.authSession.deleteMany({
      where: { userId: current.user.id, ...(emailChanged ? {} : { id: { not: current.session.id } }) }
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
      passwordChanged: Boolean(newPassword)
    }
  });
  if (emailChanged) {
    await issueEmailVerification(updatedUser);
    redirect(`/register/success?verification=required&email=${encodeURIComponent(updatedUser.email)}`);
  }

  redirect('/settings/account?saved=1');
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
