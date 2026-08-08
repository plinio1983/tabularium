'use client';

import {type FormEvent, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import EmployeeFormFields from '@/components/EmployeeFormFields';
import EntityFormActions from '@/components/EntityFormActions';

export type CreatedEmployee = {id: number; firstName: string; lastName: string; employeeCode?: string | null; status: 'ACTIVE' | 'INACTIVE'};

export default function EmployeeCreateModal({open, onClose, action = '/api/employees', onCreated}: {open: boolean; onClose: () => void; action?: string; onCreated?: (employee: CreatedEmployee) => void}) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && !saving && onClose();
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose, open, saving]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (!onCreated) return;
    event.preventDefault(); setSaving(true); setError('');
    const response = await fetch(action, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))}).catch(() => null);
    if (!response?.ok) { const payload = await response?.json().catch(() => null); setError(payload?.error ?? 'Impossibile salvare il dipendente.'); setSaving(false); return; }
    onCreated(await response.json()); setSaving(false); onClose();
  }
  if (!mounted || !open) return null;
  return createPortal(<div className="modal-backdrop app-form-modal employee-create-modal" role="dialog" aria-modal="true" aria-label="Aggiungi dipendente" onMouseDown={event => event.target === event.currentTarget && !saving && onClose()}>
    <div className="modal-card modal-card-wide entity-form-modal-card" onMouseDown={event => event.stopPropagation()}>
      <div className="modal-title"><div><h3>Nuovo dipendente</h3><p className="muted">Inserisci i dati anagrafici e del rapporto.</p></div><button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={onClose} disabled={saving}>×</button></div>
      <form className="card form app-record-form entity-form entity-styled-form inline-create-form" action={action} method="post" onSubmit={submit}>
        <EmployeeFormFields/>{error ? <p className="full form-error" role="alert">{error}</p> : null}
        <EntityFormActions onCancel={onClose} submitLabel={onCreated ? 'Salva e seleziona' : 'Salva dipendente'} submitting={saving}/>
      </form>
    </div>
  </div>, document.body);
}
