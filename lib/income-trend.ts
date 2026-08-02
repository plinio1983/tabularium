import {prisma} from '@/lib/prisma';
import {DEFAULT_COMPANY_TIME_ZONE, zonedCalendarParts, zonedMidnightUtc, yearMonthInTimeZone} from '@/lib/company-time';

export type IncomeTrendInterval = 'day' | 'week' | 'month';

export type IncomeTrendPoint = {
  from: string;
  to: string;
  label: string;
  value: number;
  count: number;
  cumulative: number;
};

export type IncomeTrendData = {
  year: number;
  interval: IncomeTrendInterval;
  total: number;
  count: number;
  points: IncomeTrendPoint[];
};

type IncomeTrendRecord = {amount: unknown; creditDate: Date};

const monthLabels = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function isoDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function dayLabel(date: Date) {
  return `${String(date.getUTCDate()).padStart(2, '0')} ${monthLabels[date.getUTCMonth()]}`;
}

function bucketStart(date: Date, year: number, interval: IncomeTrendInterval) {
  if (interval === 'month') return new Date(Date.UTC(year, date.getUTCMonth(), 1));
  if (interval === 'week') {
    const monday = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate() - ((date.getUTCDay() + 6) % 7)));
    return monday.getUTCFullYear() < year ? new Date(Date.UTC(year, 0, 1)) : monday;
  }
  return new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
}

function createBuckets(year: number, interval: IncomeTrendInterval, throughMonth = 12) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, Math.max(0, Math.min(12, throughMonth)), 1));
  const buckets: Array<{from: Date; to: Date}> = [];
  let cursor = new Date(start);

  while (cursor < end) {
    const from = new Date(cursor);
    let next: Date;
    if (interval === 'month') next = new Date(Date.UTC(year, cursor.getUTCMonth() + 1, 1));
    else if (interval === 'week') {
      next = new Date(cursor);
      next.setUTCDate(next.getUTCDate() + (cursor.getUTCDay() === 1 ? 7 : (8 - cursor.getUTCDay()) % 7 || 7));
    } else {
      next = new Date(cursor);
      next.setUTCDate(next.getUTCDate() + 1);
    }
    buckets.push({from, to: next > end ? end : next});
    cursor = next;
  }
  return buckets;
}

export function aggregateIncomeTrend(records: IncomeTrendRecord[], year: number, interval: IncomeTrendInterval, throughMonth = 12, timeZone = DEFAULT_COMPANY_TIME_ZONE): IncomeTrendData {
  const totals = new Map<string, {value: number; count: number}>();
  for (const record of records) {
    const parts = zonedCalendarParts(record.creditDate, timeZone);
    if (!parts || parts.year !== year) continue;
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const key = isoDate(bucketStart(date, year, interval));
    const current = totals.get(key) ?? {value: 0, count: 0};
    current.value += Number(record.amount);
    current.count += 1;
    totals.set(key, current);
  }

  let cumulative = 0;
  let count = 0;
  const points = createBuckets(year, interval, throughMonth).map(({from, to}) => {
    const current = totals.get(isoDate(from)) ?? {value: 0, count: 0};
    cumulative += current.value;
    count += current.count;
    const inclusiveTo = new Date(to);
    inclusiveTo.setUTCDate(inclusiveTo.getUTCDate() - 1);
    return {
      from: isoDate(from),
      to: isoDate(inclusiveTo),
      label: interval === 'month'
        ? monthLabels[from.getUTCMonth()]
        : interval === 'week'
          ? `${dayLabel(from)} – ${dayLabel(inclusiveTo)}`
          : dayLabel(from),
      value: current.value,
      count: current.count,
      cumulative
    };
  });

  return {year, interval, total: cumulative, count, points};
}

function completedMonthCount(year: number, timeZone: string, now = new Date()) {
  const current = yearMonthInTimeZone(timeZone, now);
  if (year < current.year) return 12;
  if (year > current.year) return 0;
  return current.month - 1;
}

export async function getIncomeTrendData(year: number, interval: IncomeTrendInterval, workspaceId: number, companyId: number, completedOnly = false, timeZone = DEFAULT_COMPANY_TIME_ZONE) {
  const throughMonth = completedOnly ? completedMonthCount(year, timeZone) : 12;
  const end = new Date(Date.UTC(year, throughMonth, 1));
  const endInput = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const records = await prisma.incomeCredit.findMany({
    where: {
      income: {workspaceId, companyId},
      creditDate: {gte: zonedMidnightUtc(`${year}-01-01`, timeZone), lt: zonedMidnightUtc(endInput, timeZone)}
    },
    select: {amount: true, creditDate: true}
  });
  return aggregateIncomeTrend(records, year, interval, throughMonth, timeZone);
}
