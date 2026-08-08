'use client';

import {useEffect, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import Link from 'next/link';
import FilterIcon from '@/components/FilterIcon';

type Filters = Record<string, string | string[] | undefined>;
const value = (filters: Filters, key: string) => { const item = filters[key]; return Array.isArray(item) ? item[0] ?? '' : item ?? ''; };

function FilterField({label, icon, children}: {label: string; icon: string; children: ReactNode}) {
  return <div className="app-form-field record-filter-field"><span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">{icon}</span>{label}</span>{children}</div>;
}

export default function EmployeeFiltersDrawer({filters}: {filters: Filters}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.body.classList.add('drawer-open'); document.addEventListener('keydown', keydown);
    return () => { document.body.classList.remove('drawer-open'); document.removeEventListener('keydown', keydown); };
  }, [open]);

  const drawer = mounted ? createPortal(<div className={open ? 'filter-drawer-backdrop is-open' : 'filter-drawer-backdrop'} onMouseDown={() => setOpen(false)} aria-hidden={!open}>
    <aside className="filter-drawer-panel record-filter-drawer-panel" role="dialog" aria-modal="true" aria-label="Filtri dipendenti" onMouseDown={event => event.stopPropagation()}>
      <div className="filter-drawer-header"><h3>Filtri dipendenti</h3><button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setOpen(false)}>×</button></div>
      <form className="record-filters recurring-drawer-filters record-styled-drawer-filters party-filters" action="/employees" method="get">
        {value(filters, 'search') ? <input type="hidden" name="search" value={value(filters, 'search')}/> : null}
        <FilterField label="Nome" icon="♙"><input name="firstName" defaultValue={value(filters, 'firstName')} placeholder="Nome"/></FilterField>
        <FilterField label="Cognome" icon="♙"><input name="lastName" defaultValue={value(filters, 'lastName')} placeholder="Cognome"/></FilterField>
        <FilterField label="Matricola" icon="#"><input name="employeeCode" defaultValue={value(filters, 'employeeCode')} placeholder="Es. DIP-001"/></FilterField>
        <FilterField label="Codice fiscale" icon="▤"><input name="taxCode" defaultValue={value(filters, 'taxCode')} placeholder="Codice fiscale"/></FilterField>
        <FilterField label="Email" icon="@"><input type="email" name="email" defaultValue={value(filters, 'email')} placeholder="Email"/></FilterField>
        <FilterField label="Telefono" icon="☎"><input name="phone" defaultValue={value(filters, 'phone')} placeholder="Telefono"/></FilterField>
        <FilterField label="IBAN" icon="▥"><input name="iban" defaultValue={value(filters, 'iban')} placeholder="IBAN"/></FilterField>
        <FilterField label="Stato" icon="●"><select name="status" defaultValue={value(filters, 'status')}><option value="">Tutti</option><option value="ACTIVE">Attivi</option><option value="INACTIVE">Inattivi</option></select></FilterField>
        <FilterField label="Assunzione da" icon="◷"><input type="date" name="hiredFrom" defaultValue={value(filters, 'hiredFrom')}/></FilterField>
        <FilterField label="Assunzione a" icon="◷"><input type="date" name="hiredTo" defaultValue={value(filters, 'hiredTo')}/></FilterField>
        <FilterField label="Cessazione da" icon="◷"><input type="date" name="terminatedFrom" defaultValue={value(filters, 'terminatedFrom')}/></FilterField>
        <FilterField label="Cessazione a" icon="◷"><input type="date" name="terminatedTo" defaultValue={value(filters, 'terminatedTo')}/></FilterField>
        <div className="filter-drawer-actions"><Link className="btn btn-md btn-default reset-button" href="/employees" onClick={() => setOpen(false)}>↺ Reset</Link><button className="btn btn-md btn-primary" type="submit">🔎 Filtra</button></div>
      </form>
    </aside>
  </div>, document.body) : null;
  return <><button className="btn btn-sm btn-default app-filter-trigger" type="button" onClick={() => setOpen(true)}><span className="btn-icon"><FilterIcon/></span><span className="app-filter-trigger-text">Filtri</span></button>{drawer}</>;
}
