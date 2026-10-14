export type ReceiptLine = {amount: number; isFiscal: boolean; vatRate: number; description?: string | null};
export const receiptLineLimit = 200;
export function receiptLineSummary(lines: ReceiptLine[]) {
  let totalCents = 0, fiscalCents = 0, vatCents = 0;
  if (!lines.length || lines.length > receiptLineLimit) throw new Error(`Inserisci da 1 a ${receiptLineLimit} importi.`);
  for (const line of lines) {
    if (!line || typeof line.amount !== 'number' || line.description != null && (typeof line.description !== 'string' || line.description.length > 200)) throw new Error('Importo o descrizione non validi.');
    const cents = Math.round(line.amount * 100);
    if (!Number.isFinite(line.amount) || cents <= 0 || line.amount > 999999999.99 || Math.abs(line.amount * 100 - cents) > 0.00001) throw new Error('Importo non valido: usa al massimo due decimali.');
    if (typeof line.isFiscal !== 'boolean' || ![0, 4, 10, 22].includes(line.vatRate) || (!line.isFiscal && line.vatRate !== 0)) throw new Error('Aliquota IVA non valida.');
    totalCents += cents;
    if (line.isFiscal) {
      fiscalCents += cents;
      vatCents += Math.round(cents * line.vatRate / (100 + line.vatRate));
    }
  }
  if (totalCents > 99999999999) throw new Error('Totale scontrino troppo alto.');
  const rates = [...new Set(lines.filter(line => line.isFiscal).map(line => line.vatRate))];
  return {amount: totalCents / 100, receiptFiscalAmount: fiscalCents / 100, receiptVatAmount: vatCents / 100,
    isFiscal: fiscalCents > 0, vatRate: rates.length === 1 ? rates[0] : 0,
    hasNonFiscal: lines.some(line => !line.isFiscal), mixed: rates.length > 1 || fiscalCents > 0 && fiscalCents < totalCents,
    net: (totalCents - vatCents) / 100};
}
export function existingReceiptLines(record: {amount: unknown; isFiscal: boolean; vatRate: unknown; receiptLines?: Array<{amount: unknown; isFiscal: boolean; vatRate: unknown; description?: string | null}>}): ReceiptLine[] {
  return record.receiptLines?.length ? record.receiptLines.map(line => ({amount: Number(line.amount), isFiscal: line.isFiscal, vatRate: Number(line.vatRate), description: line.description}))
    : [{amount: Number(record.amount), isFiscal: record.isFiscal, vatRate: record.isFiscal ? Number(record.vatRate) : 0}];
}
export function receiptLinesData(lines: ReceiptLine[]) {
  return lines.map((line, position) => ({position, amount: line.amount, isFiscal: line.isFiscal, vatRate: line.isFiscal ? line.vatRate : 0, description: line.description || null}));
}
export function incomeFiscalAmount(record: {amount: unknown; isFiscal?: boolean; receiptFiscalAmount?: unknown; incomeType?: string}) {
  return record.receiptFiscalAmount != null && (!record.incomeType || record.incomeType === 'CASH_REGISTER') ? Number(record.receiptFiscalAmount) : record.isFiscal ? Number(record.amount) : 0;
}
export function incomeVatAmount(record: {amount: unknown; isFiscal?: boolean; vatRate?: unknown; receiptVatAmount?: unknown; incomeType?: string}) {
  if (record.receiptVatAmount != null && (!record.incomeType || record.incomeType === 'CASH_REGISTER')) return Number(record.receiptVatAmount);
  const rate = Number(record.vatRate || 0);
  return record.isFiscal && rate ? Number(record.amount) * rate / (100 + rate) : 0;
}
