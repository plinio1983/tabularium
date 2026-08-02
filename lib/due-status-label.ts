import {calendarDateInput, calendarDayNumber, DEFAULT_COMPANY_TIME_ZONE} from '@/lib/company-time';

export function shortDueDate(value: Date | string) {
  const input = calendarDateInput(value);
  const date = new Date(`${input}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', {timeZone: 'UTC', day: 'numeric', month: 'short'}).format(date)
    .replaceAll('.', '')
    .replace(/\b([a-zàèéìòù])/gu, character => character.toUpperCase());
}

export function dueStatusLabel({
  dueDate,
  isComplete,
  isPartial,
  completeLabel,
  pendingFallback,
  timeZone = DEFAULT_COMPANY_TIME_ZONE
}: {
  dueDate?: Date | string | null;
  isComplete: boolean;
  isPartial: boolean;
  completeLabel: string;
  pendingFallback: string;
  timeZone?: string;
}) {
  if (isComplete) return completeLabel;
  if (!dueDate) return isPartial ? 'Parziale' : pendingFallback;

  const dueDay = calendarDayNumber(dueDate, timeZone, true);
  const today = calendarDayNumber(new Date(), timeZone);
  if (dueDay === null || today === null) return isPartial ? 'Parziale' : pendingFallback;

  const overdueDays = today - dueDay;
  if (overdueDays > 0) return `Scaduto +${overdueDays}gg`;

  const date = shortDueDate(dueDate);
  return isPartial ? `Parziale ${date}` : `Entro ${date}`;
}
