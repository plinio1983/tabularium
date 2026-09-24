'use client';

import {useRecurringStates} from './RecurringStateProvider';
import {badgeClass} from '@/lib/expense-ui';

export default function RecurringDetailState({kind = 'expense', id, active, archived, variant}: {
  kind?: 'expense' | 'income'; id: number; active: boolean; archived: boolean; variant: 'badge' | 'summary' | 'text' | 'progress';
}) {
  const {records} = useRecurringStates();
  const state = records[`${kind}:${id}`] ?? {active, archived};
  const label = state.archived ? 'Regola archiviata' : state.active ? 'Regola attiva' : 'Regola disattivata';
  if (variant === 'progress') return <div className="record-detail-progress" aria-label={label}>
    <span style={{width: state.active ? '100%' : '0%'}}/>
  </div>;
  if (variant === 'text') return <strong>{state.archived ? '⌛ Archiviata' : state.active ? '✓ Attiva' : '× Disattivata'}</strong>;
  return <span className={badgeClass(state.archived ? 'tone-neutral' : state.active ? 'tone-yes' : 'tone-critical')}>
    {variant === 'summary' ? label : state.archived ? 'ARCHIVIATA' : state.active ? 'ON' : 'OFF'}
  </span>;
}
