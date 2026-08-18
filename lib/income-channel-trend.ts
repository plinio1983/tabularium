import {DEFAULT_COMPANY_TIME_ZONE, zonedCalendarParts} from '@/lib/company-time';

export type IncomeChannelTrendRecord = {
  amount: unknown;
  creditDate: Date;
  salesChannelId: number;
  salesChannelRef: {name: string; icon?: string | null};
};

export type IncomeChannelTrendChannel = {
  id: number;
  name: string;
  icon: string | null;
  total: number;
  count: number;
};

export type IncomeChannelTrendMonth = {
  month: number;
  label: string;
  from: string;
  to: string;
  total: number;
  count: number;
  channels: IncomeChannelTrendChannel[];
};

export type IncomeChannelTrendQuarter = {
  quarter: number;
  weeks: IncomeChannelTrendMonth[];
};

export type IncomeChannelTrendData = {
  year: number;
  total: number;
  count: number;
  months: IncomeChannelTrendMonth[];
  quarters: IncomeChannelTrendQuarter[];
  channels: IncomeChannelTrendChannel[];
};

export type IncomeChannelComparisonPoint = {
  bucketIndex: number;
  amount: number;
  indexValue: number | null;
  previousChange: number | null;
};

export type IncomeChannelComparisonSeries = IncomeChannelTrendChannel & {
  share: number;
  baseValue: number | null;
  points: IncomeChannelComparisonPoint[];
};

export function buildIncomeChannelComparisonSeries(
  buckets: IncomeChannelTrendMonth[],
  channels: IncomeChannelTrendChannel[]
): IncomeChannelComparisonSeries[] {
  const periodTotal = buckets.reduce((sum, bucket) => sum + bucket.total, 0);
  return channels.map(channel => {
    const amounts = buckets.map(bucket => bucket.channels.find(item => item.id === channel.id)?.total ?? 0);
    const baseIndex = amounts.findIndex(amount => amount > 0);
    const baseValue = baseIndex >= 0 ? amounts[baseIndex] : null;
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    const points = amounts.map((amount, bucketIndex) => {
      const previous = bucketIndex > 0 ? amounts[bucketIndex - 1] : null;
      return {
        bucketIndex,
        amount,
        indexValue: baseValue !== null && bucketIndex >= baseIndex ? amount / baseValue * 100 : null,
        previousChange: previous !== null && previous > 0 ? (amount - previous) / previous * 100 : null
      };
    });
    return {...channel, total, share: periodTotal ? total / periodTotal * 100 : 0, baseValue, points};
  }).filter(channel => channel.total > 0).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'it'));
}

export function leadingIncomeChannelIds(series: IncomeChannelComparisonSeries[], limit = 5) {
  return series.slice(0, Math.max(0, limit)).map(channel => channel.id);
}

export function incomeChannelComparisonDomain(values: number[], includeBaseline?: number) {
  const finite = values.filter(Number.isFinite);
  if (includeBaseline !== undefined) finite.push(includeBaseline);
  if (!finite.length) return {min: 0, max: 1};
  const rawMin = Math.min(...finite);
  const rawMax = Math.max(...finite);
  const span = Math.max(rawMax - rawMin, Math.abs(rawMax) * .1, 1);
  return {
    min: Math.max(0, rawMin - span * .1),
    max: rawMax + span * .1
  };
}

