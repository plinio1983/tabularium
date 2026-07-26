'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { checkAuthRateLimit, recordAuthFailure } from '@/lib/auth-rate-limit';
import { hashPassword } from '@/lib/auth';
import { consumePasswordReset, issueEmailVerification, issuePasswordReset } from '@/lib/account-email';
import { writeAuditLog } from '@/lib/audit';

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function emailValue(formData: FormData) {
  return value(formData, 'email').toLowerCase();
}

export async function forgotPasswordAction(formData: FormData) {
  const email = emailValue(formData);
  const throttle = await checkAuthRateLimit(`password-reset:${email}`);
  if (!throttle.allowed) redirect('/forgot-password?sent=1');

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.isActive && (user.passwordHash || !user.googleId)) {
      await issuePasswordReset(user);
    }
  }
  await recordAuthFailure(throttle.key);
  redirect('/forgot-password?sent=1');
}

export async function resendVerificationAction(formData: FormData) {
  const email = emailValue(formData);
  const throttle = await checkAuthRateLimit(`email-verification:${email}`);
  if (!throttle.allowed) redirect('/resend-verification?sent=1');

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.isActive && !user.emailVerifiedAt && !user.googleEmailVerified) {
      await issueEmailVerification(user);
    }
  }
  await recordAuthFailure(throttle.key);
  redirect('/resend-verification?sent=1');
}

export async function resetPasswordAction(formData: FormData) {
  const token = value(formData, 'token');
  const password = value(formData, 'password');
  const confirmation = value(formData, 'passwordConfirmation');
  if (!token || password.length < 10 || password !== confirmation) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=invalid`);
  }
  const user = await consumePasswordReset(token, hashPassword(password));
  if (!user) redirect('/reset-password?error=expired');
  const membership = await prisma.workspaceMember.findFirst({ where: { userId: user.id }, orderBy: { id: 'asc' } });
  if (membership) await writeAuditLog({
    workspaceId: membership.workspaceId,
    userId: user.id,
    action: 'PASSWORD_RESET',
    entityType: 'UserAccount',
    entityId: user.id
  });
  redirect('/login?passwordReset=1');
}
