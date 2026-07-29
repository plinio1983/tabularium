function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function expenseDateDayOffset(from?: Date | null, to?: Date | null) {
  if (!from || !to) return null;
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function addExpenseDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function expenseDateInRelativeMonth(
  value: Date | null | undefined,
  anchor: Date | null | undefined,
  now: Date,
) {
  if (!value) return null;
  const monthOffset = anchor
    ? (value.getFullYear() - anchor.getFullYear()) * 12 + value.getMonth() - anchor.getMonth()
    : 0;
  const targetYear = now.getFullYear();
  const targetMonth = now.getMonth() + monthOffset;
  const day = Math.min(value.getDate(), daysInMonth(targetYear, targetMonth));
  const date = new Date(targetYear, targetMonth, day);
  date.setHours(0, 0, 0, 0);
  return date;
}
