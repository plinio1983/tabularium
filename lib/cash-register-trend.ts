export type ReceiptTrendAggregate = {
  day: string;
  count: number;
  total: number;
};

export type DailyReceiptTrend = ReceiptTrendAggregate & {
  average: number;
};

export function buildDailyReceiptTrend(
  year: number,
  month: number,
  aggregates: ReceiptTrendAggregate[],
): DailyReceiptTrend[] {
  const byDay = new Map(aggregates.map(item => [item.day, item]));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return Array.from({length: daysInMonth}, (_, index) => {
    const dayNumber = index + 1;
    const day = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const aggregate = byDay.get(day);
    const count = aggregate?.count ?? 0;
    const total = aggregate?.total ?? 0;
    return {
      day,
      count,
      total,
      average: count ? total / count : 0,
    };
  });
}

export function buildDailyReceiptTrendRange(
  from: string,
  to: string,
  aggregates: ReceiptTrendAggregate[],
): DailyReceiptTrend[] {
  const byDay = new Map(aggregates.map(item => [item.day, item]));
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const points: DailyReceiptTrend[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.toISOString().slice(0, 10);
    const aggregate = byDay.get(day);
    const count = aggregate?.count ?? 0;
    const total = aggregate?.total ?? 0;
    points.push({day, count, total, average: count ? total / count : 0});
  }
  return points;
}
