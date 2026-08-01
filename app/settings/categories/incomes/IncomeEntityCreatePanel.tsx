'use client';

import { useState } from 'react';

export default function IncomeEntityCreatePanel({
  action,
  kind,
  iconOptions
}: {
  action: (formData: FormData) => void;
  kind: 'category' | 'channel';
  iconOptions: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const label = kind === 'category' ? 'categoria' : 'canale';
  return <section className="card category-create-panel">
    <button type="button" className="category-create-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="category-create-toggle-copy"><span className="category-create-toggle-icon" aria-hidden="true">＋</span><span>
        <strong>Nuov{kind === 'category' ? 'a' : 'o'} {label}</strong>
        <small>Aggiungi un nuovo valore disponibile nei form di incasso.</small>
      </span></span><span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open ? <form action={action} className="form app-record-form category-create-form expense-category-create-form">
      <input type="hidden" name="kind" value={kind} />
      <div className="app-form-field"><label className="app-form-field-label">Nome</label><input name="name" maxLength={80} required autoFocus/></div>
      <div className="app-form-field"><label className="app-form-field-label">Icona</label><select name="icon" defaultValue=""><option value="">Nessuna</option>{iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}</select></div>
      <div className="actions-row full category-create-actions"><button type="button" className="btn btn-md btn-default" onClick={() => setOpen(false)}>× Annulla</button><button type="submit" className="btn btn-md btn-primary">＋ Aggiungi {label}</button></div>
    </form> : null}
  </section>;
}
