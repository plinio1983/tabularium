import type {ReactNode} from "react";
import {DEFAULT_COMPANY_TIME_ZONE, supportedCompanyTimeZones} from "@/lib/company-time";

type CompanyValues = {
    name?: string | null;
    code?: string | null;
    legalName?: string | null;
    vatNumber?: string | null;
    taxCode?: string | null;
    pec?: string | null;
    sdiCode?: string | null;
    address?: string | null;
    timeZone?: string | null;
};

function Field({idPrefix, name, label, icon, className = "", children}: {
    idPrefix: string;
    name: string;
    label: string;
    icon: string;
    className?: string;
    children: ReactNode;
}) {
    return <div className={`app-form-field ${className}`.trim()}>
        <label className="app-form-field-label" htmlFor={`${idPrefix}-${name}`}>
            <span className="app-form-field-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
        </label>
        {children}
    </div>;
}

export default function CompanyFormFields({company, idPrefix = "company", autoFocus = false}: {company?: CompanyValues; idPrefix?: string; autoFocus?: boolean}) {
    const timeZones = supportedCompanyTimeZones();
    return <>
        <details className="form-section full entity-form-section company-form-section" open>
            <summary>
                <span><span className="entity-form-section-icon" aria-hidden="true">◎</span>Identità</span>
                <small>Nome visualizzato e dati anagrafici della società</small>
            </summary>
            <div className="form-section-grid entity-form-section-grid">
                <Field idPrefix={idPrefix} name="name" label="Nome breve" icon="◎">
                    <input id={`${idPrefix}-name`} name="name" defaultValue={company?.name ?? ""} placeholder="Es. Azienda principale" autoComplete="organization" maxLength={100} required autoFocus={autoFocus}/>
                </Field>
                <Field idPrefix={idPrefix} name="code" label="Codice" icon="#">
                    <input id={`${idPrefix}-code`} name="code" defaultValue={company?.code ?? ""} placeholder="Generato automaticamente dal nome" autoComplete="off" maxLength={30}/>
                </Field>
                <Field idPrefix={idPrefix} name="legalName" label="Ragione sociale" icon="◉" className="span-2">
                    <input id={`${idPrefix}-legalName`} name="legalName" defaultValue={company?.legalName ?? ""} placeholder="Es. Azienda S.r.l." autoComplete="organization" maxLength={160}/>
                </Field>
            </div>
        </details>

        <details className="form-section full entity-form-section company-form-section" open>
            <summary>
                <span><span className="entity-form-section-icon" aria-hidden="true">◷</span>Localizzazione</span>
                <small>Fuso utilizzato per date operative, scadenze, report e ricorrenze</small>
            </summary>
            <div className="form-section-grid entity-form-section-grid">
                <Field idPrefix={idPrefix} name="timeZone" label="Fuso orario" icon="◷" className="span-2">
                    <select id={`${idPrefix}-timeZone`} name="timeZone" defaultValue={company?.timeZone ?? DEFAULT_COMPANY_TIME_ZONE} required>
                        {timeZones.map(timeZone => <option value={timeZone} key={timeZone}>{timeZone}</option>)}
                    </select>
                </Field>
            </div>
        </details>

        <details className="form-section full entity-form-section company-form-section" open>
            <summary>
                <span><span className="entity-form-section-icon" aria-hidden="true">▤</span>Dati fiscali e sede</span>
                <small>Identificativi fiscali, fatturazione elettronica e indirizzo</small>
            </summary>
            <div className="form-section-grid entity-form-section-grid">
                <Field idPrefix={idPrefix} name="vatNumber" label="Partita IVA" icon="#">
                    <input id={`${idPrefix}-vatNumber`} name="vatNumber" defaultValue={company?.vatNumber ?? ""} placeholder="IT01234567890" autoComplete="off" maxLength={32}/>
                </Field>
                <Field idPrefix={idPrefix} name="taxCode" label="Codice fiscale" icon="№">
                    <input id={`${idPrefix}-taxCode`} name="taxCode" defaultValue={company?.taxCode ?? ""} placeholder="Codice fiscale della società" autoComplete="off" maxLength={32}/>
                </Field>
                <Field idPrefix={idPrefix} name="pec" label="PEC" icon="✉">
                    <input id={`${idPrefix}-pec`} name="pec" type="email" defaultValue={company?.pec ?? ""} placeholder="azienda@pec.it" autoComplete="email" maxLength={160}/>
                </Field>
                <Field idPrefix={idPrefix} name="sdiCode" label="Codice SDI" icon="▤">
                    <input id={`${idPrefix}-sdiCode`} name="sdiCode" defaultValue={company?.sdiCode ?? ""} placeholder="Es. ABC1234" autoComplete="off" maxLength={16}/>
                </Field>
                <Field idPrefix={idPrefix} name="address" label="Indirizzo" icon="⌂" className="span-2">
                    <input id={`${idPrefix}-address`} name="address" defaultValue={company?.address ?? ""} placeholder="Via, numero civico, CAP, città e provincia" autoComplete="street-address" maxLength={240}/>
                </Field>
            </div>
        </details>
    </>;
}
