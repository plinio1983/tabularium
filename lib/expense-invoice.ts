const receivedInvoiceStatuses = new Set(['RICEVUTA', 'INVIATA_SDI']);
const notExpectedInvoiceStatuses = new Set(['NON_PREVISTA']);

export function isExpenseInvoiceNotReceived(expense: { isDeclared: boolean; invoiceStatus?: unknown; expenseType?: unknown }) {
  if (expense.expenseType === 'VAT_SETTLEMENT' || expense.expenseType === 'TAX_CONTRIBUTION') return false;
  const invoiceStatus = String(expense.invoiceStatus);
  return expense.isDeclared && !notExpectedInvoiceStatuses.has(invoiceStatus) && !receivedInvoiceStatuses.has(invoiceStatus);
}
