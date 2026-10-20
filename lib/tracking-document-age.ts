import {calendarDateInput} from './company-time';

type DocumentDate = Date | string | null | undefined;

export function trackingDocumentAgeClass(age: {days: number | null}) {
  // The agreed display convention defines a month as 30 days.
  return age.days !== null && age.days > 180
    ? 'badge color-badge tone-warning tracking-document-age'
    : 'muted tracking-document-age';
}
function validCalendarDate(value: DocumentDate) {
  const date = calendarDateInput(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date ? date : null;
}

export function latestTrackingDocumentDate(values: DocumentDate[]) {
  return values.reduce<string | null>((latest, value) => {
    const date = validCalendarDate(value);
    return date && (!latest || date > latest) ? date : latest;
  }, null);
}

export function trackingDocumentAge(value: DocumentDate, today: string) {
  const date = validCalendarDate(value);
  const current = validCalendarDate(today);
  if (!date || !current) return {date, days: null, label: 'Data mancante'};
  // These are calendar dates, not elapsed 24-hour intervals across DST changes.
  const days = Math.round((Date.parse(`${current}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
  let label: string;
  if (days < 0) label = 'Data futura';
  else if (days <= 14) label = `${days} ${days === 1 ? 'giorno' : 'giorni'}`;
  else if (days < 21) label = '<3 sett';
  else if (days <= 28) label = `${Math.floor(days / 7)} sett`;
  else if (days < 30) label = '<1 Mese';
  else {
    const months = Math.floor(days / 30);
    label = days % 30 >= 15 ? `<${months + 1} mesi` : `${months} ${months === 1 ? 'Mese' : 'mesi'}`;
  }
  return {date, days, label};
}
