import { NextResponse } from 'next/server';
import { generateRecurringExpenses } from '@/lib/recurring-expenses-job';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';

  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  return bearer === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await generateRecurringExpenses();
  if (result.errors.length) console.error(JSON.stringify({ event: 'recurring_expenses_job_failed', task: 'generate', result }));
  return NextResponse.json(result, { status: result.errors.length ? 500 : 200 });
}

export async function POST(request: Request) {
  return GET(request);
}
