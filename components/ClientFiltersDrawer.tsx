'use client';
import { useId, useState, type ReactNode } from 'react';
import FilterDrawer from "./FilterDrawer";
import EntityFormActions from "./EntityFormActions";
import {useRouter} from "next/navigation";
import FilterIcon from '@/components/FilterIcon';

type Props = { filters: Record<string, string | string[] | undefined> };
const value = (filters: Props['filters'], key: string) => { const item = filters[key]; return Array.isArray(item) ? item[0] ?? '' : item ?? ''; };

function FilterField({label, icon, children}: {label: string; icon: string; children: ReactNode}) {
  return <div className="app-form-field record-filter-field">
    <span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">{icon}</span>{label}</span>
    {children}
  </div>;
}

export default function ClientFiltersDrawer({ filters }: Props) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const router = useRouter();
  const drawer = <FilterDrawer open={open} onClose={() => setOpen(false)} title="Filtri clienti" panelClassName="record-filter-drawer-panel"
      actions={<EntityFormActions layout="drawer" formId={formId} onCancel={() => setOpen(false)} submitLabel="Filtra" onReset={() => {setOpen(false); router.push('/clients');}}/>}>
      <form id={formId} key={JSON.stringify(filters)} className="record-filters recurring-drawer-filters record-styled-drawer-filters party-filters" action="/clients" method="get">
        <FilterField label="Ragione sociale" icon="◇"><input name="businessName" defaultValue={value(filters, 'businessName')} /></FilterField>
        <FilterField label="Referente" icon="♙"><input name="alias" defaultValue={value(filters, 'alias')} /></FilterField>
        <FilterField label="Email" icon="@"><input type="email" name="email" defaultValue={value(filters, 'email')} /></FilterField>
        <FilterField label="P.IVA / C.F." icon="▤"><input name="vatNumber" defaultValue={value(filters, 'vatNumber')} /></FilterField>
        <FilterField label="Cod. SDI" icon="#"><input name="taxCodeSdi" defaultValue={value(filters, 'taxCodeSdi')} /></FilterField>
        <FilterField label="PEC" icon="✉"><input type="email" name="pec" defaultValue={value(filters, 'pec')} /></FilterField>
        <FilterField label="IBAN" icon="▣"><input name="iban" defaultValue={value(filters, 'iban')} /></FilterField>
        <FilterField label="Swift" icon="⇄"><input name="swift" defaultValue={value(filters, 'swift')} /></FilterField>
      </form>
    </FilterDrawer>;
  return <><button className="btn btn-sm btn-default app-filter-trigger bulk-direct-link bulk-filter-action" data-bulk-filter="true" type="button" onClick={() => setOpen(true)}><span className="btn-icon"><FilterIcon /></span><span className="app-filter-trigger-text">Filtri</span></button>{drawer}</>;
}
