const receivedInvoiceStatuses = new Set(['RICEVUTA', 'INVIATA_SDI']);
const notExpectedInvoiceStatuses = new Set(['NON_PREVISTA']);

export const emittableExpenseInvoiceStatuses = ['IN_ATTESA', 'PARZIALE', 'CONTESTAZIONE'] as const;

export function canMarkExpenseInvoiceEmitted(expense: {expenseType: string; isDeclared: boolean; invoiceStatus: string}) {
  return expense.expenseType === 'STANDARD'
    && expense.isDeclared
    && emittableExpenseInvoiceStatuses.some(status => status === expense.invoiceStatus);
}

export function isExpenseInvoiceNotReceived(expense: { isDeclared: boolean; invoiceStatus?: unknown; expenseType?: unknown }) {
  if (expense.expenseType === 'VAT_SETTLEMENT' || expense.expenseType === 'TAX_CONTRIBUTION' || expense.expenseType === 'PAYROLL') return false;
  const invoiceStatus = String(expense.invoiceStatus);
  return expense.isDeclared && !notExpectedInvoiceStatuses.has(invoiceStatus) && !receivedInvoiceStatuses.has(invoiceStatus);
}
