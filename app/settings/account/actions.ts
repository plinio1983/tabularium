'use server';

import { redirect } from 'next/navigation';
import { getCurrentSession, hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

  if (!email || !currentPassword) accountError('invalid');
  if (!verifyPassword(currentPassword, current.user.passwordHash)) accountError('password');
  if (newPassword || confirmPassword) {
    if (newPassword.length < 8) accountError('password_short');
    if (newPassword !== confirmPassword) accountError('password_mismatch');
  }

  if (email !== current.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== current.user.id) accountError('email_exists');
  }

  await prisma.user.update({
    where: { id: current.user.id },
    data: {
      name,
      email,
      ...(newPassword ? { passwordHash: hashPassword(newPassword) } : {})
    }
  });

  redirect('/settings/account?saved=1');
}
