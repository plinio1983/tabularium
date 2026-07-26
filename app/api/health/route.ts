import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      database: 'ok',
      version: process.env.APP_VERSION || 'development',
      responseTimeMs: Date.now() - startedAt
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch {
    return NextResponse.json({
      status: 'error',
      database: 'unavailable',
      version: process.env.APP_VERSION || 'development'
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}

