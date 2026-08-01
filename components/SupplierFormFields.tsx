import type {ReactNode} from 'react';

type CategoryOption = {id: number; name: string; icon?: string | null};

type SupplierValues = {
  businessName?: string | null;
  alias?: string | null;
  email?: string | null;
  vatNumber?: string | null;
  taxCodeSdi?: string | null;
  pec?: string | null;
  iban?: string | null;
  swift?: string | null;
  internalNotes?: string | null;
  defaultExpenseCategoryId?: number | null;
};

function Field({name, label, icon, className = '', children}: {
  name: string;
  label: string;
  icon: string;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`app-form-field ${className}`.trim()}>
    <label className="app-form-field-label" htmlFor={`supplier-${name}`}>
      <span className="app-form-field-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </label>
    {children}
  </div>;
}

export default function SupplierFormFields({supplier, categories}: {
  supplier?: SupplierValues;
  categories: CategoryOption[];
}) {
  return <>
    <details className="form-section full entity-form-section" open>
      <summary>
        <span><span className="entity-form-section-icon" aria-hidden="true">◉</span>Anagrafica</span>
        <small>Dati fiscali, referente e coordinate di pagamento</small>
      </summary>
      <div className="form-section-grid entity-form-section-grid">
        <Field name="businessName" label="Ragione sociale" icon="◉" className="span-2">
          <input id="supplier-businessName" name="businessName" defaultValue={supplier?.businessName ?? ''} placeholder="Es. Azienda S.r.l." autoComplete="organization" maxLength={160} required autoFocus/>
        </Field>
        <Field name="alias" label="Referente" icon="♙">
          <input id="supplier-alias" name="alias" defaultValue={supplier?.alias ?? ''} placeholder="Nome e cognome" autoComplete="name" maxLength={120}/>
        </Field>
        <Field name="email" label="Email" icon="@">
          <input id="supplier-email" name="email" type="email" defaultValue={supplier?.email ?? ''} placeholder="amministrazione@azienda.it" autoComplete="email" maxLength={160}/>
        </Field>
        <Field name="vatNumber" label="P.IVA / C.F." icon="#">
          <input id="supplier-vatNumber" name="vatNumber" defaultValue={supplier?.vatNumber ?? ''} placeholder="IT01234567890" autoComplete="off" maxLength={32}/>
        </Field>
        <Field name="taxCodeSdi" label="Cod. SDI" icon="▤">
          <input id="supplier-taxCodeSdi" name="taxCodeSdi" defaultValue={supplier?.taxCodeSdi ?? ''} placeholder="Es. ABC1234" autoComplete="off" maxLength={16}/>
        </Field>
        <Field name="pec" label="PEC" icon="✉">
          <input id="supplier-pec" name="pec" type="email" defaultValue={supplier?.pec ?? ''} placeholder="azienda@pec.it" autoComplete="email" maxLength={160}/>
        </Field>
        <Field name="iban" label="IBAN" icon="▥">
          <input id="supplier-iban" name="iban" defaultValue={supplier?.iban ?? ''} placeholder="IT60 X054 2811 1010 0000 0123 456" autoComplete="off" maxLength={64}/>
        </Field>
        <Field name="swift" label="Swift / BIC" icon="⇄">
          <input id="supplier-swift" name="swift" defaultValue={supplier?.swift ?? ''} placeholder="Es. BCITITMM" autoComplete="off" maxLength={16}/>
        </Field>
        <Field name="defaultExpenseCategoryId" label="Categoria predefinita" icon="◇">
          <div className="app-select-control">
            <select id="supplier-defaultExpenseCategoryId" name="defaultExpenseCategoryId" defaultValue={supplier?.defaultExpenseCategoryId ?? ''}>
              <option value="">Nessuna categoria</option>
              {categories.map(category => <option key={category.id} value={category.id}>
                {category.icon ? `${category.icon} ${category.name}` : category.name}
              </option>)}
            </select>
            <span className="app-select-caret" aria-hidden="true">⌄</span>
          </div>
        </Field>
      </div>
    </details>

    <details className="form-section full entity-form-section" open>
      <summary>
        <span><span className="entity-form-section-icon" aria-hidden="true">≡</span>Note</span>
        <small>Annotazioni interne e informazioni operative</small>
      </summary>
      <div className="form-section-stack">
        <Field name="internalNotes" label="Note interne" icon="≡" className="full">
          <textarea id="supplier-internalNotes" name="internalNotes" rows={4} defaultValue={supplier?.internalNotes ?? ''} placeholder="Inserisci eventuali riferimenti o annotazioni utili…"/>
        </Field>
      </div>
    </details>
  </>;
}
