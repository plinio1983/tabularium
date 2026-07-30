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
