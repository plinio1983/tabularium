import type {ReactNode} from 'react';

type Customer = { businessName?: string; alias?: string | null; email?: string | null; vatNumber?: string | null; taxCodeSdi?: string | null; pec?: string | null; iban?: string | null; swift?: string | null; internalNotes?: string | null };

function Field({name, label, icon, className = '', children}: {
  name: string;
  label: string;
  icon: string;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`app-form-field ${className}`.trim()}>
    <label className="app-form-field-label" htmlFor={`client-${name}`}>
      <span className="app-form-field-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </label>
    {children}
  </div>;
}

export default function ClientFormFields({ customer }: { customer?: Customer }) {
  return <>
    <details className="form-section full entity-form-section" open>
      <summary><span><span className="entity-form-section-icon" aria-hidden="true">◉</span>Anagrafica</span><small>Dati principali del cliente</small></summary>
      <div className="form-section-grid entity-form-section-grid">
        <Field name="businessName" label="Ragione sociale" icon="◉" className="span-2">
          <input id="client-businessName" name="businessName" required defaultValue={customer?.businessName ?? ''} placeholder="Es. Cliente S.r.l." autoComplete="organization" maxLength={160} autoFocus/>
        </Field>
        <Field name="alias" label="Referente" icon="♙">
          <input id="client-alias" name="alias" defaultValue={customer?.alias ?? ''} placeholder="Nome e cognome" autoComplete="name" maxLength={120}/>
        </Field>
        <Field name="email" label="Email" icon="@">
          <input id="client-email" type="email" name="email" defaultValue={customer?.email ?? ''} placeholder="amministrazione@cliente.it" autoComplete="email" maxLength={160}/>
        </Field>
        <Field name="vatNumber" label="P.IVA / C.F." icon="#">
          <input id="client-vatNumber" name="vatNumber" defaultValue={customer?.vatNumber ?? ''} placeholder="IT01234567890" autoComplete="off" maxLength={32}/>
        </Field>
        <Field name="taxCodeSdi" label="Cod. SDI" icon="▤">
          <input id="client-taxCodeSdi" name="taxCodeSdi" defaultValue={customer?.taxCodeSdi ?? ''} placeholder="Es. ABC1234" autoComplete="off" maxLength={16}/>
        </Field>
        <Field name="pec" label="PEC" icon="✉">
          <input id="client-pec" type="email" name="pec" defaultValue={customer?.pec ?? ''} placeholder="cliente@pec.it" autoComplete="email" maxLength={160}/>
        </Field>
        <Field name="iban" label="IBAN" icon="▥">
          <input id="client-iban" name="iban" defaultValue={customer?.iban ?? ''} placeholder="IT60 X054 2811 1010 0000 0123 456" autoComplete="off" maxLength={64}/>
        </Field>
        <Field name="swift" label="Swift / BIC" icon="⇄">
          <input id="client-swift" name="swift" defaultValue={customer?.swift ?? ''} placeholder="Es. BCITITMM" autoComplete="off" maxLength={16}/>
        </Field>
      </div>
    </details>
    <details className="form-section full entity-form-section" open>
      <summary><span><span className="entity-form-section-icon" aria-hidden="true">≡</span>Note</span><small>Annotazioni interne</small></summary>
      <div className="form-section-stack">
        <Field name="internalNotes" label="Note interne" icon="≡" className="full">
          <textarea id="client-internalNotes" name="internalNotes" rows={4} defaultValue={customer?.internalNotes ?? ''} placeholder="Inserisci eventuali riferimenti o annotazioni utili…"/>
        </Field>
      </div>
    </details>
  </>;
}
