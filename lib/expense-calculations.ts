export type ExpenseWithPayments = {
  amount: unknown;
  dueDate?: Date | null;
  payments?: Array<{ amount: unknown }>;
};

export function expenseResidualAmount(expense: ExpenseWithPayments) {
  const expenseAmount = Number(expense.amount);
  const paidAmount = (expense.payments ?? []).reduce(
    (partial, payment) => partial + Number(payment.amount),
    0
  );
  return Math.max(expenseAmount - paidAmount, 0);
}

export function isExpenseOpen(expense: ExpenseWithPayments) {
  return expenseResidualAmount(expense) > 0;
}

export function isExpensePastDue(expense: ExpenseWithPayments, now = new Date()) {
  if (!expense.dueDate || expenseResidualAmount(expense) <= 0) return false;
  const due = new Date(expense.dueDate);
  const today = new Date(now);
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function sortExpensesByReceivedDateDesc<T extends { id: number; receivedDate?: Date | null }>(expenses: T[]) {
  return [...expenses].sort((a, b) => {
    const dateA = a.receivedDate ? new Date(a.receivedDate).getTime() : 0;
    const dateB = b.receivedDate ? new Date(b.receivedDate).getTime() : 0;
    return dateB - dateA || b.id - a.id;
  });
}
