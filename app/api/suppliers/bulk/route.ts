import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';

function selectedIds(formData: FormData) {
  return formData.getAll('ids').map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0);
}

function safeReturnTo(request: Request) {
  return pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/suppliers');
}

export async function POST(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const formData = await request.formData();
  const action = String(formData.get('bulkAction') || '');
  const ids = selectedIds(formData);
  const redirectTo = safeReturnTo(request);

  if (!ids.length || !action) {
    return redirectToPath(redirectTo);
  }

  if (action === 'delete') {
    const linkedUsage = await prisma.expense.count({ where: { supplierId: { in: ids }, workspaceId: current.workspace.id } })
      + await prisma.recurringExpense.count({ where: { supplierId: { in: ids }, workspaceId: current.workspace.id } });
    if (linkedUsage > 0) {
      return redirectToPath(appendFlash(redirectTo, { error: 'in_use', usage: String(linkedUsage) }));
    }
    await prisma.supplier.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id } });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_deleted' }));
  }

  return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
}
