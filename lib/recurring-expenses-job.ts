import { prisma } from '@/lib/prisma';

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
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addMonths(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function clampDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month, 0).getDate();
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
  return (toYear - from.getFullYear()) * 12 + ((toMonth - 1) - from.getMonth());
}

function isCadenceDue(startDate: Date, dueYear: number, dueMonth: number, cadence: string) {
  const diff = monthDiff(startDate, dueYear, dueMonth);
  if (diff < 0) return false;
  return diff % cadenceMonths(cadence) === 0;
}

function calculateDueDates(recurringExpense: any, todayInput: Date) {
  const today = startOfDay(todayInput);
  const startDate = startOfDay(new Date(recurringExpense.startDate));

  if (startDate > today) return [];

  const dueDates: Date[] = [];
  const cursorStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const cursorEnd = new Date(today.getFullYear(), today.getMonth(), 1);

  for (
    let cursor = cursorStart;
    cursor <= cursorEnd;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    const cursorYear = cursor.getFullYear();
    const cursorMonth = cursor.getMonth() + 1;
    const dueYear = cursorYear;
    const dueMonth = recurringExpense.dueMonth || cursorMonth;

    if (recurringExpense.dueMonth && dueMonth !== cursorMonth) continue;
    if (!isCadenceDue(startDate, dueYear, dueMonth, recurringExpense.cadence)) continue;

    const dueDay = clampDay(dueYear, dueMonth, recurringExpense.dueDay || startDate.getDate());
    const dueDate = startOfDay(new Date(dueYear, dueMonth - 1, dueDay));

    if (dueDate < startDate) continue;
    if (dueDate > today) continue;

    dueDates.push(dueDate);
  }

  return Array.from(new Map(dueDates.map(date => [date.toISOString().slice(0, 10), date])).values())
    .sort((a, b) => a.getTime() - b.getTime());
}

function billingPeriodFromDueDate(recurringExpense: any, dueDate: Date) {
  const dueYear = dueDate.getFullYear();
  const dueMonth = dueDate.getMonth() + 1;

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

function getRecurringPaymentMethod(recurringExpense: any) {
  return recurringExpense.paymentMethod ?? null;
}

function getRecurringPaymentChannel(recurringExpense: any) {
  return getRecurringPaymentMethod(recurringExpense)?.name ?? recurringExpense.paymentChannel ?? null;
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
      paymentMethod: true
    }
  });

  for (const recurringExpense of recurringExpenses as any[]) {
    result.checked += 1;

    try {
      const dueDates = calculateDueDates(recurringExpense, todayInput);

      if (!dueDates.length) {
        result.skipped += 1;
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

        const existing = await prisma.expense.findFirst({
          where: {
            workspaceId: recurringExpense.workspaceId || null,
            recurringExpenseId: recurringExpense.id,
            recurringExpensePeriodKey
          }
        });

        if (existing) {
          result.skipped += 1;
          continue;
        }

        await prisma.expense.create({
          data: {
            workspaceId: recurringExpense.workspaceId || null,
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
            bankId: recurringExpense.bankId || null,
            channel: getRecurringPaymentChannel(recurringExpense),
            notes: recurringExpense.notes || null,
            recurringExpenseId: recurringExpense.id,
            recurringExpensePeriodKey
          }
        });

        result.created += 1;
      }
    } catch (error) {
      result.errors.push({
        recurringExpenseId: recurringExpense.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return result;
}

export async function settleAutomaticRecurringPayments(todayInput = new Date()): Promise<AutomaticRecurringPaymentJobResult> {
  const result: AutomaticRecurringPaymentJobResult = { checked: 0, created: 0, skipped: 0, errors: [] };
  const today = startOfDay(todayInput);

  const expenses = await prisma.expense.findMany({
    where: {
      paymentStatus: { not: 'COMPLETATO' },
      dueDate: {
        lte: today
      },
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
      }
    }
  });

  for (const expense of expenses as any[]) {
    result.checked += 1;

    try {
      if (!expense.dueDate || !expense.recurringExpense) {
        result.skipped += 1;
        continue;
      }

      if (!isAutomaticRecurringPayment(expense.recurringExpense)) {
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
            channel: getRecurringPaymentChannel(expense.recurringExpense),
            paymentMethodId: expense.recurringExpense.paymentMethodId || expense.recurringExpense.paymentMethod?.id || null,
            bankId: expense.recurringExpense.bankId || null,
            amount: residual,
            paidBy: 'HERBAL_MARKET'
          }
        }),
        prisma.expense.update({
          where: { id: expense.id },
          data: {
            paymentDate: expense.dueDate,
            bankId: expense.recurringExpense.bankId || null,
            channel: getRecurringPaymentChannel(expense.recurringExpense),
            paidAmount: amount,
            paymentStatus: 'COMPLETATO',
            isComplete: true,
            isAutomaticPayment: true,
            paidByCurrentAccount: true,
            paidBy: 'HERBAL_MARKET'
          }
        })
      ]);

      result.created += 1;
    } catch (error) {
      result.errors.push({
        expenseId: expense.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return result;
}

export async function runRecurringExpensesDailyJob(todayInput = new Date()): Promise<RecurringExpenseDailyJobResult> {
  const generate = await generateRecurringExpenses(todayInput);
  const payments = await settleAutomaticRecurringPayments(todayInput);
  return { generate, payments };
}
