import {expenseResidualAmount, isExpensePastDue, type ExpenseWithPayments} from './expense-calculations';
import {isExpenseInvoiceNotReceived} from './expense-invoice';
import {incomeCreditSummary} from './income-credits';

export const expenseTaskLabels = {overdue: 'Pagamenti scaduti', missing_invoice: 'Fatture non ricevute'};
export const incomeTaskLabels = {missing_invoice: 'Fatture non emesse', uncredited: 'Incassi da accreditare'};
export type ExpenseTask = keyof typeof expenseTaskLabels;
export type IncomeTask = keyof typeof incomeTaskLabels;

export function parseExpenseTask(value: string): ExpenseTask | null {
  return value === 'overdue' || value === 'missing_invoice' ? value : null;
}
export function parseIncomeTask(value: string): IncomeTask | null {
  return value === 'uncredited' || value === 'missing_invoice' ? value : null;
}

type TaskExpense = ExpenseWithPayments & {isDeclared: boolean; invoiceStatus?: unknown; expenseType?: unknown};
type TaskIncome = {amount: unknown; credits: Array<{amount: unknown}>; isFiscal: boolean; invoiceStatus?: string | null; incomeType?: string};

export function matchesExpenseTask(expense: TaskExpense, task: ExpenseTask, now: Date, timeZone: string) {
  return task === 'overdue' ? isExpensePastDue(expense, now, timeZone) : isExpenseInvoiceNotReceived(expense);
}
export function matchesIncomeTask(income: TaskIncome, task: IncomeTask) {
  return task === 'uncredited'
    ? incomeCreditSummary(income).residual > 0.005
    : income.incomeType !== 'CASH_REGISTER' && income.isFiscal && income.invoiceStatus !== 'EMESSA';
}

export function summarizeDashboardTasks(expenses: TaskExpense[], incomes: TaskIncome[], now: Date, timeZone: string) {
  const summarize = <T,>(records: T[], matches: (record: T) => boolean, amount: (record: T) => number) =>
    records.reduce((result, record) => {
      if (matches(record)) { result.count += 1; result.amount += amount(record); }
      return result;
    }, {count: 0, amount: 0});
  return {
    overdue: summarize(expenses, expense => matchesExpenseTask(expense, 'overdue', now, timeZone), expenseResidualAmount),
    invoicesNotReceived: summarize(expenses, expense => matchesExpenseTask(expense, 'missing_invoice', now, timeZone), expense => Number(expense.amount)),
    invoicesNotEmitted: summarize(incomes, income => matchesIncomeTask(income, 'missing_invoice'), income => Number(income.amount)),
    uncredited: summarize(incomes, income => matchesIncomeTask(income, 'uncredited'), income => incomeCreditSummary(income).residual),
  };
}
