'use client';

import { useEffect, useState } from 'react';

export default function NewSupplierPanel({ initialOpen = false }: { initialOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [action, setAction] = useState('/api/suppliers');

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('new');
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
    <button className="button-standard primary-action" type="button" data-supplier-new><span className="btn-icon">＋</span>Aggiungi nuovo fornitore</button>
    {isOpen && <div className="modal-backdrop app-form-modal" role="dialog" aria-modal="true" aria-label="Aggiungi nuovo fornitore" onMouseDown={() => setIsOpen(false)}>
      <div className="modal-card modal-card-wide" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h3>Nuovo fornitore</h3>
            <p className="muted">Inserisci i dati del fornitore senza uscire dalla lista.</p>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={() => setIsOpen(false)}>×</button>
        </div>
        <form className="card form income-form expense-form supplier-form supplier-styled-form inline-create-form" action={action} method="post">
          <details className="form-section full income-form-section supplier-form-section" open>
            <summary>
              <span>Anagrafica</span>
              <small>Dati principali del fornitore</small>
            </summary>
            <div className="form-section-grid income-form-section-grid supplier-form-section-grid">
              <label className="span-2">Ragione Sociale<input name="businessName" required /></label>
              <label>Alias<input name="alias" placeholder="Nome breve o commerciale" /></label>
              <label>Email<input name="email" type="email" /></label>
              <label>Telefono<input name="phone" /></label>
              <label>PEC<input name="pec" type="email" /></label>
              <label>Codice SDI/Codice Fiscale<input name="taxCodeSdi" /></label>
            </div>
          </details>

          <details className="form-section full income-form-section supplier-form-section" open>
            <summary>
              <span>Note</span>
              <small>Annotazioni interne e informazioni operative</small>
            </summary>
            <div className="form-section-stack income-form-section-stack">
              <label>Note interne<textarea name="internalNotes" rows={4} /></label>
            </div>
          </details>

          <div className="full actions-row right-actions form-actions-row supplier-form-actions"><button className="secondary-button button-standard" type="button" onClick={() => setIsOpen(false)}>✕ Annulla</button><button className="button-standard primary-action" type="submit">✓ Salva fornitore</button></div>
        </form>
      </div>
    </div>}
  </>;
}
