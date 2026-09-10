"use client";

import { useId, useState, type ReactNode } from "react";
import FilterDrawer from "./FilterDrawer";
import EntityFormActions from "./EntityFormActions";
import {useRouter} from "next/navigation";
import FilterIcon from "@/components/FilterIcon";

type Props = {
  filters: Record<string, string | string[] | undefined>;
};

function inputDefault(filters: Record<string, string | string[] | undefined>, key: string) {
  const value = filters[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function FilterField({label, icon, children}: {label: string; icon: string; children: ReactNode}) {
  return <div className="app-form-field record-filter-field">
    <span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">{icon}</span>{label}</span>
    {children}
  </div>;
}

export default function SupplierFiltersDrawer({ filters }: Props) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const router = useRouter();

  const drawer = <FilterDrawer open={open} onClose={() => setOpen(false)} title="Filtri fornitori" panelClassName="record-filter-drawer-panel"
      actions={<EntityFormActions layout="drawer" formId={formId} onCancel={() => setOpen(false)} submitLabel="Filtra" onReset={() => {setOpen(false); router.push('/suppliers');}}/>}>
      <form id={formId} key={JSON.stringify(filters)} className="record-filters recurring-drawer-filters record-styled-drawer-filters party-filters" action="/suppliers" method="get">
        <FilterField label="Ragione sociale" icon="◇"><input name="businessName" defaultValue={inputDefault(filters, "businessName")} /></FilterField>
        <FilterField label="Referente" icon="♙"><input name="alias" defaultValue={inputDefault(filters, "alias")} /></FilterField>
        <FilterField label="Email" icon="@"><input name="email" type="email" defaultValue={inputDefault(filters, "email")} /></FilterField>
        <FilterField label="P.IVA / C.F." icon="▤"><input name="vatNumber" defaultValue={inputDefault(filters, "vatNumber")} /></FilterField>
        <FilterField label="IBAN" icon="▣"><input name="iban" defaultValue={inputDefault(filters, "iban")} /></FilterField>
        <FilterField label="PEC" icon="✉"><input name="pec" type="email" defaultValue={inputDefault(filters, "pec")} /></FilterField>
        <FilterField label="Cod. SDI" icon="#"><input name="taxCodeSdi" defaultValue={inputDefault(filters, "taxCodeSdi")} /></FilterField>

      </form>
    </FilterDrawer>;

  return <>
    <button className="btn btn-sm btn-default app-filter-trigger bulk-direct-link bulk-filter-action" data-bulk-filter="true" type="button" onClick={() => setOpen(true)}>
      <span className="btn-icon"><FilterIcon /></span> <span className="app-filter-trigger-text">Filtri</span>
    </button>
    {drawer}
  </>;
}
