import {calendarDateInput, dateInputInTimeZone, DEFAULT_COMPANY_TIME_ZONE} from '@/lib/company-time';

export type IncomeCreditState = 'ACCREDITATO' | 'PARZIALE' | 'DA_ACCREDITARE' | 'SCADUTO';

type IncomeStatusInput = {
  amount: unknown;
  credits?: Array<{amount: unknown}>;
  dueDate?: Date | string | null;
};

export function incomeCreditedAmount(income: Pick<IncomeStatusInput, 'credits'>) {
  return (income.credits ?? []).reduce((sum, credit) => sum + Number(credit.amount || 0), 0);
}

export function incomeCreditState(income: IncomeStatusInput, today = new Date(), timeZone = DEFAULT_COMPANY_TIME_ZONE): IncomeCreditState {
  const amount = Number(income.amount || 0);
  const credited = incomeCreditedAmount(income);
  const residual = Math.max(0, amount - credited);
  if (amount > 0 && residual <= 0.005) return 'ACCREDITATO';

  const dueDateKey = calendarDateInput(income.dueDate);
  if (residual > 0.005 && dueDateKey && dueDateKey < dateInputInTimeZone(timeZone, today)) return 'SCADUTO';
  if (credited > 0) return 'PARZIALE';
  return 'DA_ACCREDITARE';
}

export function isIncomeOverdue(income: IncomeStatusInput, today = new Date(), timeZone = DEFAULT_COMPANY_TIME_ZONE) {
  return incomeCreditState(income, today, timeZone) === 'SCADUTO';
}
