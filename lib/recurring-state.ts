import {prisma} from '@/lib/prisma';
import {Prisma} from '@/generated/prisma/client';
import {dateInputInTimeZone} from '@/lib/company-time';
import {RecurringStateError, recurringStateChange} from '@/lib/recurring-suspensions';

export type RecurringKind = 'expense' | 'income';
type Scope = {workspaceId: number; companyId: number; timeZone: string; userId: number};

export async function changeRecurringStateInTransaction(tx: Prisma.TransactionClient, kind: RecurringKind, ids: number[], active: boolean, scope: Scope, request?: Request) {
  const uniqueIds = [...new Set(ids)].sort((a, b) => a - b);
  if (!uniqueIds.length || uniqueIds.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new RecurringStateError('Seleziona almeno una ricorrenza valida.');
  // Lock in a stable order, also shared with generation, so Off cannot race a new occurrence.
  const records = kind === 'expense'
    ? await tx.$queryRaw<Array<{id: number}>>`SELECT id FROM "RecurringExpense" WHERE id IN (${Prisma.join(uniqueIds)}) AND "workspaceId" = ${scope.workspaceId} AND "companyId" = ${scope.companyId} ORDER BY id FOR UPDATE`
    : await tx.$queryRaw<Array<{id: number}>>`SELECT id FROM "RecurringIncome" WHERE id IN (${Prisma.join(uniqueIds)}) AND "workspaceId" = ${scope.workspaceId} AND "companyId" = ${scope.companyId} ORDER BY id FOR UPDATE`;
  if (records.length !== uniqueIds.length) throw new RecurringStateError('Una o più ricorrenze non sono disponibili in questa azienda.');
  const where = {id: {in: uniqueIds}, workspaceId: scope.workspaceId, companyId: scope.companyId};
  const rules = kind === 'expense' ? await tx.recurringExpense.findMany({where}) : await tx.recurringIncome.findMany({where});
  const today = dateInputInTimeZone(scope.timeZone);
  let updated = 0;
  for (const rule of rules) {
    const data = recurringStateChange(rule, active, today);
    if (!data) continue;
    if (kind === 'expense') await tx.recurringExpense.update({where: {id: rule.id}, data});
    else await tx.recurringIncome.update({where: {id: rule.id}, data});
    updated++;
  }
  await tx.auditLog.create({data: {
    workspaceId: scope.workspaceId, userId: scope.userId, action: 'BULK_UPDATE',
    entityType: kind === 'expense' ? 'RecurringExpense' : 'RecurringIncome',
    metadata: {ids: uniqueIds, operation: active ? 'activate' : 'deactivate', updated},
    userAgent: request?.headers.get('user-agent')?.slice(0, 500) || null
  }});
  return updated;
}

export function changeRecurringState(kind: RecurringKind, ids: number[], active: boolean, scope: Scope, request?: Request) {
  return prisma.$transaction(tx => changeRecurringStateInTransaction(tx, kind, ids, active, scope, request));
}
