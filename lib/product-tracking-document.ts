import {parseTrackingDate} from '@/lib/product-tracking';
import {trackingDocumentError} from '@/lib/product-tracking-wizard';
import type {TrackingInvoiceFormState, TrackingInvoiceRow} from '@/lib/product-tracking-invoice';

export type TrackingDocument = {id: number; originalName: string; documentDate?: string; sizeBytes?: number | null};
export type TrackingDocumentFormState = TrackingInvoiceFormState;
export function documentDraftError(row: TrackingInvoiceRow) {
  if (!row.id && !row.file) return 'Seleziona un documento di tracciamento.';
  const fileError = row.file ? trackingDocumentError(0, [row.file]) : '';
  if (fileError) return fileError;
  try {parseTrackingDate(row.documentDate, true, 'documento');} catch (error) {return error instanceof Error ? error.message : 'Data documento non valida.';}
  return '';
}
export function appendTrackingDocuments(data: FormData, state: TrackingDocumentFormState) {
  if (state.hasDraft) throw new Error('Conferma o annulla il documento di tracciamento aperto prima di salvare.');
  let nextIndex = 0;
  for (const row of state.rows) {
    const error = documentDraftError(row);
    if (error) throw new Error(error);
    if (row.id) {
      data.set(`documentDate-${row.id}`, row.documentDate!);
      if (row.file) data.append(`trackingReplacement-${row.id}`, row.file);
    } else {
      data.append('TRACKING', row.file!);
      data.set(`documentDate-new-${nextIndex++}`, row.documentDate!);
    }
  }
  state.removedIds.forEach(id => data.append('removedIds', String(id)));
}
