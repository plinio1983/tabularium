type Customer = { businessName?: string; alias?: string | null; email?: string | null; vatNumber?: string | null; taxCodeSdi?: string | null; pec?: string | null; iban?: string | null; swift?: string | null; internalNotes?: string | null };

export default function ClientFormFields({ customer }: { customer?: Customer }) {
  return <>
    <details className="form-section full income-form-section supplier-form-section" open>
      <summary><span><span className="supplier-form-section-icon" aria-hidden="true">◉</span>Anagrafica</span><small>Dati principali del cliente</small></summary>
      <div className="form-section-grid income-form-section-grid supplier-form-section-grid">
        <label className="span-2">Nome / Ragione sociale<input name="businessName" required defaultValue={customer?.businessName ?? ''} /></label>
        <label>Alias<input name="alias" defaultValue={customer?.alias ?? ''} /></label>
        <label>Email<input type="email" name="email" defaultValue={customer?.email ?? ''} /></label>
        <label>P.IVA<input name="vatNumber" defaultValue={customer?.vatNumber ?? ''} /></label>
        <label>SDI / Codice fiscale<input name="taxCodeSdi" defaultValue={customer?.taxCodeSdi ?? ''} /></label>
        <label>PEC<input type="email" name="pec" defaultValue={customer?.pec ?? ''} /></label>
        <label>IBAN<input name="iban" defaultValue={customer?.iban ?? ''} /></label>
        <label>Swift<input name="swift" defaultValue={customer?.swift ?? ''} /></label>
      </div>
    </details>
    <details className="form-section full income-form-section supplier-form-section" open>
      <summary><span><span className="supplier-form-section-icon" aria-hidden="true">≡</span>Note</span><small>Annotazioni interne</small></summary>
      <div className="form-section-stack income-form-section-stack"><label>Note<textarea name="internalNotes" rows={4} defaultValue={customer?.internalNotes ?? ''} /></label></div>
    </details>
  </>;
}
