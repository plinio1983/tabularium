'use client';

import {type ReactNode, useState} from 'react';
import {calendarDateInput} from '@/lib/company-time';
import {DateField} from '@/components/FormControls';

export type EmployeeFormValues = {
    firstName?: string | null;
    lastName?: string | null;
    taxCode?: string | null;
    employeeCode?: string | null;
    email?: string | null;
    phone?: string | null;
    iban?: string | null;
    hiredAt?: string | Date | null;
    terminatedAt?: string | Date | null;
    status?: 'ACTIVE' | 'INACTIVE' | null;
    internalNotes?: string | null;
};

function Field({name, label, icon, className = '', children}: {
    name: string;
    label: string;
    icon: string;
    className?: string;
    children: ReactNode
}) {
    return <div className={`app-form-field ${className}`.trim()}>
        <label className="app-form-field-label" htmlFor={`employee-${name}`}>
            <span className="app-form-field-icon" aria-hidden="true">{icon}</span><span>{label}</span>
        </label>
        {children}
    </div>;
}

function dateValue(value?: string | Date | null) {
    return value ? calendarDateInput(value) : '';
}

export default function EmployeeFormFields({employee}: { employee?: EmployeeFormValues }) {
    const [hiredAt, setHiredAt] = useState(dateValue(employee?.hiredAt));
    const [terminatedAt, setTerminatedAt] = useState(dateValue(employee?.terminatedAt));
    const [active, setActive] = useState(employee?.status !== 'INACTIVE');

    return <>
        <details className="form-section full entity-form-section" open>
            <summary>
                <span>
                    <span className="entity-form-section-icon" aria-hidden="true">♙</span>
                    Anagrafica
                </span>
                <small>Identità e contatti del dipendente</small>
            </summary>
            <div className="form-section-grid entity-form-section-grid">
                <Field name="firstName" label="Nome" icon="♙">
                    <input id="employee-firstName" name="firstName" defaultValue={employee?.firstName ?? ''} placeholder="Es. Mario" autoComplete="given-name" maxLength={100} required autoFocus/>
                </Field>
                <Field name="lastName" label="Cognome" icon="♙">
                    <input id="employee-lastName" name="lastName" defaultValue={employee?.lastName ?? ''} placeholder="Es. Rossi" autoComplete="family-name" maxLength={100} required/>
                </Field>
                <Field name="employeeCode" label="Matricola" icon="#">
                    <input id="employee-employeeCode" name="employeeCode" defaultValue={employee?.employeeCode ?? ''} placeholder="Es. DIP-001" maxLength={40} autoComplete="off"/>
                </Field>
                <Field name="taxCode" label="Codice fiscale" icon="▤">
                    <input id="employee-taxCode" name="taxCode" defaultValue={employee?.taxCode ?? ''} placeholder="Es. RSSMRA80A01H501U" maxLength={32} autoComplete="off"/>
                </Field>
                <Field name="email" label="Email" icon="@">
                    <input id="employee-email" name="email" type="email" defaultValue={employee?.email ?? ''} placeholder="mario.rossi@azienda.it" maxLength={160} autoComplete="email"/>
                </Field>
                <Field name="phone" label="Telefono" icon="☎">
                    <input id="employee-phone" name="phone" type="tel" defaultValue={employee?.phone ?? ''} placeholder="Es. +39 333 1234567" maxLength={40} autoComplete="tel"/>
                </Field>
                <Field name="iban" label="IBAN" icon="▥" className="span-2">
                    <input id="employee-iban" name="iban" defaultValue={employee?.iban ?? ''} placeholder="IT60 X054 2811 1010 0000 0123 456" maxLength={64} autoComplete="off"/>
                </Field>
            </div>
        </details>
        <details className="form-section full entity-form-section" open>
            <summary>
                <span>
                    <span className="entity-form-section-icon" aria-hidden="true">◷</span>
                    Rapporto
                </span>
                <small>Periodo e stato del rapporto di lavoro</small>
            </summary>
            <div className="form-section-grid entity-form-section-grid">
                <DateField label="Data assunzione" name="hiredAt" value={hiredAt} onChange={setHiredAt}/>
                <DateField label="Data cessazione" name="terminatedAt" value={terminatedAt} onChange={setTerminatedAt} min={hiredAt || undefined}/>
                <div className="switch-toggle-field switch-inline wide span-2">
                    <div className="switch-toggle-field-label app-form-field-label">
                        <span className="app-form-field-icon" aria-hidden="true">●</span>
                        <span className="app-form-label">Stato dipendente</span>
                    </div>
                    <input type="hidden" name="status" value={active ? 'ACTIVE' : 'INACTIVE'}/>
                    <label className="switch" aria-label={active ? 'Dipendente attivo' : 'Dipendente inattivo'}>
                        <small className="text-muted">{active ? 'Attivo' : 'Inattivo'}</small>
                        <input type="checkbox" checked={active} onChange={event => setActive(event.currentTarget.checked)}/>
                        <span className="slider"/>
                    </label>
                </div>
            </div>
        </details>
        <details className="form-section full entity-form-section" open>
            <summary>
                <span>
                    <span className="entity-form-section-icon" aria-hidden="true">≡</span>
                    Note
                </span>
                <small>Informazioni operative riservate</small>
            </summary>
            <div className="form-section-stack">
                <Field name="internalNotes" label="Note interne" icon="≡" className="full"><textarea id="employee-internalNotes" name="internalNotes" rows={4} maxLength={2000} defaultValue={employee?.internalNotes ?? ''} placeholder="Inserisci eventuali informazioni operative sul dipendente…"/></Field>
            </div>
        </details>
    </>;
}
