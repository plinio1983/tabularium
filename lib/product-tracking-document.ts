import {trackingDocumentError} from '@/lib/product-tracking-wizard';
import type {TrackingInvoiceFormState, TrackingInvoiceRow} from '@/lib/product-tracking-invoice';

export type TrackingDocument = {id: number; originalName: string; sizeBytes?: number | null};
export type TrackingDocumentFormState = TrackingInvoiceFormState;
export function documentDraftError(row: TrackingInvoiceRow) {
  if (!row.id && !row.file) return 'Seleziona un documento di tracciamento.';
  return row.file ? trackingDocumentError(0, [row.file]) : '';
}
export function appendTrackingDocuments(data: FormData, state: TrackingDocumentFormState) {
  if (state.hasDraft) throw new Error('Conferma o annulla il documento di tracciamento aperto prima di salvare.');
  for (const row of state.rows) {
    const error = documentDraftError(row);
    if (error) throw new Error(error);
    if (row.id) {
      if (row.file) data.append(`trackingReplacement-${row.id}`, row.file);
    } else data.append('TRACKING', row.file!);
  }
  state.removedIds.forEach(id => data.append('removedIds', String(id)));
}
