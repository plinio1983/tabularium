'use client';

import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';

export default function IncomeEntityCreatePanel({
  action,
  kind,
  iconOptions
}: {
  action: (formData: FormData) => void;
  kind: 'channel';
  iconOptions: readonly string[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return <>
    <div className="sales-channel-create-action">
      <button type="button" className="btn btn-md btn-primary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span className="btn-icon" aria-hidden="true">＋</span> Nuovo canale di vendita
      </button>
    </div>
    {open ? createPortal(<div
      className="modal-backdrop app-form-modal sales-channel-edit-backdrop"
      role="presentation"
      onMouseDown={() => setOpen(false)}
    >
      <section
        className="modal-card settings-form-modal sales-channel-edit-modal sales-channel-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-channel-create-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="toolbar-card modal-toolbar-card">
          <div>
            <h3 id="sales-channel-create-title">Nuovo canale di vendita</h3>
            <p className="muted">Aggiungi un nuovo valore disponibile nei form di incasso.</p>
          </div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi" onClick={() => setOpen(false)}>×</button>
        </div>
        <form action={action} className="form app-record-form sales-channel-edit-form">
          <input type="hidden" name="kind" value={kind}/>
          <div className="app-form-field span-2">
            <label className="app-form-field-label" htmlFor="sales-channel-create-name">Nome</label>
            <input id="sales-channel-create-name" name="name" placeholder="Es. Negozio online" maxLength={80} required autoFocus/>
          </div>
          <div className="app-form-field span-2">
            <label className="app-form-field-label" htmlFor="sales-channel-create-icon">Icona</label>
            <select id="sales-channel-create-icon" name="icon" defaultValue="">
              <option value="">Nessuna</option>
              {iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}
            </select>
          </div>
          <div className="actions-row span-2 sales-channel-edit-actions">
            <button type="button" className="btn btn-md btn-default" onClick={() => setOpen(false)}>× Annulla</button>
            <button type="submit" className="btn btn-md btn-primary">＋ Aggiungi canale</button>
          </div>
        </form>
      </section>
    </div>, document.body) : null}
  </>;
}
