import { prisma } from '@/lib/prisma';
import {calendarDateInput, dateInputInTimeZone} from '@/lib/company-time';
import {createSystemNotification} from '@/lib/notifications';

export type RecurringExpenseJobResult = {
  checked: number;
  created: number;
  skipped: number;
  errors: Array<{ recurringExpenseId: number; message: string }>;
};

export type AutomaticRecurringPaymentJobResult = {
  checked: number;
  created: number;
  skipped: number;
  errors: Array<{ expenseId: number; message: string }>;
};

export type RecurringExpenseDailyJobResult = {
  generate: RecurringExpenseJobResult;
  payments: AutomaticRecurringPaymentJobResult;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = startOfDay(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function recurringExpenseGenerationDate(dueDateInput: Date, timing = 'FIRST_OF_MONTH') {
  const dueDate = startOfDay(dueDateInput);
  if (timing === 'FIRST_OF_MONTH') {
    return new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), 1));
  }
  const daysBefore: Record<string, number> = {
    DAYS_7_BEFORE: 7,
    DAYS_10_BEFORE: 10,
    DAYS_15_BEFORE: 15,
    DAYS_30_BEFORE: 30,
    ON_DUE_DATE: 0
  };
  return addDays(dueDate, -(daysBefore[timing] ?? 0));
}

