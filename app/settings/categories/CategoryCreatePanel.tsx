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
      <span className="category-create-toggle-copy">
        <span className="category-create-toggle-icon" aria-hidden="true">＋</span>
        <span>
          <strong>Nuova categoria</strong>
          <small>Aggiungi un nuovo valore disponibile nei form di spesa.</small>
        </span>
      </span>
      <span className="category-create-toggle-state" aria-hidden="true">{isOpen ? '−' : '+'}</span>
    </button>
    {isOpen ? <form action={action} className="form expense-form category-create-form expense-category-create-form">
      <div className="app-form-field span-2">
        <label className="app-form-field-label" htmlFor="new-expense-category-name">
          <span className="app-form-field-icon" aria-hidden="true">✎</span>
          <span>Nome</span>
        </label>
        <input id="new-expense-category-name" name="name" maxLength={80} required autoFocus/>
      </div>
      <div className="app-form-field">
        <label className="app-form-field-label" htmlFor="new-expense-category-code">
          <span className="app-form-field-icon" aria-hidden="true">#</span>
          <span>Acronimo</span>
        </label>
        <input id="new-expense-category-code" name="code" maxLength={5} pattern="[A-Za-z0-9]{1,5}" required/>
        <small className="app-form-field-hint">Massimo 5 lettere o numeri.</small>
      </div>
      <div className="app-form-field">
        <label className="app-form-field-label" htmlFor="new-expense-category-icon">
          <span className="app-form-field-icon" aria-hidden="true">◇</span>
          <span>Icona</span>
        </label>
        <div className="app-select-control">
          <select id="new-expense-category-icon" name="icon" defaultValue="">
            <option value="">Nessuna</option>
            {iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}
          </select>
          <span className="app-select-caret" aria-hidden="true">⌄</span>
        </div>
          <small>&nbsp;</small>
      </div>
      <div className="actions-row full category-create-actions">
        <button type="button" className="btn btn-md btn-default" onClick={() => setIsOpen(false)}>× Annulla</button>
        <button type="submit" className="btn btn-md btn-primary"><span className="btn-icon">＋</span> Aggiungi categoria</button>
      </div>
    </form> : null}
  </section>;
}
