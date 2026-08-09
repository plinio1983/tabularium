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
