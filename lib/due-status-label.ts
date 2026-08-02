const APP_TIME_ZONE = 'Europe/Rome';

const calendarDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const shortDateFormatter = new Intl.DateTimeFormat('it-IT', {
  timeZone: APP_TIME_ZONE,
  day: 'numeric',
  month: 'short'
});

function calendarDayNumber(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    calendarDateFormatter.formatToParts(date).map(part => [part.type, part.value])
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function shortDueDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return shortDateFormatter.format(date)
    .replaceAll('.', '')
    .replace(/\b([a-zàèéìòù])/gu, character => character.toUpperCase());
}

export function dueStatusLabel({
  dueDate,
  isComplete,
  isPartial,
  completeLabel,
  pendingFallback
}: {
  dueDate?: Date | string | null;
  isComplete: boolean;
  isPartial: boolean;
  completeLabel: string;
  pendingFallback: string;
}) {
  if (isComplete) return completeLabel;
  if (!dueDate) return isPartial ? 'Parziale' : pendingFallback;

  const dueDay = calendarDayNumber(dueDate);
  const today = calendarDayNumber(new Date());
  if (dueDay === null || today === null) return isPartial ? 'Parziale' : pendingFallback;

  const overdueDays = today - dueDay;
  if (overdueDays > 0) return `Scaduto +${overdueDays}gg`;

  const date = shortDueDate(dueDate);
  return isPartial ? `Parziale ${date}` : `Entro ${date}`;
}
