'use client';

import { useState } from 'react';

type Props = {
  action: (formData: FormData) => void;
  iconOptions: readonly string[];
};

export default function CategoryCreatePanel({ action, iconOptions }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return <section className="card category-create-panel">
    <button
      type="button"
      className="category-create-toggle"
      aria-expanded={isOpen}
      onClick={() => setIsOpen(value => !value)}
    >
      <span>Nuova categoria</span>
      <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
    </button>
    {isOpen ? <form action={action} className="form category-create-form">
      <label>Nome<input name="name" maxLength={80} required /></label>
      <label>Acronimo<input name="code" maxLength={5} pattern="[A-Za-z0-9]{1,5}" required /></label>
      <label>Icona<select name="icon" defaultValue="">
        <option value="">Nessuna</option>
        {iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}
      </select></label>
      <div className="actions-row">
        <button type="submit" className="button-standard primary-action">Aggiungi categoria</button>
      </div>
    </form> : null}
  </section>;
}
