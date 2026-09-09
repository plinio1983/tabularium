import {matchesEntityQuickSearch} from './entity-quick-search';

type ListExpense = {
  expenseType: string;
  isRecurring: boolean;
  supplier?: {businessName: string} | null;
  merchant?: string | null;
  employee?: {firstName: string; lastName: string} | null;
  description?: string | null;
};

export function matchesExpenseType(expense: ListExpense, filter: string) {
  if (filter === 'single') return expense.expenseType === 'STANDARD' && !expense.isRecurring;
  if (filter === 'recurring') return expense.isRecurring;
  const types: Record<string, string> = {
    vat_settlement: 'VAT_SETTLEMENT',
    tax_contribution: 'TAX_CONTRIBUTION',
    payroll: 'PAYROLL',
    counter: 'COUNTER',
  };
  return !types[filter] || expense.expenseType === types[filter];
}

export function matchesExpenseQuickSearch(expense: ListExpense, query: string) {
  return matchesEntityQuickSearch(query, expense.supplier?.businessName, expense.merchant, expense.description,
    expense.employee ? `${expense.employee.firstName} ${expense.employee.lastName}` : null,
    expense.employee ? `${expense.employee.lastName} ${expense.employee.firstName}` : null);
}
