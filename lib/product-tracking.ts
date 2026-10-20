import {dateInputInTimeZone} from '@/lib/company-time';

export class TrackingValidationError extends Error {
  constructor(message: string, public status = 400) {super(message); this.name = 'TrackingValidationError';}
}

export function parseTrackingDate(value: unknown, required = false, label = 'fattura'): Date | null {
  if (value === '' || value == null) {
    if (required) throw new TrackingValidationError(`La data ${label} è obbligatoria per ogni ${label}.`);
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TrackingValidationError('Data non valida.');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new TrackingValidationError('Data non valida.');
  return date;
}

export function sixMonthsAgo(timeZone: string, now = new Date()) {
  const today = dateInputInTimeZone(timeZone, now);
  const [year, month, day] = today.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 7, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}
export type TrackingSummaryRecord = {entryDate: Date | null; attachments: {kind: string; invoiceDate: Date | null; documentDate?: Date | null}[]};
export function trackingFlags(record: TrackingSummaryRecord, cutoff: Date) {
  const invoices = record.attachments.filter(a => a.kind === 'INVOICE');
  const dates = invoices.flatMap(a => a.invoiceDate ? [a.invoiceDate.getTime()] : []);
  const documentDates = record.attachments.flatMap(a => a.kind === 'TRACKING' && a.documentDate ? [a.documentDate.getTime()] : []);
  return {
    missingInvoice: invoices.length === 0,
    missingTracking: !record.attachments.some(a => a.kind === 'TRACKING'),
    oldInvoice: dates.length > 0 && Math.max(...dates) < cutoff.getTime(),
    oldDocument: documentDates.length > 0 && Math.max(...documentDates) < cutoff.getTime(),
    oldEntry: record.entryDate !== null && record.entryDate < cutoff,
  };
}
export const trackingIndicators = [
  {key: 'missingInvoice', label: 'Tracciamenti senza fattura'},
  {key: 'missingTracking', label: 'Tracciamenti senza allegato di tracciamento'},
  {key: 'oldInvoice', label: 'Ultima fattura oltre 6 mesi'},
  {key: 'oldEntry', label: 'Ingresso oltre 6 mesi'},
] as const;

/** All selected filters combine, including an empty entry date and a date range. */
export function trackingEntryDateWhere(from: Date | null, to: Date | null, missing: boolean) {
  const range = {...(from ? {gte: from} : {}), ...(to ? {lte: to} : {})};
  if (missing && (from || to)) return {AND: [{entryDate: null}, {entryDate: range}]};
  if (missing) return {entryDate: null};
  return from || to ? {entryDate: range} : {};
}
