import {prisma} from '@/lib/prisma';
import {dateInputInTimeZone} from '@/lib/company-time';
import type {NotificationSeverity, NotificationType, Prisma} from '@/generated/prisma/client';

type NotificationDb = Prisma.TransactionClient | typeof prisma;
type RecipientRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER';

export type CreateSystemNotificationInput = {
  workspaceId: number;
  companyId?: number | null;
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string | null;
  sourceType?: string | null;
  sourceId?: number | string | null;
  dedupeKey: string;
  occurredAt?: Date;
  expiresAt?: Date | null;
  recipientRoles?: RecipientRole[];
};

export async function createSystemNotification(input: CreateSystemNotificationInput, db: NotificationDb = prisma) {
  const roles = input.recipientRoles ?? ['OWNER', 'ADMIN', 'ACCOUNTANT'];
  const notification = await db.notification.upsert({
    where: {workspaceId_dedupeKey: {workspaceId: input.workspaceId, dedupeKey: input.dedupeKey}},
    create: {
      workspaceId: input.workspaceId,
      companyId: input.companyId ?? null,
      type: input.type,
      severity: input.severity ?? 'INFO',
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId === null || input.sourceId === undefined ? null : String(input.sourceId),
      dedupeKey: input.dedupeKey,
      occurredAt: input.occurredAt ?? new Date(),
      expiresAt: input.expiresAt ?? null
    },
    update: {}
  });

  const members = await db.workspaceMember.findMany({
    where: {workspaceId: input.workspaceId, role: {in: roles}, user: {isActive: true}},
    select: {userId: true}
  });
  if (members.length) {
    await db.notificationRecipient.createMany({
      data: members.map(member => ({notificationId: notification.id, userId: member.userId})),
      skipDuplicates: true
    });
  }
  return notification;
}

function euro(value: unknown) {
  return new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR'}).format(Number(String(value)) || 0);
}

function daysBetween(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

export type DueNotificationJobResult = {checked: number; created: number; errors: Array<{entityType: string; entityId: number; message: string}>};

export async function generateDueNotifications(todayInput = new Date()): Promise<DueNotificationJobResult> {
  const result: DueNotificationJobResult = {checked: 0, created: 0, errors: []};
  const horizon = new Date(todayInput.getTime() + 8 * 86_400_000);
  const [expenses, incomes] = await Promise.all([
    prisma.expense.findMany({
      where: {dueDate: {not: null, lte: horizon}, paymentStatus: {not: 'COMPLETATO'}},
      include: {company: true, supplier: {select: {businessName: true}}}
    }),
    prisma.income.findMany({
      where: {dueDate: {not: null, lte: horizon}, isCredited: false},
      include: {company: true, customer: {select: {businessName: true}}}
    })
  ]);

  for (const expense of expenses) {
    result.checked += 1;
    try {
      const today = dateInputInTimeZone(expense.company.timeZone, todayInput);
      const due = dateInputInTimeZone(expense.company.timeZone, expense.dueDate!);
      const days = daysBetween(today, due);
      if (days > 7) continue;
      const overdue = days < 0;
      if (!overdue && days !== 7 && days !== 0) continue;
      const marker = overdue ? 'overdue' : `due-${days}`;
      await createSystemNotification({
        workspaceId: expense.company.workspaceId,
        companyId: expense.companyId,
        type: overdue ? 'EXPENSE_OVERDUE' : 'EXPENSE_DUE_SOON',
        severity: overdue ? 'CRITICAL' : 'WARNING',
        title: overdue ? 'Spesa scaduta' : days === 0 ? 'Spesa in scadenza oggi' : 'Spesa in scadenza',
        message: `${expense.supplier?.businessName ?? expense.merchant}: ${euro(expense.amount)}${days > 0 ? `, scadenza tra ${days} giorni` : overdue ? `, scaduta da ${Math.abs(days)} giorni` : ''}.`,
        actionUrl: `/expenses/${expense.id}`,
        sourceType: 'Expense',
        sourceId: expense.id,
        dedupeKey: `expense:${expense.id}:${marker}`
      });
      result.created += 1;
    } catch (error) {
      result.errors.push({entityType: 'Expense', entityId: expense.id, message: error instanceof Error ? error.message : String(error)});
    }
  }

  for (const income of incomes) {
    result.checked += 1;
    try {
      const today = dateInputInTimeZone(income.company.timeZone, todayInput);
      const due = dateInputInTimeZone(income.company.timeZone, income.dueDate!);
      const days = daysBetween(today, due);
      if (days > 7) continue;
      const overdue = days < 0;
      if (!overdue && days !== 7 && days !== 0) continue;
      const marker = overdue ? 'overdue' : `due-${days}`;
      await createSystemNotification({
        workspaceId: income.company.workspaceId,
        companyId: income.companyId,
        type: overdue ? 'INCOME_OVERDUE' : 'INCOME_DUE_SOON',
        severity: overdue ? 'CRITICAL' : 'WARNING',
        title: overdue ? 'Incasso scaduto' : days === 0 ? 'Incasso in scadenza oggi' : 'Incasso in scadenza',
        message: `${income.customer?.businessName ?? income.description ?? 'Incasso'}: ${euro(income.amount)}${days > 0 ? `, scadenza tra ${days} giorni` : overdue ? `, scaduto da ${Math.abs(days)} giorni` : ''}.`,
        actionUrl: `/incomes/${income.id}`,
        sourceType: 'Income',
        sourceId: income.id,
        dedupeKey: `income:${income.id}:${marker}`
      });
      result.created += 1;
    } catch (error) {
      result.errors.push({entityType: 'Income', entityId: income.id, message: error instanceof Error ? error.message : String(error)});
    }
  }

  return result;
}
