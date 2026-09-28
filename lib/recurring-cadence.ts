export const weekdayOptions = [
  {value: 1, label: 'Lunedì'}, {value: 2, label: 'Martedì'}, {value: 3, label: 'Mercoledì'},
  {value: 4, label: 'Giovedì'}, {value: 5, label: 'Venerdì'}, {value: 6, label: 'Sabato'},
  {value: 7, label: 'Domenica'}
];

export function weekdayLabel(day?: number | string | null) {
  return weekdayOptions.find(option => option.value === Number(day))?.label ?? '—';
}

export function weekdayFromDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay() || 7;
}

// The day field is an ISO weekday (1–7) only for WEEKLY, otherwise a day of month.
export function weeklyDates(start: Date, end: Date, day: number, utc = true) {
  if (!Number.isInteger(day) || day < 1 || day > 7) throw new Error('Seleziona un giorno della settimana valido');
  const cursor = new Date(start);
  const add = (days: number) => utc
    ? cursor.setUTCDate(cursor.getUTCDate() + days)
    : cursor.setDate(cursor.getDate() + days);
  const weekday = (utc ? cursor.getUTCDay() : cursor.getDay()) || 7;
  add((day - weekday + 7) % 7);
  const dates: Date[] = [];
  for (; cursor <= end; add(7)) dates.push(new Date(cursor));
  return dates;
}

// Changing a weekly rule must not backfill the previous schedule's history.
export function requiresNewScheduleStart(previous: {cadence: string; day?: number | null}, next: {cadence: string; day?: number | null}) {
  return (previous.cadence === 'WEEKLY' || next.cadence === 'WEEKLY')
    && (previous.cadence !== next.cadence || previous.day !== next.day);
}
