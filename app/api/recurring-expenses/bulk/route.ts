import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';

function safePath(value: string | null, fallback: string, requestUrl: string) {
  return pathFromUrl(value, fallback);
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
    return redirectToPath(safePath(returnTo, '/recurring-expenses', request.url));
  }

  if (bulkAction === 'change_category') {
    const categoryId = Number(formData.get('categoryId'));
    if (Number.isInteger(categoryId) && categoryId > 0) {
      const category = await prisma.expenseCategory.findFirst({
        where: { id: categoryId, workspaceId: current.workspace.id }
      });
      if (category) {
        await prisma.recurringExpense.updateMany({
          where: { id: { in: ids }, workspaceId: current.workspace.id },
          data: { categoryId }
        });
      }
    }
    return redirectToPath(appendFlash(safePath(returnTo, '/recurring-expenses', request.url), { saved: 'bulk_updated' }));
  }

  if (bulkAction === 'delete') {
    await prisma.recurringExpense.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id } });
  }

  return redirectToPath(appendFlash(safePath(returnTo, '/recurring-expenses', request.url), { saved: 'bulk_deleted' }));
}
