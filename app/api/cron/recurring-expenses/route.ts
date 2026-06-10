import { NextResponse } from 'next/server';
import { generateRecurringExpenses, runRecurringExpensesDailyJob, settleAutomaticRecurringPayments } from '@/lib/recurring-expenses-job';

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

  const task = new URL(request.url).searchParams.get('task') ?? 'all';
  const result = task === 'generate'
    ? await generateRecurringExpenses()
    : task === 'payments'
      ? await settleAutomaticRecurringPayments()
      : await runRecurringExpensesDailyJob();

  return NextResponse.json({ task, result });
}

export async function POST(request: Request) {
  return GET(request);
}
