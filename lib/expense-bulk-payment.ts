export type BulkPaymentExpense = {
  id: number; expenseType: string; amount: unknown; merchant?: string | null;
  dueDate?: string | Date | null; receivedDate?: string | Date | null;
  payments: Array<{amount: unknown}>;
};
export const mixedPaymentMessage = 'Seleziona solo spese oppure solo saldi IVA per inserire un pagamento multiplo.';
export function paymentCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('Importo non valido.');
  return Math.round(amount * 100);
}
export function bulkPaymentRows(expenses: BulkPaymentExpense[]) {
  if (expenses.some(e => e.expenseType === 'VAT_SETTLEMENT') && expenses.some(e => e.expenseType !== 'VAT_SETTLEMENT')) throw new Error(mixedPaymentMessage);
  const key = (date: string | Date | null | undefined) => date ? new Date(date).toISOString().slice(0, 10) : '9999-12-31';
  return [...expenses].sort((a, b) => key(a.dueDate).localeCompare(key(b.dueDate)) || key(a.receivedDate).localeCompare(key(b.receivedDate)) || a.id - b.id)
    .map(e => ({id: e.id, merchant: e.merchant ?? '', expenseType: e.expenseType, residualCents: Math.max(0, paymentCents(e.amount) - e.payments.reduce((sum, p) => sum + paymentCents(p.amount), 0))}));
}
export function allocateBulkPayment(rows: ReturnType<typeof bulkPaymentRows>, cents: number) {
  const total = rows.reduce((sum, row) => sum + row.residualCents, 0);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Inserisci un importo positivo.');
  if (cents > total) throw new Error('L’importo supera il residuo totale delle spese selezionate.');
  let remaining = cents;
  return rows.map(row => {
    const allocatedCents = Math.min(row.residualCents, remaining);
    remaining -= allocatedCents;
    return {...row, allocatedCents};
  });
}
