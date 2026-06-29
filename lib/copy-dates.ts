export function localDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localMonthInputValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateInputValue(value?: string | Date | null) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (Number.isNaN(value.getTime())) return '';
  return value.toISOString().slice(0, 10);
}

export function clampDateToToday(value?: string | Date | null, today = localDateInputValue()) {
  const candidate = dateInputValue(value);
  return candidate && candidate > today ? candidate : today;
}

export function clampPeriodToCurrentMonth(month?: number | null, year?: number | null, today = new Date()) {
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const candidateYear = Number(year);
  const candidateMonth = Number(month);

  if (
    Number.isInteger(candidateYear)
    && Number.isInteger(candidateMonth)
    && candidateMonth >= 1
    && candidateMonth <= 12
    && candidateYear * 12 + candidateMonth > currentYear * 12 + currentMonth
  ) {
    return { year: candidateYear, month: candidateMonth };
  }

  return { year: currentYear, month: currentMonth };
}
