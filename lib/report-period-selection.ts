import {DEFAULT_COMPANY_TIME_ZONE, yearMonthInTimeZone} from './company-time';

export function selectReportPeriods(selection: {
  year: number; month: number; type: 'month' | 'quarter' | 'year'; includeCurrentMonth?: boolean;
}, now = new Date(), timeZone = DEFAULT_COMPANY_TIME_ZONE) {
  const current = yearMonthInTimeZone(timeZone, now);
  const {year, month, type} = selection;
  const quarterStart = Math.floor((month - 1) / 3) * 3 + 1;
  const selectedPeriods = type === 'year'
    ? Array.from({length: 12}, (_, index) => ({year, month: index + 1}))
    : type === 'quarter'
      ? Array.from({length: 3}, (_, index) => ({year, month: quarterStart + index}))
      : [{year, month}];
  const canIncludeCurrentMonth = type !== 'month' && year === current.year
    && (type === 'year' || Math.floor((month - 1) / 3) === Math.floor((current.month - 1) / 3));
  const includeCurrentMonth = canIncludeCurrentMonth && selection.includeCurrentMonth === true;
  const cutoff = current.year * 12 + current.month;
  const reportPeriods = type === 'month' ? selectedPeriods : selectedPeriods.filter(period =>
    period.year * 12 + period.month < cutoff || (includeCurrentMonth && period.year * 12 + period.month === cutoff));
  return {selectedPeriods, reportPeriods, canIncludeCurrentMonth, includeCurrentMonth};
}

export function reportCurrentMonthHref(pathname: string, query: string, include: boolean) {
  const params = new URLSearchParams(query);
  if (include) params.set('includeCurrentMonth', '1');
  else params.delete('includeCurrentMonth');
  const suffix = params.toString();
  return `${pathname}${suffix ? `?${suffix}` : ''}`;
}
