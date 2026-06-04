import { NextResponse } from 'next/server';
import { generateRecurringExpenses } from '@/lib/recurring-expenses-job';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  const urlSecret = new URL(request.url).searchParams.get('secret') ?? '';

  return bearer === secret || urlSecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await generateRecurringExpenses();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
