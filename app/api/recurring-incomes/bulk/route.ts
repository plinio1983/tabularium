import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';
import {parseRecurringIncomeBulkEdit} from '@/lib/recurring-income-bulk-edit';
import {recurringStateResponse} from '@/lib/recurring-state-response';

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const data = await request.formData();
  const ids = data.getAll('ids').map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0);
  const returnTo = pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/recurring-incomes');
  if (!ids.length) return redirectToPath(returnTo);
  const bulkAction = String(data.get('bulkAction') || '');
  // Retain the old delete action as a non-destructive compatibility alias.
  if (['activate', 'deactivate', 'delete'].includes(bulkAction)) {
    return recurringStateResponse(request, 'income', ids, bulkAction === 'activate', access.current, returnTo);
  }
  if (bulkAction === 'bulk_edit') {
    const current = access.current;
    const invalid = () => redirectToPath(appendFlash(returnTo, {error: 'invalid'}));
    let changes: ReturnType<typeof parseRecurringIncomeBulkEdit>;
    try {
      changes = parseRecurringIncomeBulkEdit(data);
    } catch {
      return invalid();
    }
    const where = {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id};
    if (changes.salesChannelId && !await prisma.incomeSalesChannel.findFirst({where: {id: changes.salesChannelId, workspaceId: current.workspace.id}})) return invalid();
    if (changes.paymentMethodId && !await prisma.paymentMethod.findFirst({where: {id: changes.paymentMethodId, workspaceId: current.workspace.id}})) return invalid();
    if (changes.bankId && !await prisma.bank.findFirst({where: {id: changes.bankId, workspaceId: current.workspace.id}})) return invalid();
    if (changes.startDate && await prisma.recurringIncome.findFirst({where: {...where, endDate: {lt: changes.startDate}}, select: {id: true}})) return invalid();
    const result = await prisma.recurringIncome.updateMany({where, data: changes});
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE',
      entityType: 'RecurringIncome', metadata: {ids, operation: bulkAction, fields: Object.keys(changes), updated: result.count}, request
    });
    return redirectToPath(appendFlash(returnTo, {saved: 'bulk_updated'}));
  }
  return redirectToPath(returnTo);
}
