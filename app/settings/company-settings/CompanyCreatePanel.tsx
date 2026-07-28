'use client';

import {useState} from 'react';

type Props = {
  action: (formData: FormData) => void;
};

export default function CompanyCreatePanel({action}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return <section className="card category-create-panel">
    <button
      type="button"
      className="category-create-toggle"
      aria-expanded={isOpen}
      onClick={() => setIsOpen(value => !value)}
    >
      <span>Nuova società</span>
      <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
    </button>
    {isOpen ? <form action={action} className="form company-settings-form">
      <label>Nome breve<input name="name" maxLength={100} required/></label>
      <label>Codice<input name="code" maxLength={30} placeholder="Generato dal nome"/></label>
      <label>Ragione sociale<input name="legalName" maxLength={160}/></label>
      <label>Partita IVA<input name="vatNumber" maxLength={32}/></label>
      <label>Codice fiscale<input name="taxCode" maxLength={32}/></label>
      <label>PEC<input name="pec" type="email" maxLength={160}/></label>
      <label>Codice SDI<input name="sdiCode" maxLength={16}/></label>
      <label className="span-2">Indirizzo<input name="address" maxLength={240}/></label>
      <div className="actions-row span-2">
        <button type="button" className="btn btn-md btn-default" onClick={() => setIsOpen(false)}>Annulla</button>
        <button className="btn btn-md btn-primary" type="submit">＋ Aggiungi società</button>
      </div>
    </form> : null}
  </section>;
}