function addMonths(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function clampDay(year: number, month: number, day: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.min(Math.max(day, 1), lastDay);
}

function cadenceMonths(cadence: string) {
  if (cadence === 'MONTHLY') return 1;
  if (cadence === 'EVERY_2_MONTHS') return 2;
  if (cadence === 'EVERY_3_MONTHS') return 3;
  if (cadence === 'EVERY_6_MONTHS') return 6;
  if (cadence === 'YEARLY') return 12;
  if (cadence === 'EVERY_2_YEARS') return 24;
  return 1;
}

function monthDiff(from: Date, toYear: number, toMonth: number) {
  return (toYear - from.getUTCFullYear()) * 12 + ((toMonth - 1) - from.getUTCMonth());
}

function isCadenceDue(startDate: Date, dueYear: number, dueMonth: number, cadence: string) {
  const diff = monthDiff(startDate, dueYear, dueMonth);
  if (diff < 0) return false;
  return diff % cadenceMonths(cadence) === 0;
}

export function calculateRecurringExpenseDueDates(recurringExpense: any, todayInput: Date) {
  const today = startOfDay(todayInput);
  const startDate = startOfDay(new Date(recurringExpense.startDate));
  const endDate = recurringExpense.endDate ? startOfDay(new Date(recurringExpense.endDate)) : null;
  const lookAheadEnd = addDays(today, 30);
  const occurrenceEnd = endDate && endDate < lookAheadEnd ? endDate : lookAheadEnd;

  if (startDate > occurrenceEnd) return [];

  const dueDates: Date[] = [];
  const cursorStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const cursorEnd = new Date(Date.UTC(occurrenceEnd.getUTCFullYear(), occurrenceEnd.getUTCMonth(), 1));

  for (
    let cursor = cursorStart;
    cursor <= cursorEnd;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    const cursorYear = cursor.getUTCFullYear();
    const cursorMonth = cursor.getUTCMonth() + 1;
    const dueYear = cursorYear;
    const dueMonth = recurringExpense.dueMonth || cursorMonth;

    if (recurringExpense.dueMonth && dueMonth !== cursorMonth) continue;
    if (!isCadenceDue(startDate, dueYear, dueMonth, recurringExpense.cadence)) continue;

    const dueDay = clampDay(dueYear, dueMonth, recurringExpense.dueDay || startDate.getUTCDate());
    const dueDate = startOfDay(new Date(Date.UTC(dueYear, dueMonth - 1, dueDay)));

    if (dueDate < startDate) continue;
    if (dueDate > occurrenceEnd) continue;
    if (recurringExpenseGenerationDate(dueDate, recurringExpense.generationTiming) > today) continue;

    dueDates.push(dueDate);
  }

  return Array.from(new Map(dueDates.map(date => [date.toISOString().slice(0, 10), date])).values())
    .sort((a, b) => a.getTime() - b.getTime());
}

function billingPeriodFromDueDate(recurringExpense: any, dueDate: Date) {
  const dueYear = dueDate.getUTCFullYear();
  const dueMonth = dueDate.getUTCMonth() + 1;

  if (recurringExpense.billingPeriodMode === 'NEXT_MONTH') {
    return addMonths(dueYear, dueMonth, 1);
  }

  if (recurringExpense.billingPeriodMode === 'CUSTOM_MONTH' && recurringExpense.billingMonth) {
    return { year: dueYear, month: recurringExpense.billingMonth };
  }

  return { year: dueYear, month: dueMonth };
}

function periodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function isAutomaticRecurringPayment(recurringExpense: any) {
  return Boolean(recurringExpense?.isAutomaticPayment);
}

export async function generateRecurringExpenses(todayInput = new Date()): Promise<RecurringExpenseJobResult> {
  const result: RecurringExpenseJobResult = { checked: 0, created: 0, skipped: 0, errors: [] };

  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: { isActive: true },
    include: {
      supplier: true,
      paymentMethod: true,
      company: true
    }
  });

  for (const recurringExpense of recurringExpenses as any[]) {
    result.checked += 1;

    try {
      const errorsBefore = result.errors.length;
      const companyToday = startOfDay(new Date(`${dateInputInTimeZone(recurringExpense.company.timeZone, todayInput)}T00:00:00Z`));
      const dueDates = calculateRecurringExpenseDueDates(recurringExpense, companyToday);
      const excludedPeriodKeys = new Set((await prisma.recurringExpenseExclusion.findMany({
        where: {recurringExpenseId: recurringExpense.id},
        select: {periodKey: true}
      })).map(exclusion => exclusion.periodKey));

      if (!dueDates.length) {
        result.skipped += 1;
        if (recurringExpense.endDate && companyToday > startOfDay(new Date(recurringExpense.endDate))) {
          await prisma.recurringExpense.update({where: {id: recurringExpense.id}, data: {isActive: false, archivedAt: companyToday}});
        }
        continue;
      }

      for (const dueDate of dueDates) {
        if (!recurringExpense.supplierId || !recurringExpense.supplier) {
          result.errors.push({ recurringExpenseId: recurringExpense.id, message: 'Fornitore mancante' });
          result.skipped += 1;
          continue;
        }

        const billingPeriod = billingPeriodFromDueDate(recurringExpense, dueDate);
        const recurringExpensePeriodKey = periodKey(billingPeriod.year, billingPeriod.month);

        if (excludedPeriodKeys.has(recurringExpensePeriodKey)) {
          result.skipped += 1;
          continue;
        }

        const existing = await prisma.expense.findFirst({
          where: {
            workspaceId: recurringExpense.workspaceId || null,
            companyId: recurringExpense.companyId,
            recurringExpenseId: recurringExpense.id,
            recurringExpensePeriodKey
          }
        });

        if (existing) {
          result.skipped += 1;
          continue;
        }

        await prisma.$transaction(async tx => {
          const expense = await tx.expense.create({
            data: {
            workspaceId: recurringExpense.workspaceId || null,
            companyId: recurringExpense.companyId,
            receivedDate: dueDate,
            dueDate,
            merchant: recurringExpense.supplier.businessName,
            supplierId: recurringExpense.supplierId,
            categoryId: recurringExpense.categoryId || null,
            description: recurringExpense.description,
            amount: recurringExpense.amount,
            vatRate: recurringExpense.vatRate,
            paymentStatus: 'DA_PAGARE',
            invoiceStatus: recurringExpense.isDeclared ? 'IN_ATTESA' : 'NON_PREVISTA',
            month: billingPeriod.month,
            year: billingPeriod.year,
            hasElectronicInvoice: recurringExpense.hasElectronicInvoice,
            isDeclared: recurringExpense.isDeclared,
            isRecurring: true,
            isAutomaticPayment: isAutomaticRecurringPayment(recurringExpense),
            notes: recurringExpense.notes || null,
            recurringExpenseId: recurringExpense.id,
            recurringExpensePeriodKey
            }
          });
          await createSystemNotification({
            workspaceId: recurringExpense.company.workspaceId,
            companyId: recurringExpense.companyId,
            type: 'RECURRING_EXPENSE_CREATED',
            title: 'Spesa ricorrente creata',
            message: `${recurringExpense.supplier.businessName}: generata la spesa ${recurringExpensePeriodKey}.`,
            actionUrl: `/expenses/${expense.id}`,
            sourceType: 'Expense',
            sourceId: expense.id,
            dedupeKey: `recurring-expense-created:${recurringExpense.id}:${recurringExpensePeriodKey}`
          }, tx);
        });

        result.created += 1;
      }
      if (result.errors.length === errorsBefore && recurringExpense.endDate && companyToday > startOfDay(new Date(recurringExpense.endDate))) {
        await prisma.recurringExpense.update({where: {id: recurringExpense.id}, data: {isActive: false, archivedAt: companyToday}});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({
        recurringExpenseId: recurringExpense.id,
        message
      });
      await createSystemNotification({
        workspaceId: recurringExpense.company.workspaceId,
        companyId: recurringExpense.companyId,
        type: 'RECURRING_JOB_FAILED',
        severity: 'CRITICAL',
        title: 'Generazione spesa ricorrente non riuscita',
        message: `${recurringExpense.description || recurringExpense.merchant}: ${message}`,
        actionUrl: `/recurring-expenses/${recurringExpense.id}`,
        sourceType: 'RecurringExpense',
        sourceId: recurringExpense.id,
        dedupeKey: `recurring-expense-failed:${recurringExpense.id}:${dateInputInTimeZone(recurringExpense.company.timeZone, todayInput)}`,
        recipientRoles: ['OWNER', 'ADMIN']
      }).catch(() => undefined);
    }
  }

  return result;
}

