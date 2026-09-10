'use client';

import {useId, useState, type ReactNode} from 'react';
import FilterDrawer from "./FilterDrawer";
import EntityFormActions from "./EntityFormActions";
import {useRouter} from "next/navigation";
import FilterIcon from '@/components/FilterIcon';

type Filters = Record<string, string | string[] | undefined>;
const value = (filters: Filters, key: string) => { const item = filters[key]; return Array.isArray(item) ? item[0] ?? '' : item ?? ''; };

function FilterField({label, icon, children}: {label: string; icon: string; children: ReactNode}) {
  return <div className="app-form-field record-filter-field"><span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">{icon}</span>{label}</span>{children}</div>;
}

export default function EmployeeFiltersDrawer({filters}: {filters: Filters}) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const router = useRouter();

  const drawer = <FilterDrawer open={open} onClose={() => setOpen(false)} title="Filtri dipendenti" panelClassName="record-filter-drawer-panel"
      actions={<EntityFormActions layout="drawer" formId={formId} onCancel={() => setOpen(false)} submitLabel="Filtra" onReset={() => {setOpen(false); router.push('/employees');}}/>}>
      <form id={formId} key={JSON.stringify(filters)} className="record-filters recurring-drawer-filters record-styled-drawer-filters party-filters" action="/employees" method="get">
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
      </form>
    </FilterDrawer>;
  return <><button className="btn btn-sm btn-default app-filter-trigger bulk-direct-link bulk-filter-action" data-bulk-filter="true" type="button" onClick={() => setOpen(true)}><span className="btn-icon"><FilterIcon/></span><span className="app-filter-trigger-text">Filtri</span></button>{drawer}</>;
}
