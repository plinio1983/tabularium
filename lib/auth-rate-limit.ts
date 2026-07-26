import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

const windowMs = 15 * 60 * 1000;
const blockMs = 15 * 60 * 1000;
const maxAttempts = 5;

async function throttleKey(email: string) {
  const requestHeaders = await headers();
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
    || requestHeaders.get('x-real-ip')
    || 'unknown';
  return createHash('sha256').update(`${email.trim().toLowerCase()}|${ip}`).digest('hex');
}

export async function checkAuthRateLimit(email: string) {
  const key = await throttleKey(email);
  const now = new Date();
  const throttle = await prisma.authThrottle.findUnique({ where: { key } });
  if (!throttle?.blockedUntil || throttle.blockedUntil <= now) return { allowed: true as const, key };
  return {
    allowed: false as const,
    key,
    retryAfterSeconds: Math.max(1, Math.ceil((throttle.blockedUntil.getTime() - now.getTime()) / 1000))
  };
}

export async function recordAuthFailure(key: string) {
  const now = new Date();
  const existing = await prisma.authThrottle.findUnique({ where: { key } });
  const activeWindow = existing && now.getTime() - existing.windowStart.getTime() < windowMs;
  const attempts = activeWindow ? existing.attempts + 1 : 1;
  const blockedUntil = attempts >= maxAttempts ? new Date(now.getTime() + blockMs) : null;
  await prisma.authThrottle.upsert({
    where: { key },
    create: { key, attempts, windowStart: now, blockedUntil },
    update: {
      attempts,
      windowStart: activeWindow ? existing!.windowStart : now,
      blockedUntil
    }
  });
}

export async function clearAuthFailures(key: string) {
  await prisma.authThrottle.deleteMany({ where: { key } });
}

