import { prisma } from '@/lib/prisma';

const LOOKAHEAD_DAYS = 30;

export type RecurringExpenseJobResult = {
  checked: number;
  created: number;
  skipped: number;
  errors: Array<{ recurringExpenseId: number; message: string }>;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
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

function calculateDueDate(recurringExpense: any, today: Date) {
  const normalizedToday = startOfDay(today);
  const startDate = startOfDay(new Date(recurringExpense.startDate));
  const candidates: Date[] = [];

  for (let offset = 0; offset <= 2; offset += 1) {
    const candidateMonth = addMonths(normalizedToday.getFullYear(), normalizedToday.getMonth() + 1, offset);
    const dueYear = candidateMonth.year;
    const dueMonth = recurringExpense.dueMonth || candidateMonth.month;

    if (!isCadenceDue(startDate, dueYear, dueMonth, recurringExpense.cadence)) continue;

    const dueDay = clampDay(dueYear, dueMonth, recurringExpense.dueDay || startDate.getDate());
    const dueDate = startOfDay(new Date(dueYear, dueMonth - 1, dueDay));

    if (dueDate < startDate) continue;
    candidates.push(dueDate);
  }

  return candidates.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
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

export async function generateRecurringExpenses(todayInput = new Date()): Promise<RecurringExpenseJobResult> {
  const today = startOfDay(todayInput);
  const limitDate = addDays(today, LOOKAHEAD_DAYS);
  const result: RecurringExpenseJobResult = { checked: 0, created: 0, skipped: 0, errors: [] };

  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: { isActive: true },
    include: { payments: false } as any
  }).catch(async () => prisma.recurringExpense.findMany({ where: { isActive: true } }));

  for (const recurringExpense of recurringExpenses as any[]) {
    result.checked += 1;

    try {
      const dueDate = calculateDueDate(recurringExpense, today);

      if (!dueDate || dueDate < today || dueDate > limitDate) {
        result.skipped += 1;
        continue;
      }

      const billingPeriod = billingPeriodFromDueDate(recurringExpense, dueDate);
      const recurringExpensePeriodKey = periodKey(billingPeriod.year, billingPeriod.month);

      const existing = await prisma.expense.findFirst({
        where: {
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
          receivedDate: dueDate,
          dueDate,
          merchant: recurringExpense.merchant,
          supplierId: recurringExpense.supplierId || null,
          categoryId: recurringExpense.categoryId || null,
          description: recurringExpense.description,
          amount: recurringExpense.amount,
          vatRate: recurringExpense.vatRate,
          paymentStatus: 'DA_PAGARE',
          invoiceStatus: recurringExpense.hasElectronicInvoice ? 'IN_ATTESA' : 'NON_PREVISTA',
          month: billingPeriod.month,
          year: billingPeriod.year,
          hasElectronicInvoice: recurringExpense.hasElectronicInvoice,
          isDeclared: recurringExpense.isDeclared,
          isRecurring: true,
          isAutomaticPayment: recurringExpense.accrualType === 'AUTOMATICO',
          bankId: recurringExpense.bankId || null,
          notes: recurringExpense.notes || null,
          recurringExpenseId: recurringExpense.id,
          recurringExpensePeriodKey
        }
      });

      result.created += 1;
    } catch (error) {
      result.errors.push({
        recurringExpenseId: recurringExpense.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return result;
}
