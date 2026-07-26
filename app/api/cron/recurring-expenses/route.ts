import { NextResponse } from 'next/server';
import { generateRecurringExpenses, runRecurringExpensesDailyJob, settleAutomaticRecurringPayments } from '@/lib/recurring-expenses-job';

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

  const task = new URL(request.url).searchParams.get('task') ?? 'all';
  const result = task === 'generate'
    ? await generateRecurringExpenses()
    : task === 'payments'
      ? await settleAutomaticRecurringPayments()
      : await runRecurringExpensesDailyJob();

  const hasErrors = 'errors' in result
    ? result.errors.length > 0
    : result.generate.errors.length > 0 || result.payments.errors.length > 0;
  if (hasErrors) console.error(JSON.stringify({ event: 'recurring_expenses_job_failed', task, result }));
  return NextResponse.json({ task, result }, { status: hasErrors ? 500 : 200 });
}

export async function POST(request: Request) {
  return GET(request);
}
