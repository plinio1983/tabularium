import {expenseResidualAmount, type ExpenseWithPayments} from './expense-calculations';

export function taxAuthorityTotals(expenses: ExpenseWithPayments[]) {
  return expenses.reduce((totals, expense) => {
    const residual = expenseResidualAmount(expense);
    totals.paid += (expense.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
    totals.toPay += residual;
    if (residual > 0) totals.openCount += 1;
    return totals;
  }, {paid: 0, toPay: 0, openCount: 0});
}
