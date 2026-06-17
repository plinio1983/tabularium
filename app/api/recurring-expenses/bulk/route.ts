import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/auth';

function safePath(value: string | null, fallback: string, requestUrl: string) {
  if (!value) return fallback;
  try {
    const url = value.startsWith('http') ? new URL(value) : new URL(value, requestUrl);
    if (url.origin !== new URL(requestUrl).origin) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith('/') ? value : fallback;
  }
}

export async function POST(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const formData = await request.formData();
  const rawIds = formData.getAll('ids');
  const bulkAction = String(formData.get('bulkAction') || '');
  const returnTo = new URL(request.url).searchParams.get('returnTo');
  const ids = rawIds
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value > 0);

  if (!ids.length) {
    return NextResponse.redirect(new URL(safePath(returnTo, '/recurring-expenses', request.url), request.url), 303);
  }

  if (bulkAction === 'delete') {
    await prisma.recurringExpense.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id } });
  }

  return NextResponse.redirect(new URL(safePath(returnTo, '/recurring-expenses', request.url), request.url), 303);
}
