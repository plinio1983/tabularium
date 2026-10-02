type ExpenseTypeSource = {expenseType?: string; isRecurring?: boolean; recurringExpenseId?: number | null};

/** Keep the type visible also for records generated from a recurrence. */
export function expenseTypeLabel(source: ExpenseTypeSource) {
    const label = ({STANDARD: 'S', PAYROLL: 'BP', TAX_CONTRIBUTION: 'IC', VAT_SETTLEMENT: 'IVA', COUNTER: 'B'} as Record<string, string>)[source.expenseType ?? 'STANDARD'] ?? 'S';
    return `${source.isRecurring || source.recurringExpenseId ? 'R' : ''}${label}`;
}

export function incomeTypeLabel(source: {incomeType?: string; recurringIncomeId?: number | null}) {
    return `${source.recurringIncomeId ? 'R' : ''}${source.incomeType === 'CASH_REGISTER' ? 'SC' : 'S'}`;
}
