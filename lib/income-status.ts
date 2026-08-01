export type IncomeCreditState = 'ACCREDITATO' | 'PARZIALE' | 'DA_ACCREDITARE' | 'SCADUTO';

type IncomeStatusInput = {
  amount: unknown;
  credits?: Array<{amount: unknown}>;
  dueDate?: Date | string | null;
};

function localDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function incomeCreditedAmount(income: Pick<IncomeStatusInput, 'credits'>) {
  return (income.credits ?? []).reduce((sum, credit) => sum + Number(credit.amount || 0), 0);
}

export function incomeCreditState(income: IncomeStatusInput, today = new Date()): IncomeCreditState {
  const amount = Number(income.amount || 0);
  const credited = incomeCreditedAmount(income);
  const residual = Math.max(0, amount - credited);
  if (amount > 0 && residual <= 0.005) return 'ACCREDITATO';

  const dueDateKey = income.dueDate ? localDateKey(income.dueDate) : '';
  if (residual > 0.005 && dueDateKey && dueDateKey < localDateKey(today)) return 'SCADUTO';
  if (credited > 0) return 'PARZIALE';
  return 'DA_ACCREDITARE';
}

export function isIncomeOverdue(income: IncomeStatusInput, today = new Date()) {
  return incomeCreditState(income, today) === 'SCADUTO';
}
