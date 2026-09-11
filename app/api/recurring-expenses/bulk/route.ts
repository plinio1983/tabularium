import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';

function safePath(value: string | null, fallback: string, requestUrl: string) {
  return pathFromUrl(value, fallback);
}

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
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

  if (bulkAction === 'bulk_edit') {
    const field = String(formData.get('field') || '');
    const data: Record<string, unknown> = {};
    if (field === 'categoryId') data.categoryId = Number(formData.get('categoryId')) || null;
    if (field === 'cadence') data.cadence = String(formData.get('cadence'));
    if (field === 'dueDay') data.dueDay = Number(formData.get('dueDay'));
    if (field === 'startDate') data.startDate = new Date(String(formData.get('startDate')));
    if (field === 'billing') { data.billingPeriodMode = String(formData.get('billingPeriodMode')); data.billingMonth = data.billingPeriodMode === 'CUSTOM_MONTH' ? Number(formData.get('billingMonth')) : null; }
    if (field === 'payment') { const automatic = String(formData.get('isAutomaticPayment')) === 'true'; data.isAutomaticPayment = automatic; data.paymentMethodId = automatic ? Number(formData.get('paymentMethodId')) || null : null; data.bankId = automatic ? Number(formData.get('bankId')) || null : null; }
    if (!Object.keys(data).length) return redirectToPath(safePath(returnTo, '/recurring-expenses', request.url));
    await prisma.recurringExpense.updateMany({where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id}, data});
    return redirectToPath(appendFlash(safePath(returnTo, '/recurring-expenses', request.url), {saved: 'bulk_updated'}));
  }

  if (bulkAction === 'change_category') {
    const categoryId = Number(formData.get('categoryId'));
    if (Number.isInteger(categoryId) && categoryId > 0) {
      const category = await prisma.expenseCategory.findFirst({
        where: { id: categoryId, workspaceId: current.workspace.id }
      });
      if (category) {
        await prisma.recurringExpense.updateMany({
          where: { id: { in: ids }, workspaceId: current.workspace.id, companyId: current.company.id },
          data: { categoryId }
        });
        await writeAuditLog({
          workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE',
          entityType: 'RecurringExpense', metadata: { ids, operation: bulkAction, categoryId }, request
        });
      }
    }
    return redirectToPath(appendFlash(safePath(returnTo, '/recurring-expenses', request.url), { saved: 'bulk_updated' }));
  }

  if (bulkAction === 'delete') {
    const deleted = await prisma.recurringExpense.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id, companyId: current.company.id } });
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_DELETE',
      entityType: 'RecurringExpense', metadata: { ids, deleted: deleted.count }, request
    });
  }

  return redirectToPath(appendFlash(safePath(returnTo, '/recurring-expenses', request.url), { saved: 'bulk_deleted' }));
}
