'use client';

import {useState} from 'react';
import {useRecurringStates} from './RecurringStateProvider';

export default function RecurringStateToggle({kind, id, active, archived, returnTo}: {
  kind: 'expense' | 'income'; id: number; active: boolean; archived: boolean; returnTo: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const {records, update} = useRecurringStates();
  const state = records[`${kind}:${id}`] ?? {active, archived};
  active = state.active;
  archived = state.archived;
  const action = `/api/recurring-${kind === 'expense' ? 'expenses' : 'incomes'}/bulk?returnTo=${returnTo}`;
  return <form className="recurring-state-control" action={action} method="post" data-in-place-submit="true"
    onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
    onSubmit={async event => {
      event.preventDefault();
      if (saving) return;
      const body = new FormData(event.currentTarget);
      setSaving(true);
      setError('');
      try {
        const response = await fetch(action, {method: 'POST', headers: {accept: 'application/json'}, body});
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.ok !== true || typeof payload.active !== 'boolean') {
          throw new Error(payload?.error || 'Salvataggio non riuscito. Riprova.');
        }
        update(kind, id, {active: payload.active, archived: false});
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Salvataggio non riuscito. Riprova.');
      } finally {setSaving(false);}
    }}>
    <input type="hidden" name="ids" value={id}/>
    <input type="hidden" name="bulkAction" value={active ? 'deactivate' : 'activate'}/>
    <button type="submit" role="switch" aria-checked={active} aria-busy={saving} disabled={saving}
      title={archived ? 'Ricorrenza scaduta' : undefined}
      aria-label={saving ? 'Salvataggio in corso' : `${active ? 'Disattiva' : 'Attiva'} ${kind === 'expense' ? 'spesa' : 'entrata'} ricorrente ${id}${archived ? ' (scaduta)' : ''}`}
      className={`btn btn-xs recurring-state-button ${active ? 'btn-primary' : 'btn-default'}`}>
      {saving ? <span className="recurring-state-loader" aria-hidden="true"/> : active ? 'ON' : 'OFF'}
    </button>
    {error ? <span role="alert" className="inline-warning">{error}</span> : null}
  </form>;
}
