export type SuspensionPeriod = {from: string; to: string | null};

export class RecurringStateError extends Error {}

export function suspensionPeriods(value: unknown): SuspensionPeriod[] {
  if (!Array.isArray(value)) return [];
  return value.map(period => {
    if (!period || typeof period.from !== 'string' || !(period.to === null || typeof period.to === 'string')) {
      throw new Error('Intervallo di sospensione non valido');
    }
    return {from: period.from, to: period.to};
  });
}

/** Civil dates in the company time zone; resume day is included in generation. */
export function isRecurringDateSuspended(date: Date | string, periods: unknown) {
  const day = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
  return suspensionPeriods(periods).some(period => day >= period.from && (period.to === null || day < period.to));
}

export function recurringStateChange(rule: {
  isActive: boolean; startDate: Date; endDate: Date | null; suspensionPeriods: unknown;
}, active: boolean, today: string) {
  if (active && rule.endDate && rule.endDate.toISOString().slice(0, 10) < today) {
    throw new RecurringStateError('Aggiorna la data di fine prima di riattivare una ricorrenza scaduta.');
  }
  if (rule.isActive === active) return null;
  const periods = suspensionPeriods(rule.suspensionPeriods);
  if (active) {
    // Fallback also covers rules automatically archived by the daily job.
    if (!periods.some(period => period.to === null)) periods.push({from: rule.startDate.toISOString().slice(0, 10), to: null});
    periods.forEach(period => {if (period.to === null) period.to = today < period.from ? period.from : today;});
  } else {
    periods.push({from: today, to: null});
  }
  return {isActive: active, archivedAt: null, suspensionPeriods: periods};
}
