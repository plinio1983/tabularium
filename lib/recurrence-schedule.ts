export type RecurrenceDefinition = {
  startDate: Date | string;
  cadence: string;
  day?: number | null;
  month?: number | null;
  billingPeriodMode?: string | null;
  billingMonth?: number | null;
};

export function recurrenceStartOfDay(value: Date | string) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function cadenceMonths(cadence: string) {
  return ({ MONTHLY: 1, EVERY_2_MONTHS: 2, EVERY_3_MONTHS: 3, EVERY_6_MONTHS: 6, YEARLY: 12, EVERY_2_YEARS: 24 } as Record<string, number>)[cadence] ?? 1;
}

function addMonths(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function recurrenceDates(definition: RecurrenceDefinition, untilInput: Date) {
  const until = recurrenceStartOfDay(untilInput);
  const start = recurrenceStartOfDay(definition.startDate);
  if (start > until) return [];
  const dates: Date[] = [];

  for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= until; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    if (definition.month && definition.month !== month) continue;
    const lastDay = new Date(year, month, 0).getDate();
    const date = recurrenceStartOfDay(new Date(year, month - 1, Math.min(Math.max(definition.day ?? start.getDate(), 1), lastDay)));
    if (definition.month) {
      const firstYear = recurrenceStartOfDay(new Date(start.getFullYear(), definition.month - 1, Math.min(Math.max(definition.day ?? start.getDate(), 1), new Date(start.getFullYear(), definition.month, 0).getDate()))) >= start
        ? start.getFullYear() : start.getFullYear() + 1;
      const intervalYears = Math.max(1, cadenceMonths(definition.cadence) / 12);
      if (year < firstYear || (year - firstYear) % intervalYears !== 0) continue;
    } else {
      const diff = (year - start.getFullYear()) * 12 + cursor.getMonth() - start.getMonth();
      if (diff < 0 || diff % cadenceMonths(definition.cadence) !== 0) continue;
    }
    if (date >= start && date <= until) dates.push(date);
  }
  return dates;
}

export function recurrenceBillingPeriod(definition: RecurrenceDefinition, occurrence: Date) {
  const year = occurrence.getFullYear();
  const month = occurrence.getMonth() + 1;
  if (definition.billingPeriodMode === 'NEXT_MONTH') return addMonths(year, month, 1);
  if (definition.billingPeriodMode === 'CUSTOM_MONTH' && definition.billingMonth) return { year, month: definition.billingMonth };
  return { year, month };
}

export function recurrencePeriodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}