const monthLabels = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function dateInput(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isoUtcDate(date: Date) {
  return dateInput(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function shortDate(date: Date) {
  return `${date.getUTCDate()} ${monthLabels[date.getUTCMonth()]}`;
}

function createQuarterWeeks(year: number, quarter: number) {
  const quarterStart = new Date(Date.UTC(year, (quarter - 1) * 3, 1));
  const quarterEnd = new Date(Date.UTC(year, quarter * 3, 1));
  const weeks: Array<{fromDate: Date; toExclusive: Date; bucket: IncomeChannelTrendMonth}> = [];
  let cursor = new Date(quarterStart);
  while (cursor < quarterEnd) {
    const daysToMonday = (8 - cursor.getUTCDay()) % 7 || 7;
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + daysToMonday);
    const toExclusive = next > quarterEnd ? new Date(quarterEnd) : next;
    const inclusiveTo = new Date(toExclusive);
    inclusiveTo.setUTCDate(inclusiveTo.getUTCDate() - 1);
    weeks.push({
      fromDate: new Date(cursor),
      toExclusive,
      bucket: {
        month: cursor.getUTCMonth() + 1,
        label: `${shortDate(cursor)}–${shortDate(inclusiveTo)}`,
        from: isoUtcDate(cursor),
        to: isoUtcDate(inclusiveTo),
        total: 0,
        count: 0,
        channels: [],
      },
    });
    cursor = toExclusive;
  }
  return weeks;
}

export function aggregateIncomeChannelTrend(records: IncomeChannelTrendRecord[], year: number, timeZone = DEFAULT_COMPANY_TIME_ZONE): IncomeChannelTrendData {
  const monthMaps = Array.from({length: 12}, () => new Map<number, IncomeChannelTrendChannel>());
  const quarterWeeks = Array.from({length: 4}, (_, index) => createQuarterWeeks(year, index + 1));
  const weekMaps = quarterWeeks.map(weeks => weeks.map(() => new Map<number, IncomeChannelTrendChannel>()));
  const channelMap = new Map<number, IncomeChannelTrendChannel>();

  for (const record of records) {
    const parts = zonedCalendarParts(record.creditDate, timeZone);
    if (!parts || parts.year !== year) continue;
    const amount = Number(record.amount);
    if (!Number.isFinite(amount)) continue;
    const base = {id: record.salesChannelId, name: record.salesChannelRef.name, icon: record.salesChannelRef.icon ?? null};
    const monthly = monthMaps[parts.month - 1].get(base.id) ?? {...base, total: 0, count: 0};
    monthly.total += amount;
    monthly.count += 1;
    monthMaps[parts.month - 1].set(base.id, monthly);
    const quarterIndex = Math.floor((parts.month - 1) / 3);
    const civilDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const weekIndex = quarterWeeks[quarterIndex].findIndex(week => civilDate >= week.fromDate && civilDate < week.toExclusive);
    if (weekIndex >= 0) {
      const weekly = weekMaps[quarterIndex][weekIndex].get(base.id) ?? {...base, total: 0, count: 0};
      weekly.total += amount;
      weekly.count += 1;
      weekMaps[quarterIndex][weekIndex].set(base.id, weekly);
    }
    const annual = channelMap.get(base.id) ?? {...base, total: 0, count: 0};
    annual.total += amount;
    annual.count += 1;
    channelMap.set(base.id, annual);
  }

  const channels = Array.from(channelMap.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'it'));
  const months = monthMaps.map((map, index) => {
    const month = index + 1;
    const values = Array.from(map.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'it'));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      month,
      label: monthLabels[index],
      from: dateInput(year, month, 1),
      to: dateInput(year, month, lastDay),
      total: values.reduce((sum, value) => sum + value.total, 0),
      count: values.reduce((sum, value) => sum + value.count, 0),
      channels: values,
    };
  });
  const quarters = quarterWeeks.map((weeks, quarterIndex) => ({
    quarter: quarterIndex + 1,
    weeks: weeks.map((week, weekIndex) => {
      const values = Array.from(weekMaps[quarterIndex][weekIndex].values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'it'));
      return {
        ...week.bucket,
        total: values.reduce((sum, value) => sum + value.total, 0),
        count: values.reduce((sum, value) => sum + value.count, 0),
        channels: values,
      };
    }),
  }));

  return {
    year,
    total: channels.reduce((sum, value) => sum + value.total, 0),
    count: channels.reduce((sum, value) => sum + value.count, 0),
    months,
    quarters,
    channels,
  };
}
