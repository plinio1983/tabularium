import {prisma} from '@/lib/prisma';

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayLabel(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')} ${monthLabels[date.getMonth()]}`;
}

function bucketStart(date: Date, year: number, interval: IncomeTrendInterval) {
  if (interval === 'month') return new Date(year, date.getMonth(), 1);
  if (interval === 'week') {
    const monday = new Date(year, date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
    return monday.getFullYear() < year ? new Date(year, 0, 1) : monday;
  }
  return new Date(year, date.getMonth(), date.getDate());
}

function createBuckets(year: number, interval: IncomeTrendInterval, throughMonth = 12) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, Math.max(0, Math.min(12, throughMonth)), 1);
  const buckets: Array<{from: Date; to: Date}> = [];
  let cursor = new Date(start);

  while (cursor < end) {
    const from = new Date(cursor);
    let next: Date;
    if (interval === 'month') next = new Date(year, cursor.getMonth() + 1, 1);
    else if (interval === 'week') {
      next = new Date(cursor);
      next.setDate(next.getDate() + (cursor.getDay() === 1 ? 7 : (8 - cursor.getDay()) % 7 || 7));
    } else {
      next = new Date(cursor);
      next.setDate(next.getDate() + 1);
    }
    buckets.push({from, to: next > end ? end : next});
    cursor = next;
  }
  return buckets;
}

export function aggregateIncomeTrend(records: IncomeTrendRecord[], year: number, interval: IncomeTrendInterval, throughMonth = 12): IncomeTrendData {
  const totals = new Map<string, {value: number; count: number}>();
  for (const record of records) {
    const date = new Date(record.creditDate);
    if (date.getFullYear() !== year) continue;
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
    inclusiveTo.setDate(inclusiveTo.getDate() - 1);
    return {
      from: isoDate(from),
      to: isoDate(inclusiveTo),
      label: interval === 'month'
        ? monthLabels[from.getMonth()]
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

function completedMonthCount(year: number, now = new Date()) {
  if (year < now.getFullYear()) return 12;
  if (year > now.getFullYear()) return 0;
  return now.getMonth();
}

export async function getIncomeTrendData(year: number, interval: IncomeTrendInterval, workspaceId: number, companyId: number, completedOnly = false) {
  const throughMonth = completedOnly ? completedMonthCount(year) : 12;
  const records = await prisma.incomeCredit.findMany({
    where: {
      income: {workspaceId, companyId},
      creditDate: {gte: new Date(year, 0, 1), lt: new Date(year, throughMonth, 1)}
    },
    select: {amount: true, creditDate: true}
  });
  return aggregateIncomeTrend(records, year, interval, throughMonth);
}
