import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/auth';

function selectedIds(formData: FormData) {
  return formData.getAll('ids').map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0);
}

function safeReturnTo(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = requestUrl.searchParams.get('returnTo') || '/suppliers';
  try {
    const url = returnTo.startsWith('http') ? new URL(returnTo) : new URL(returnTo, request.url);
    if (url.origin !== requestUrl.origin) return '/suppliers';
    return `${url.pathname}${url.search}`;
  } catch {
    return returnTo.startsWith('/') ? returnTo : '/suppliers';
  }
}

export async function POST(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const formData = await request.formData();
  const action = String(formData.get('bulkAction') || '');
  const ids = selectedIds(formData);
  const redirectTo = safeReturnTo(request);

  if (!ids.length || !action) {
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  }

  if (action === 'delete') {
    await prisma.$transaction([
      prisma.expense.updateMany({
        where: { supplierId: { in: ids }, workspaceId: current.workspace.id },
        data: { supplierId: null }
      }),
      prisma.supplier.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id } })
    ]);
  }

  return NextResponse.redirect(new URL(redirectTo, request.url), 303);
}
