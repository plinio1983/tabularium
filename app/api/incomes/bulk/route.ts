import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';

const saleCategoryOptions = new Set(['B2C', 'B2B', 'Altro']);

function selectedIds(formData: FormData) {
  return formData.getAll('ids').map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0);
}

function safeReturnTo(request: Request) {
  return pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/incomes');
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

  if (action === 'change_category') {
    const saleCategory = String(formData.get('saleCategory') || '').trim();
    if (saleCategoryOptions.has(saleCategory)) {
      await prisma.income.updateMany({
        where: { id: { in: ids }, workspaceId: current.workspace.id },
        data: { saleCategory }
      });
    }
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
  }

  if (action === 'delete') {
    await prisma.income.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id } });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_deleted' }));
  }

  if (action === 'invoice_emitted') {
    await prisma.income.updateMany({ where: { id: { in: ids }, workspaceId: current.workspace.id, isFiscal: true }, data: { invoiceStatus: 'EMESSA' } });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
  }

  return redirectToPath(redirectTo);
}