export async function settleAutomaticRecurringPayments(todayInput = new Date()): Promise<AutomaticRecurringPaymentJobResult> {
  const result: AutomaticRecurringPaymentJobResult = { checked: 0, created: 0, skipped: 0, errors: [] };
  const expenses = await prisma.expense.findMany({
    where: {
      paymentStatus: { not: 'COMPLETATO' },
      dueDate: {not: null},
      OR: [
        { isAutomaticPayment: true },
        { recurringExpense: { isAutomaticPayment: true } }
      ]
    },
    include: {
      payments: true,
      recurringExpense: {
        include: {
          paymentMethod: true
        }
      },
      company: true
    }
  });

  for (const expense of expenses as any[]) {
    result.checked += 1;

    try {
      if (!expense.dueDate || calendarDateInput(expense.dueDate) > dateInputInTimeZone(expense.company.timeZone, todayInput)) {
        result.skipped += 1;
        continue;
      }
      if (!expense.dueDate || !expense.recurringExpense) {
        result.skipped += 1;
        continue;
      }

      if (!isAutomaticRecurringPayment(expense.recurringExpense)) {
        result.skipped += 1;
        continue;
      }
      if (!expense.recurringExpense.paymentMethodId) {
        result.errors.push({ expenseId: expense.id, message: 'Metodo di pagamento automatico mancante' });
        await createSystemNotification({
          workspaceId: expense.company.workspaceId, companyId: expense.companyId, type: 'AUTOMATIC_PAYMENT_FAILED', severity: 'CRITICAL',
          title: 'Pagamento automatico non riuscito', message: `${expense.merchant}: metodo di pagamento automatico mancante.`,
          actionUrl: `/recurring-expenses/${expense.recurringExpense.id}`, sourceType: 'Expense', sourceId: expense.id,
          dedupeKey: `automatic-payment-failed:${expense.id}:${dateInputInTimeZone(expense.company.timeZone, todayInput)}`, recipientRoles: ['OWNER', 'ADMIN']
        }).catch(() => undefined);
        result.skipped += 1;
        continue;
      }

      const amount = Number(expense.amount.toString());
      const paid = expense.payments.reduce((sum: number, payment: any) => sum + Number(payment.amount.toString()), 0);
      const residual = Math.max(0, amount - paid);

      if (residual <= 0) {
        await prisma.expense.update({
          where: { id: expense.id },
          data: {
            paymentStatus: 'COMPLETATO',
            paidAmount: amount,
            isComplete: true,
            paymentDate: expense.dueDate,
            isAutomaticPayment: true
          }
        });
        result.skipped += 1;
        continue;
      }

      await prisma.$transaction([
        prisma.expensePayment.create({
          data: {
            expenseId: expense.id,
            paymentDate: expense.dueDate,
            paymentMethodId: expense.recurringExpense.paymentMethodId,
            bankId: expense.recurringExpense.bankId || null,
            amount: residual
          }
        }),
        prisma.expense.update({
          where: { id: expense.id },
          data: {
            paymentDate: expense.dueDate,
            paidAmount: amount,
            paymentStatus: 'COMPLETATO',
            isComplete: true,
            isAutomaticPayment: true
          }
        })
      ]);

      await createSystemNotification({
        workspaceId: expense.company.workspaceId,
        companyId: expense.companyId,
        type: 'AUTOMATIC_PAYMENT_COMPLETED',
        title: 'Pagamento automatico registrato',
        message: `${expense.merchant}: registrato il pagamento automatico della spesa #${expense.id}.`,
        actionUrl: `/expenses/${expense.id}`,
        sourceType: 'Expense',
        sourceId: expense.id,
        dedupeKey: `automatic-payment-completed:${expense.id}`
      });

      result.created += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({
        expenseId: expense.id,
        message
      });
      await createSystemNotification({
        workspaceId: expense.company.workspaceId, companyId: expense.companyId, type: 'AUTOMATIC_PAYMENT_FAILED', severity: 'CRITICAL',
        title: 'Pagamento automatico non riuscito', message: `${expense.merchant}: ${message}`,
        actionUrl: `/expenses/${expense.id}`, sourceType: 'Expense', sourceId: expense.id,
        dedupeKey: `automatic-payment-failed:${expense.id}:${dateInputInTimeZone(expense.company.timeZone, todayInput)}`, recipientRoles: ['OWNER', 'ADMIN']
      }).catch(() => undefined);
    }
  }

  return result;
}

export async function runRecurringExpensesDailyJob(todayInput = new Date()): Promise<RecurringExpenseDailyJobResult> {
  const generate = await generateRecurringExpenses(todayInput);
  const payments = await settleAutomaticRecurringPayments(todayInput);
  return { generate, payments };
}
