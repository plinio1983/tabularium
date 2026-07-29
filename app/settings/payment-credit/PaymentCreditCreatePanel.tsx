'use client';

import { useState } from 'react';

type BankProps = {
  action: (formData: FormData) => void;
  type: 'bank';
  iconOptions: readonly string[];
};

type MethodProps = {
  action: (formData: FormData) => void;
  type: 'method';
  iconOptions: readonly string[];
};

type Props = BankProps | MethodProps;

export default function PaymentCreditCreatePanel({ action, type, iconOptions }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const isBank = type === 'bank';

  return <section className="card category-create-panel">
    <button
      type="button"
      className="category-create-toggle"
      aria-expanded={isOpen}
      onClick={() => setIsOpen(value => !value)}
    >
      <span>{isBank ? 'Nuova banca / canale accredito' : 'Nuovo metodo pagamento/accredito'}</span>
      <span aria-hidden="true">{isOpen ? '-' : '+'}</span>
    </button>
    {isOpen ? <form action={action} className="form category-create-form">
      <label>{isBank ? 'Label' : 'Label metodo'}<input name="name" maxLength={80} required /></label>
      <label>Icona<select name="icon" defaultValue="">
        <option value="">Nessuna</option>
        {iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}
      </select></label>
      {!isBank ? <label>Uso<select name="kind" defaultValue="BOTH">
        <option value="BOTH">Entrambi</option>
        <option value="INCOME">Incassi</option>
        <option value="EXPENSE">Spese</option>
      </select></label> : <div className="payment-credit-primary-field">
        <span>Principale</span>
        <label className="switch" aria-label="Imposta come banca principale">
          <input type="checkbox" name="primary" />
          <span className="slider" />
        </label>
      </div>}
      <div className="actions-row">
        <button type="submit" className="btn btn-md btn-primary">{isBank ? 'Aggiungi' : 'Aggiungi metodo'}</button>
      </div>
    </form> : null}
  </section>;
}
