export const defaultQuickPeriod = 'last_90_days';
export const periodOptions = [
  ['last_30_days', 'Ultimi 30 giorni'], ['last_90_days', 'Ultimi 90 giorni'], ['year_to_date', 'Anno intero'],
  ...['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'].map((label, index) => [`month_${String(index + 1).padStart(2, '0')}`, label]),
  ['quarter_1', 'T.1 [ Gen - Mar ]'], ['quarter_2', 'T.2 [ Apr - Giu ]'], ['quarter_3', 'T.3 [ Lug - Set ]'], ['quarter_4', 'T.4 [ Ott - Dic ]'],
  ['custom', 'Data personalizzata'],
];
export const quickPeriodButtons = ['last_30_days', 'last_90_days', 'current_quarter', 'previous_quarter', 'year_to_date'] as const;
export function isRollingPeriod(value: string) { return value === 'last_30_days' || value === 'last_90_days'; }
export function quickPeriodTarget(value: string, now: Date) {
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  if (value === 'current_quarter') return {value: `quarter_${quarter}`, year: String(year)};
  if (value === 'previous_quarter') return {value: `quarter_${quarter > 1 ? quarter - 1 : 4}`, year: String(quarter > 1 ? year : year - 1)};
  return {value, year: String(year)};
}
export function quickPeriodLabel(value: string, now: Date) {
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  if (value === 'last_30_days') return '30 gg';
  if (value === 'last_90_days') return '90 gg';
  if (value === 'current_quarter') return `Tri ${quarter}`;
  if (value === 'previous_quarter') return `Tri ${quarter > 1 ? quarter - 1 : 4}`;
  return 'Anno';
}
