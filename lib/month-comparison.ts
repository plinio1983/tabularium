export type MonthComparisonKind = 'previous' | 'year' | 'custom';

export type MonthPeriod = {
  year: number;
  month: number;
};

export function previousMonth(period: MonthPeriod): MonthPeriod {
  return period.month === 1
    ? {year: period.year - 1, month: 12}
    : {year: period.year, month: period.month - 1};
}

export function parseMonthValue(value: string | undefined): MonthPeriod | null {
  const match = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return null;
  return {year: Number(match[1]), month: Number(match[2])};
}

export function comparisonPeriod(
  current: MonthPeriod,
  kind: MonthComparisonKind,
  customValue?: string
): MonthPeriod {
  if (kind === 'year') return {year: current.year - 1, month: current.month};
  if (kind === 'custom') return parseMonthValue(customValue) ?? previousMonth(current);
  return previousMonth(current);
}

export function percentageChange(current: number, comparison: number) {
  if (comparison === 0) return null;
  return ((current - comparison) / Math.abs(comparison)) * 100;
}
