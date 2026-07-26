import { NextResponse } from 'next/server';
import { processEmailOutbox } from '@/lib/email';

export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const authorization = request.headers.get('authorization') || '';
  return authorization.startsWith('Bearer ') && authorization.slice(7) === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await processEmailOutbox();
  return NextResponse.json(result, { status: result.failed ? 500 : 200 });
}

export async function POST(request: Request) {
  return GET(request);
}

