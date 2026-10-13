import {parseTrackingDate} from '@/lib/product-tracking';

export type TrackingInvoice = {id: number; originalName: string; invoiceDate: string; sizeBytes?: number | null};
export type TrackingInvoiceRow = {key: string; id?: number; originalName: string; invoiceDate: string; sizeBytes?: number | null; file?: File};
export type TrackingInvoiceFormState = {rows: TrackingInvoiceRow[]; removedIds: number[]; hasDraft: boolean};

export function invoiceRow(invoice: TrackingInvoice): TrackingInvoiceRow {
  return {...invoice, key: `saved-${invoice.id}`};
}
export function invoiceDraftError(row: TrackingInvoiceRow) {
  if (!row.id && !row.file) return 'Seleziona un documento fattura.';
  if (row.file) {
    if (!row.file.size) return 'Il documento fattura non può essere vuoto.';
    if (row.file.size > 10 * 1024 * 1024) return 'Il documento fattura supera il limite di 10 MB.';
    if (!/\.(pdf|jpe?g|png|webp|xml|p7m)$/i.test(row.file.name)) return 'Formato del documento fattura non consentito.';
  }
  try {parseTrackingDate(row.invoiceDate, true);} catch (error) {return error instanceof Error ? error.message : 'Data fattura non valida.';}
  return '';
}
/** Only confirmed records are submitted; new dates follow the new-file order. */
export function appendTrackingInvoices(data: FormData, state: TrackingInvoiceFormState) {
  if (state.hasDraft) throw new Error('Conferma o annulla la fattura aperta prima di salvare.');
  let nextIndex = 0;
  for (const row of state.rows) {
    const error = invoiceDraftError(row);
    if (error) throw new Error(error);
    if (row.id) {
      data.set(`invoiceDate-${row.id}`, row.invoiceDate);
      if (row.file) data.append(`invoiceReplacement-${row.id}`, row.file);
    } else {
      data.append('INVOICE', row.file!);
      data.set(`invoiceDate-new-${nextIndex++}`, row.invoiceDate);
    }
  }
  state.removedIds.forEach(id => data.append('removedIds', String(id)));
}
