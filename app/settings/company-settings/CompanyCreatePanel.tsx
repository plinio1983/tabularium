'use client';

import {useState} from 'react';
import CompanyFormFields from '@/components/CompanyFormFields';

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
    {isOpen ? <form action={action} className="form app-record-form entity-form entity-styled-form company-settings-form company-create-form">
      <CompanyFormFields idPrefix="company-new" autoFocus/>
      <div className="actions-row form-actions-row full company-settings-actions company-create-actions">
        <button type="button" className="btn btn-md btn-default" onClick={() => setIsOpen(false)}><span className="btn-icon">✕</span> Annulla</button>
        <button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">＋</span> Aggiungi società</button>
      </div>
    </form> : null}
  </section>;
}
