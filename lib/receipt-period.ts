import {addCalendarDays} from './company-time';
import {defaultQuickPeriod, periodOptions} from './period-selector';
import {stripFlashSearchParams} from './flash';

type Params = Record<string, string | string[] | undefined>;
const value = (params: Params, key: string) => { const item = params[key]; return (Array.isArray(item) ? item[0] : item) ?? ''; };
function validDate(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return '';
  const date = new Date(`${input}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === input ? input : '';
}
const dateAt = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);

export function resolveReceiptPeriod(params: Params, today: string) {
  const currentYear = Number(today.slice(0, 4));
  const requestedYear = Number(value(params, 'dateYear'));
  let year = Number.isInteger(requestedYear) && requestedYear >= 1900 && requestedYear <= 9999 ? requestedYear : currentYear;
  const start = validDate(value(params, 'dateFrom'));
  const end = validDate(value(params, 'dateTo'));
  if (start || end) {
    const dates = [start || end, end || start].sort();
    return {from: dates[0], to: dates[1], quick: 'custom', year: Number(dates[0].slice(0, 4)), annual: false};
  }
  let quick = value(params, 'dateQuick');
  if (!quick) {
    const month = value(params, 'month');
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 1900) {
      year = Number(month.slice(0, 4));
      quick = value(params, 'period') === 'year' ? 'year_to_date' : `month_${month.slice(5, 7)}`;
    } else if (value(params, 'period') === 'year') quick = 'year_to_date';
  }
  if (!periodOptions.some(([option]) => option === quick) || quick === 'custom') quick = defaultQuickPeriod;
  if (quick === 'last_30_days' || quick === 'last_90_days') {
    return {from: addCalendarDays(today, quick === 'last_30_days' ? -29 : -89), to: today, quick, year: currentYear, annual: false};
  }
  if (quick === 'year_to_date') return {from: dateAt(year, 0, 1), to: dateAt(year, 11, 31), quick, year, annual: true};
  const month = quick.startsWith('month_') ? Number(quick.slice(6)) - 1 : (Number(quick.slice(8)) - 1) * 3;
  const length = quick.startsWith('month_') ? 1 : 3;
  return {from: dateAt(year, month, 1), to: dateAt(year, month + length, 0), quick, year, annual: false};
}

export function receiptPeriodParams(current: string, quick: string, year: string) {
  const params = stripFlashSearchParams(new URLSearchParams(current));
  for (const key of ['new', 'month', 'period', 'dateFrom', 'dateTo', 'page']) params.delete(key);
  params.set('dateQuick', quick);
  params.set('dateYear', year);
  return params;
}
