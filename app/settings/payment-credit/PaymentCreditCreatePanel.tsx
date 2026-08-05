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
      <span className="category-create-toggle-copy">
        <span className="category-create-toggle-icon" aria-hidden="true">{isBank ? '▥' : '▣'}</span>
        <span>
          <strong>{isBank ? 'Nuova banca / canale accredito' : 'Nuovo metodo di pagamento o accredito'}</strong>
          <small>{isBank ? 'Aggiungi un conto disponibile nei movimenti.' : 'Aggiungi un metodo e definisci dove deve essere disponibile.'}</small>
        </span>
      </span>
      <span className="category-create-toggle-symbol" aria-hidden="true">{isOpen ? '−' : '+'}</span>
    </button>
    {isOpen ? <form action={action} className="form app-record-form category-create-form expense-category-create-form payment-credit-create-form">
      <label className="app-form-field"><span className="app-form-field-label">{isBank ? 'Nome banca o canale' : 'Nome metodo'}</span><input name="name" maxLength={80} required /></label>
      <label className="app-form-field"><span className="app-form-field-label">Icona</span><select name="icon" defaultValue="">
        <option value="">Nessuna</option>
        {iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}
      </select></label>
      {!isBank ? <><label className="app-form-field"><span className="app-form-field-label">Utilizzo</span><select name="kind" defaultValue="BOTH">
        <option value="BOTH">Entrambi</option>
        <option value="INCOME">Incassi</option>
        <option value="EXPENSE">Spese</option>
      </select></label>
      <fieldset className="payment-credit-default-fields"><legend>Predefinito nei form</legend>
        <div className="payment-credit-default-switch-row switch-toggle-field switch-inline wide">
          <div><strong>Spese</strong><span>Preseleziona nei nuovi pagamenti.</span></div>
          <label className="switch" aria-label="Metodo predefinito per le spese">
            <input type="checkbox" name="isExpenseDefault"/><span className="slider"/>
          </label>
        </div>
        <div className="payment-credit-default-switch-row switch-toggle-field switch-inline wide">
          <div><strong>Incassi</strong><span>Preseleziona nei nuovi accrediti.</span></div>
          <label className="switch" aria-label="Metodo predefinito per gli incassi">
            <input type="checkbox" name="isIncomeDefault"/><span className="slider"/>
          </label>
        </div>
      </fieldset></> : <div className="payment-credit-primary-field switch-toggle-field">
        <span>Principale</span>
        <label className="switch" aria-label="Imposta come banca principale">
          <input type="checkbox" name="primary" />
          <span className="slider" />
        </label>
      </div>}
      <div className="actions-row category-create-actions">
        <button type="button" className="btn btn-md btn-default" onClick={() => setIsOpen(false)}>Annulla</button>
        <button type="submit" className="btn btn-md btn-primary">{isBank ? 'Aggiungi' : 'Aggiungi metodo'}</button>
      </div>
    </form> : null}
  </section>;
}
