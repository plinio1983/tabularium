import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

const maxAttempts = 8;

function smtpTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) throw new Error('Configurazione SMTP incompleta');

  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });
}

function sender() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || '';
}

function retryDelay(attempts: number) {
  return Math.min(6 * 60 * 60 * 1000, Math.max(60_000, 2 ** attempts * 60_000));
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(pass(word)?|auth|credential|token)=?[^ ]*/gi, '$1=***').slice(0, 1000);
}

export async function enqueueEmail(message: {
  recipient: string;
  subject: string;
  textBody: string;
  htmlBody: string;
}) {
  const email = await prisma.emailOutbox.create({ data: message });
  await deliverOutboxEmail(email.id).catch(() => undefined);
  return email.id;
}

export async function deliverOutboxEmail(id: bigint) {
  const email = await prisma.emailOutbox.findUnique({ where: { id } });
  if (!email || email.status === 'SENT' || email.attempts >= maxAttempts) return false;
  const claimed = await prisma.emailOutbox.updateMany({
    where: {
      id,
      OR: [
        { status: 'PENDING' },
        { status: 'SENDING', updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } }
      ]
    },
    data: { status: 'SENDING' }
  });
  if (!claimed.count) return false;

  try {
    await smtpTransport().sendMail({
      from: sender(),
      to: email.recipient,
      subject: email.subject,
      text: email.textBody,
      html: email.htmlBody
    });
    await prisma.emailOutbox.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null }
    });
    return true;
  } catch (error) {
    const attempts = email.attempts + 1;
    await prisma.emailOutbox.update({
      where: { id },
      data: {
        status: attempts >= maxAttempts ? 'FAILED' : 'PENDING',
        attempts,
        lastError: safeError(error),
        nextAttempt: new Date(Date.now() + retryDelay(attempts))
      }
    });
    throw error;
  }
}

export async function processEmailOutbox(limit = 20) {
  const emails = await prisma.emailOutbox.findMany({
    where: {
      attempts: { lt: maxAttempts },
      OR: [
        { status: 'PENDING', nextAttempt: { lte: new Date() } },
        { status: 'SENDING', updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } }
      ]
    },
    orderBy: { createdAt: 'asc' },
    take: limit
  });
  let sent = 0;
  let failed = 0;
  for (const email of emails) {
    try {
      if (await deliverOutboxEmail(email.id)) sent += 1;
    } catch {
      failed += 1;
    }
  }
  await Promise.all([
    prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.emailOutbox.deleteMany({
      where: { status: 'SENT', sentAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    })
  ]);
  return { checked: emails.length, sent, failed };
}

export async function verifySmtpConnection() {
  await smtpTransport().verify();
}
