import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { enqueueEmail } from '@/lib/email';

function appUrl() {
  const value = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error('APP_URL non configurata');
  return value.replace(/\/$/, '');
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character] || character);
}

export async function issueEmailVerification(user: { id: number; email: string; name?: string | null }) {
  const token = randomBytes(32).toString('hex');
  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.emailVerificationToken.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    })
  ]);
  const link = `${appUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const displayName = escapeHtml(user.name || user.email);
  await enqueueEmail({
    recipient: user.email,
    subject: 'Verifica il tuo indirizzo email — Tabularium',
    textBody: `Ciao ${user.name || user.email},\n\nverifica il tuo indirizzo aprendo questo link entro 24 ore:\n${link}\n\nSe non hai richiesto tu la registrazione, ignora questa email.`,
    htmlBody: `<p>Ciao ${displayName},</p><p>verifica il tuo indirizzo email per attivare Tabularium.</p><p><a href="${link}">Verifica indirizzo email</a></p><p>Il link scade tra 24 ore.</p>`
  });
}

export async function consumeEmailVerification(token: string) {
  const now = new Date();
  return prisma.$transaction(async transaction => {
    const verification = await transaction.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true }
    });
    if (!verification || verification.usedAt || verification.expiresAt <= now || !verification.user.isActive) return null;
    await transaction.emailVerificationToken.update({ where: { id: verification.id }, data: { usedAt: now } });
    const user = await transaction.user.update({
      where: { id: verification.userId },
      data: { emailVerifiedAt: now }
    });
    return user;
  });
}

export async function issuePasswordReset(user: { id: number; email: string; name?: string | null }) {
  const token = randomBytes(32).toString('hex');
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 45 * 60 * 1000)
      }
    })
  ]);
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const displayName = escapeHtml(user.name || user.email);
  await enqueueEmail({
    recipient: user.email,
    subject: 'Reimposta la password — Tabularium',
    textBody: `Ciao ${user.name || user.email},\n\npuoi impostare una nuova password aprendo questo link entro 45 minuti:\n${link}\n\nSe non hai richiesto tu il reset, ignora questa email.`,
    htmlBody: `<p>Ciao ${displayName},</p><p>abbiamo ricevuto una richiesta di reimpostazione della password.</p><p><a href="${link}">Imposta una nuova password</a></p><p>Il link scade tra 45 minuti.</p>`
  });
}

export async function consumePasswordReset(token: string, passwordHash: string) {
  const now = new Date();
  return prisma.$transaction(async transaction => {
    const reset = await transaction.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true }
    });
    if (!reset || reset.usedAt || reset.expiresAt <= now || !reset.user.isActive) return null;
    await transaction.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: now } });
    await transaction.user.update({
      where: { id: reset.userId },
      data: { passwordHash, emailVerifiedAt: reset.user.emailVerifiedAt || now }
    });
    await transaction.authSession.deleteMany({ where: { userId: reset.userId } });
    await transaction.passwordResetToken.updateMany({
      where: { userId: reset.userId, usedAt: null },
      data: { usedAt: now }
    });
    return reset.user;
  });
}
