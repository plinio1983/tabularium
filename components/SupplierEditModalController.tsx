'use client';

import { useEffect, useState } from 'react';

type SupplierData = {
  id: number;
  businessName: string;
  alias: string | null;
  email: string | null;
  vatNumber: string | null;
  iban: string | null;
  pec: string | null;
  taxCodeSdi: string | null;
  internalNotes: string | null;
  defaultExpenseCategoryId: number | null;
};

type CategoryOption = { id: number; name: string; icon?: string | null };

export default function SupplierEditModalController({categories = []}: { categories?: CategoryOption[] }) {
  const [supplier, setSupplier] = useState<SupplierData | null>(null);
  const [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState('/suppliers');

  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      const target = event.target as Element | null;
      const trigger = target?.closest<HTMLElement>('[data-supplier-edit-id], a[href*="/suppliers/"][href*="/edit"]');
      if (!trigger) return;
      const explicitId = trigger.getAttribute('data-supplier-edit-id');
      const href = trigger instanceof HTMLAnchorElement ? trigger.href : '';
      const pathId = href ? new URL(href, window.location.origin).pathname.match(/^\/suppliers\/(\d+)\/edit$/)?.[1] : '';
      const supplierId = explicitId || pathId;
      if (!supplierId) return;

      event.preventDefault();
      if (loading) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/suppliers/${supplierId}/edit-data`, {cache: 'no-store'});
        if (!response.ok) {
          window.alert('Impossibile caricare i dati del fornitore.');
          return;
        }
        const currentUrl = new URL(window.location.href);
        ['saved', 'error', 'usage'].forEach(key => currentUrl.searchParams.delete(key));
        setReturnTo(`${currentUrl.pathname}${currentUrl.search}`);
        setSupplier(await response.json());
      } finally {
        setLoading(false);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [loading]);

  if (!supplier) return null;

  return <div className="modal-backdrop app-form-modal" role="dialog" aria-modal="true"
              aria-label={`Modifica fornitore ${supplier.businessName}`} onMouseDown={() => setSupplier(null)}>
    <div className="modal-card modal-card-wide supplier-form-modal-card"
         onMouseDown={event => event.stopPropagation()}>
      <div className="modal-title">
        <div>
          <h3>Modifica fornitore</h3>
          <p className="muted">Aggiorna l’anagrafica di {supplier.businessName}.</p>
        </div>
        <button className="btn btn-icon-only btn-default modal-close-button" type="button"
                onClick={() => setSupplier(null)}>×</button>
      </div>

      <form className="card form income-form expense-form supplier-form supplier-styled-form"
            action={`/api/suppliers/${supplier.id}?returnTo=${encodeURIComponent(returnTo)}`} method="post">
        <details className="form-section full income-form-section supplier-form-section" open>
          <summary>
            <span><span className="supplier-form-section-icon" aria-hidden="true">◉</span>Anagrafica</span>
            <small>Dati principali del fornitore</small>
          </summary>
          <div className="form-section-grid income-form-section-grid supplier-form-section-grid">
            <label className="span-2">Ragione Sociale<input name="businessName" required
                                                            defaultValue={supplier.businessName}/></label>
            <label>Alias<input name="alias" defaultValue={supplier.alias ?? ''}/></label>
            <label>Email<input name="email" type="email" defaultValue={supplier.email ?? ''}/></label>
            <label>P.IVA<input name="vatNumber" defaultValue={supplier.vatNumber ?? ''}/></label>
            <label>IBAN<input name="iban" defaultValue={supplier.iban ?? ''}/></label>
            <label>PEC<input name="pec" type="email" defaultValue={supplier.pec ?? ''}/></label>
            <label>Codice SDI/Fiscale<input name="taxCodeSdi"
                                                   defaultValue={supplier.taxCodeSdi ?? ''}/></label>
            <label>Categoria predefinita
              <select name="defaultExpenseCategoryId" defaultValue={supplier.defaultExpenseCategoryId ?? ''}>
                <option value="">Nessuna categoria</option>
                {categories.map(category => <option key={category.id} value={category.id}>
                  {category.icon ? `${category.icon} ${category.name}` : category.name}
                </option>)}
              </select>
            </label>
          </div>
        </details>

        <details className="form-section full income-form-section supplier-form-section" open>
          <summary>
            <span><span className="supplier-form-section-icon" aria-hidden="true">≡</span>Note</span>
            <small>Annotazioni interne e informazioni operative</small>
          </summary>
          <div className="form-section-stack income-form-section-stack">
            <label>Note interne<textarea name="internalNotes" rows={4}
                                         defaultValue={supplier.internalNotes ?? ''}/></label>
          </div>
        </details>

        <div className="full actions-row right-actions form-actions-row supplier-form-actions">
          <button className="btn btn-md btn-default" type="button" onClick={() => setSupplier(null)}>
            <span className="btn-icon">✕</span> Annulla
          </button>
          <button className="btn btn-md btn-primary" type="submit">
            <span className="btn-icon">✓</span> Salva modifiche
          </button>
        </div>
      </form>
    </div>
  </div>;
}
