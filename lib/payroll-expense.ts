export function resolveExpenseAmounts(input: {
  isPayroll: boolean;
  amount: number;
  payrollNetAmount?: number;
  payrollExtraCompensation?: number;
}) {
  if (!input.isPayroll) return {
    amount: input.amount,
    payrollNetAmount: null,
    payrollExtraCompensation: null,
  };

  const payrollNetAmount = Number(input.payrollNetAmount ?? 0);
  const payrollExtraCompensation = Number(input.payrollExtraCompensation ?? 0);
  if (!Number.isFinite(payrollNetAmount) || payrollNetAmount <= 0) throw new Error('Inserisci un importo netto maggiore di zero');
  if (!Number.isFinite(payrollExtraCompensation) || payrollExtraCompensation < 0) throw new Error('I compensi extra non possono essere negativi');
  return {
    amount: payrollNetAmount + payrollExtraCompensation,
    payrollNetAmount,
    payrollExtraCompensation,
  };
}

function validDateInput(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function resolvePayrollPeriod(input: {
  isPayroll: boolean;
  start?: string;
  end?: string;
  dueDate?: string;
}) {
  if (!input.isPayroll) return {payrollPeriodStart: null, payrollPeriodEnd: null};

  const payrollPeriodStart = validDateInput(input.start);
  const payrollPeriodEnd = validDateInput(input.end);
  if (!payrollPeriodStart || !payrollPeriodEnd) throw new Error('Indica il periodo lavorato completo');
  if (payrollPeriodStart > payrollPeriodEnd) throw new Error('La data iniziale del periodo lavorato non può superare quella finale');
  if (!validDateInput(input.dueDate)) throw new Error('Indica la data di scadenza della busta paga');

  return {payrollPeriodStart, payrollPeriodEnd};
}
