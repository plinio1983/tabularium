import type {Prisma} from '@/generated/prisma/client';
import {isRecurringDateSuspended} from '@/lib/recurring-suspensions';

export async function canGenerateRecurringOccurrence(tx: Prisma.TransactionClient, kind: 'expense' | 'income', id: number, date: Date | string) {
  type State = {isActive: boolean; suspensionPeriods: unknown};
  const rows = kind === 'expense'
    ? await tx.$queryRaw<State[]>`SELECT "isActive", "suspensionPeriods" FROM "RecurringExpense" WHERE id = ${id} FOR UPDATE`
    : await tx.$queryRaw<State[]>`SELECT "isActive", "suspensionPeriods" FROM "RecurringIncome" WHERE id = ${id} FOR UPDATE`;
  return Boolean(rows[0]?.isActive && !isRecurringDateSuspended(date, rows[0].suspensionPeriods));
}
