const receivedInvoiceStatuses = new Set(['RICEVUTA', 'INVIATA_SDI']);

export function isExpenseInvoiceNotReceived(expense: { isDeclared: boolean; invoiceStatus?: unknown }) {
  return expense.isDeclared && !receivedInvoiceStatuses.has(String(expense.invoiceStatus));
}
