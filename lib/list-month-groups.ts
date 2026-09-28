export type DateSort = {field: string; direction: 'asc' | 'desc'; kind: 'date' | 'billing'; timeZone: string};

export function listDateSort(sort: string, timeZone = 'UTC'): DateSort | null {
  const match = /^(receivedDate|orderDate|creditDate|dueDate|paymentDate|createdAt|updatedAt|billingPeriod)_(asc|desc)$/.exec(sort);
  if (!match) return null;
  return {field: match[1], direction: match[2] as 'asc' | 'desc', kind: match[1] === 'billingPeriod' ? 'billing' : 'date',
    timeZone: ['createdAt', 'updatedAt'].includes(match[1]) ? timeZone : 'UTC'};
}

type DatedRecord = {
  receivedDate?: Date | null; orderDate?: Date | null; creditDate?: Date | null;
  dueDate?: Date | null; paymentDate?: Date | null; createdAt?: Date; updatedAt?: Date;
  month?: number; year?: number; billingMonth?: number; billingYear?: number;
};

export function listDateValue(record: DatedRecord, sort: DateSort | null) {
  if (!sort) return null;
  if (sort.kind === 'billing') {
    const year = record.billingYear ?? record.year;
    const month = record.billingMonth ?? record.month;
    return year && month ? year * 12 + month : null;
  }
  const value = record[sort.field as keyof DatedRecord];
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.getTime() : null;
}

export function compareListDates(a: number | null, b: number | null, direction: 'asc' | 'desc') {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return (a - b) * (direction === 'asc' ? 1 : -1);
}

export function listMonthKey(value: number | null, kind: 'date' | 'billing', timeZone = 'UTC') {
  if (value === null || !Number.isFinite(value)) return '';
  if (kind === 'billing') {
    const year = Math.floor((value - 1) / 12);
    return `${year}-${String(value - year * 12).padStart(2, '0')}`;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en', {year: 'numeric', month: '2-digit', timeZone}).formatToParts(date);
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
}

export function listMonthLabel(key: string) {
  if (!key) return 'Senza data';
  const label = new Intl.DateTimeFormat('it-IT', {month: 'long', year: 'numeric', timeZone: 'UTC'})
    .format(new Date(`${key}-01T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function hasMultipleMonths(keys: string[]) {
  return new Set(keys.filter(Boolean)).size > 1;
}

export function isSingleMonthRange(from: string, to: string) {
  return /^\d{4}-\d{2}/.test(from) && /^\d{4}-\d{2}/.test(to) && from.slice(0, 7) === to.slice(0, 7);
}
