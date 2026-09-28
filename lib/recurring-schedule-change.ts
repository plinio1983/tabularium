import {requiresNewScheduleStart} from './recurring-cadence';
import {calendarDateInput} from './company-time';

export function bulkScheduleChanges<T extends {cadence?: string; startDate?: Date; dueDay?: number; creditDay?: number}>(
  existing: {cadence: string; startDate: Date; dueDay?: number | null; creditDay?: number | null},
  changes: T, kind: 'expense' | 'income', today: string
) {
  const dayField = kind === 'expense' ? 'dueDay' : 'creditDay';
  const monthField = kind === 'expense' ? 'dueMonth' : 'creditMonth';
  const data = {...changes};
  const cadence = changes.cadence ?? existing.cadence;
  if (!changes.cadence && changes[dayField] !== undefined && existing.cadence === 'WEEKLY') {
    throw new Error('Per modificare il giorno delle ricorrenze settimanali usa Cadenza e fatturazione');
  }
  if (existing.cadence === 'WEEKLY' && changes.cadence && cadence !== 'WEEKLY') data[dayField] = 1;
  if (requiresNewScheduleStart({cadence: existing.cadence, day: existing[dayField]},
    {cadence, day: data[dayField] ?? existing[dayField]})
    && calendarDateInput(changes.startDate ?? existing.startDate) < today) {
    throw new Error('Imposta una nuova data inizio da oggi in avanti per cambiare la cadenza settimanale');
  }
  return {...data, ...(changes.cadence && !['YEARLY', 'EVERY_2_YEARS'].includes(cadence) ? {[monthField]: null} : {})};
}
