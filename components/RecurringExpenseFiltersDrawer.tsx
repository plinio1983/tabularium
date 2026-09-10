"use client";

import { useId, useState, type ReactNode } from "react";
import FilterDrawer from "./FilterDrawer";
import EntityFormActions from "./EntityFormActions";
import {useRouter} from "next/navigation";
import FilterIcon from "@/components/FilterIcon";

type Option = { id: number; name: string; icon?: string | null };

type Props = {
  filters: Record<string, string | string[] | undefined>;
  categories: Option[];
  banks: Option[];
  paymentMethods: Option[];
};

const cadenceOptions = [
  ["MONTHLY", "Ogni mese"],
  ["EVERY_2_MONTHS", "Ogni 2 mesi"],
  ["EVERY_3_MONTHS", "Ogni 3 mesi"],
  ["EVERY_6_MONTHS", "Ogni 6 mesi"],
  ["YEARLY", "Annuale"],
  ["EVERY_2_YEARS", "Ogni 2 anni"],
];

const billingOptions = [
  ["SAME_MONTH", "Stesso mese"],
  ["NEXT_MONTH", "Mese successivo"],
];

function inputDefault(filters: Record<string, string | string[] | undefined>, key: string) {
  const value = filters[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function FilterField({label, icon, children}: {label: string; icon: string; children: ReactNode}) {
  return <label className="app-form-field record-filter-field">
    <span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">{icon}</span>{label}</span>
    {children}
  </label>;
}

export default function RecurringExpenseFiltersDrawer({ filters, categories, banks, paymentMethods }: Props) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const router = useRouter();

  return <>
    <button className="btn btn-sm btn-default app-filter-trigger bulk-direct-link bulk-filter-action" data-bulk-filter="true" type="button" onClick={() => setOpen(true)}>
      <span className="btn-icon"><FilterIcon /></span> <span className="app-filter-trigger-text">Filtri</span>
    </button>

    <FilterDrawer open={open} onClose={() => setOpen(false)} title="Filtri uscite ricorrenti" panelClassName="record-filter-drawer-panel"
      actions={<EntityFormActions layout="drawer" formId={formId} onCancel={() => setOpen(false)} submitLabel="Filtra" onReset={() => {setOpen(false); router.push('/recurring-expenses');}}/>}>
      <form id={formId} key={JSON.stringify(filters)} className="record-filters recurring-drawer-filters record-styled-drawer-filters" action="/recurring-expenses" method="get">
        <input type="hidden" name="search" value={inputDefault(filters, 'search')}/>
        <FilterField label="Fornitore / esercente" icon="◇">
          <input name="merchant" defaultValue={inputDefault(filters, "merchant")} placeholder="Nome fornitore" />
        </FilterField>

        <FilterField label="Descrizione" icon="≡">
          <input name="description" defaultValue={inputDefault(filters, "description")} placeholder="Descrizione ricorrenza" />
        </FilterField>

        <FilterField label="Categoria" icon="◇">
          <select name="categoryId" defaultValue={inputDefault(filters, "categoryId")}>
            <option value="">Tutte</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </FilterField>

        <FilterField label="Stato" icon="●">
          <select name="isActive" defaultValue={inputDefault(filters, "isActive")}>
            <option value="">Tutte</option>
            <option value="true">Attive</option>
            <option value="false">Disattivate</option>
          </select>
        </FilterField>

        <FilterField label="Cadenza" icon="↻">
          <select name="cadence" defaultValue={inputDefault(filters, "cadence")}>
            <option value="">Tutte</option>
            {cadenceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FilterField>

        <FilterField label="Periodo fatturazione" icon="▦">
          <select name="billingPeriodMode" defaultValue={inputDefault(filters, "billingPeriodMode")}>
            <option value="">Tutti</option>
            {billingOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FilterField>

        <FilterField label="Canale pagamento" icon="◉">
          <select name="paymentMethodId" defaultValue={inputDefault(filters, "paymentMethodId")}>
            <option value="">Tutti</option>
            {paymentMethods.map(value => <option key={value.id} value={value.id}>{value.icon ?? '  •  '} {value.name}</option>)}
          </select>
        </FilterField>

        <FilterField label="Banca" icon="▣">
          <select name="bankId" defaultValue={inputDefault(filters, "bankId")}>
            <option value="">Tutte</option>
            {banks.map(bank => <option key={bank.id} value={bank.id}>{bank.icon ?? '  •  '} {bank.name}</option>)}
          </select>
        </FilterField>

        <FilterField label="Importo minimo" icon="€">
          <input name="amountMin" inputMode="decimal" defaultValue={inputDefault(filters, "amountMin")} placeholder="0,00" />
        </FilterField>

        <FilterField label="Importo massimo" icon="€">
          <input name="amountMax" inputMode="decimal" defaultValue={inputDefault(filters, "amountMax")} placeholder="500,00" />
        </FilterField>

      </form>
    </FilterDrawer>
  </>;
}
