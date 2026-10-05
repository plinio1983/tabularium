/** Shared conversion rules; no persistence or side effects. */
export const expenseConversionTypes = ['STANDARD', 'PAYROLL', 'TAX_CONTRIBUTION', 'COUNTER'] as const;
export type ExpenseConversionType = typeof expenseConversionTypes[number];
export const conversionLabels: Record<string, string> = {
    STANDARD: 'Singola', PAYROLL: 'Busta paga', TAX_CONTRIBUTION: 'Imposte/F24', CASH_REGISTER: 'Scontrino', COUNTER: 'Da banco'
};

export function canConvertExpense(source: {expenseType: string; isRecurring: boolean; recurringExpenseId: number | null}) {
    return expenseConversionTypes.some(type => type === source.expenseType);
}
export function canConvertIncome(source: {incomeType: string; recurringIncomeId: number | null}) {
    return ['STANDARD', 'CASH_REGISTER'].includes(source.incomeType);
}

export function expenseConversionDefaults<T extends {amount?: string | number | {toString(): string} | null; expenseType?: string}>(source: T, target: ExpenseConversionType) {
    const payroll = target === 'PAYROLL';
    const defaults = {
        expenseType: target, supplierId: null, employeeId: null, taxAuthorityId: null, merchant: '',
        payrollNetAmount: payroll ? source.amount : null, payrollExtraCompensation: payroll ? 0 : null,
        payrollGrossAmount: null, payrollEmployerCost: null, payrollPeriodStart: null, payrollPeriodEnd: null,
        isRecurring: false, isDeclared: target === 'STANDARD', hasElectronicInvoice: target === 'STANDARD',
        invoiceStatus: target === 'STANDARD' ? 'IN_ATTESA' : 'NON_PREVISTA',
        vatRate: target === 'STANDARD' ? 22 : 0, affectsFiscalProfit: target !== 'STANDARD'
    };
    return {...source, ...defaults} as Omit<T, keyof typeof defaults> & typeof defaults;
}

export function assertCoveredAmount(amount: number, linkedTotal: number) {
    if (Math.round(amount * 100) < Math.round(linkedTotal * 100)) {
        throw new Error('L’importo non può essere inferiore ai pagamenti o accrediti già registrati.');
    }
}
