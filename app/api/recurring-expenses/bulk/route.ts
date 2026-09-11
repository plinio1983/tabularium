import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';
import {parseRecurringExpenseBulkEdit} from '@/lib/recurring-expense-bulk-edit';

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
    let data: ReturnType<typeof parseRecurringExpenseBulkEdit>;
    const invalid = () => redirectToPath(appendFlash(safePath(returnTo, '/recurring-expenses', request.url), {error: 'invalid'}));
    try {
      data = parseRecurringExpenseBulkEdit(formData);
    } catch {
      return invalid();
    }
    const where = {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id};
    if (data.categoryId && !await prisma.expenseCategory.findFirst({where: {id: data.categoryId, workspaceId: current.workspace.id}})) return invalid();
    if (data.paymentMethodId && !await prisma.paymentMethod.findFirst({where: {id: data.paymentMethodId, workspaceId: current.workspace.id}})) return invalid();
    if (data.bankId && !await prisma.bank.findFirst({where: {id: data.bankId, workspaceId: current.workspace.id}})) return invalid();
    if (data.startDate && await prisma.recurringExpense.findFirst({where: {...where, endDate: {lt: data.startDate}}, select: {id: true}})) return invalid();
    const result = await prisma.recurringExpense.updateMany({where, data});
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE',
      entityType: 'RecurringExpense', metadata: {ids, operation: bulkAction, fields: Object.keys(data), updated: result.count}, request
    });
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
