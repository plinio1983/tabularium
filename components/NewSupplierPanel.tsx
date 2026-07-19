'use client';

import { useEffect, useState } from 'react';
import { flashParamNames } from '@/lib/flash';

export default function NewSupplierPanel({ initialOpen = false }: { initialOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [action, setAction] = useState('/api/suppliers');

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('new');
    flashParamNames.forEach(key => url.searchParams.delete(key));
    const returnTo = `${url.pathname}${url.search}`;
    setAction(`/api/suppliers?returnTo=${encodeURIComponent(returnTo)}`);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-supplier-new]')) return;

      event.preventDefault();
      setIsOpen(true);
    };

    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return <>
    <button className="btn btn-md btn-primary" type="button" data-supplier-new><span className="btn-icon">＋</span>Nuovo fornitore</button>
    {isOpen && <div className="modal-backdrop app-form-modal" role="dialog" aria-modal="true" aria-label="Aggiungi nuovo fornitore" onMouseDown={() => setIsOpen(false)}>
      <div className="modal-card modal-card-wide" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h3>Nuovo fornitore</h3>
            <p className="muted">Inserisci i dati del fornitore.</p>
          </div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setIsOpen(false)}>×</button>
        </div>
        <form className="card form income-form expense-form supplier-form supplier-styled-form inline-create-form" action={action} method="post">
          <details className="form-section full income-form-section supplier-form-section" open>
            <summary>
              <span><span className="supplier-form-section-icon" aria-hidden="true">◉</span>Anagrafica</span>
              <small>Dati principali del fornitore</small>
            </summary>
            <div className="form-section-grid income-form-section-grid supplier-form-section-grid">
              <label className="span-2">Ragione Sociale<input name="businessName" required /></label>
              <label>Alias<input name="alias" placeholder="Nome breve o commerciale" /></label>
              <label>Email<input name="email" type="email" /></label>
              <label>P.IVA<input name="vatNumber" /></label>
              <label>IBAN<input name="iban" /></label>
              <label>PEC<input name="pec" type="email" /></label>
              <label>Codice SDI/Codice Fiscale<input name="taxCodeSdi" /></label>
            </div>
          </details>

          <details className="form-section full income-form-section supplier-form-section" open>
            <summary>
              <span><span className="supplier-form-section-icon" aria-hidden="true">≡</span>Note</span>
              <small>Annotazioni interne e informazioni operative</small>
            </summary>
            <div className="form-section-stack income-form-section-stack">
              <label>Note interne<textarea name="internalNotes" rows={4} /></label>
            </div>
          </details>

          <div className="full actions-row right-actions form-actions-row supplier-form-actions">
            <button className="btn btn-md btn-default" type="button" onClick={() => setIsOpen(false)}>
              <span className="btn-icon">✕</span> Annulla
            </button>
            <button className="btn btn-md btn-primary" type="submit">
              <span className="btn-icon">✓</span> Salva fornitore
            </button>
          </div>
        </form>
      </div>
    </div>}
  </>;
}
