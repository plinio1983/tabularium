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
      <span>Nuov{kind === 'category' ? 'a' : 'o'} {label}</span><span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open ? <form action={action} className="form category-create-form">
      <input type="hidden" name="kind" value={kind} />
      <label>Nome<input name="name" maxLength={80} required /></label>
      <label>Icona<select name="icon" defaultValue=""><option value="">Nessuna</option>{iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}</select></label>
      <div className="actions-row"><button type="submit" className="btn btn-md btn-primary">Aggiungi {label}</button></div>
    </form> : null}
  </section>;
}
