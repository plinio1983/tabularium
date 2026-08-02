export const DEFAULT_COMPANY_TIME_ZONE = 'Europe/Rome';

export function isValidTimeZone(value: string) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en', {timeZone: value}).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value?: string | null) {
  return value && isValidTimeZone(value) ? value : DEFAULT_COMPANY_TIME_ZONE;
}

export function supportedCompanyTimeZones() {
  const supportedValuesOf = (Intl as typeof Intl & {supportedValuesOf?: (key: 'timeZone') => string[]}).supportedValuesOf;
  const values = supportedValuesOf ? supportedValuesOf('timeZone') : [DEFAULT_COMPANY_TIME_ZONE, 'UTC'];
  return [DEFAULT_COMPANY_TIME_ZONE, ...values.filter(value => value !== DEFAULT_COMPANY_TIME_ZONE)];
}

export function zonedCalendarParts(value: Date | string, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value ?? 0);
  const year = part('year');
  const month = part('month');
  const day = part('day');
  if (!year || !month || !day) return null;
  return {year, month, day, hour: part('hour'), minute: part('minute'), second: part('second')};
}

export function dateInputInTimeZone(timeZone: string, now = new Date()) {
  const parts = zonedCalendarParts(now, timeZone);
  return parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}` : now.toISOString().slice(0, 10);
}

export function monthInputInTimeZone(timeZone: string, now = new Date()) {
  return dateInputInTimeZone(timeZone, now).slice(0, 7);
}

export function yearMonthInTimeZone(timeZone: string, now = new Date()) {
  const parts = zonedCalendarParts(now, timeZone);
  return parts ? {year: parts.year, month: parts.month} : {year: now.getUTCFullYear(), month: now.getUTCMonth() + 1};
}

/** Calendar surrogate for legacy helpers that use local Date getters.
 * It carries the company's calendar fields in the runtime's local zone and
 * must never be persisted as an instant. */
export function civilDateInTimeZone(timeZone: string, now = new Date()) {
  const parts = zonedCalendarParts(now, timeZone);
  return parts ? new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) : new Date(now);
}

export function calendarDateInput(value?: Date | string | null) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function zonedMidnightUtc(value: string, timeZone: string) {
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const represented = zonedCalendarParts(candidate, timeZone);
  if (!represented) return candidate;
  const representedAsUtc = Date.UTC(represented.year, represented.month - 1, represented.day, represented.hour, represented.minute, represented.second);
  return new Date(candidate.getTime() - (representedAsUtc - candidate.getTime()));
}

export function calendarDayNumber(value: Date | string, timeZone: string, civilDate = false) {
  const input = civilDate ? calendarDateInput(value) : dateInputInTimeZone(timeZone, value instanceof Date ? value : new Date(value));
  if (!input) return null;
  const [year, month, day] = input.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}
