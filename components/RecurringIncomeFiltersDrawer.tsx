'use client';

import {useId, useState, type ReactNode} from 'react';
import FilterDrawer from "./FilterDrawer";
import EntityFormActions from "./EntityFormActions";
import {useRouter} from "next/navigation";
import FilterIcon from '@/components/FilterIcon';

type Filters = Record<string, string | string[] | undefined>;
const cadenceOptions = [
  ['MONTHLY', 'Ogni mese'], ['EVERY_2_MONTHS', 'Ogni 2 mesi'],
  ['EVERY_3_MONTHS', 'Ogni 3 mesi'], ['EVERY_6_MONTHS', 'Ogni 6 mesi'],
  ['YEARLY', 'Annuale'], ['EVERY_2_YEARS', 'Ogni 2 anni'],
];

function FilterField({label, icon, children}: {label: string; icon: string; children: ReactNode}) {
  return <label className="app-form-field record-filter-field">
    <span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">{icon}</span>{label}</span>
    {children}
  </label>;
}

export default function RecurringIncomeFiltersDrawer({filters}: {filters: Filters}) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const router = useRouter();
  const value = (key: string) => {
    const item = filters[key];
    return Array.isArray(item) ? item[0] ?? '' : item ?? '';
  };

  return <>
    <button className="btn btn-sm btn-default app-filter-trigger bulk-direct-link bulk-filter-action" data-bulk-filter="true" type="button" onClick={() => setOpen(true)}>
      <span className="btn-icon"><FilterIcon/></span><span className="app-filter-trigger-text">Filtri</span>
    </button>
    <FilterDrawer open={open} onClose={() => setOpen(false)} title="Filtri entrate ricorrenti" panelClassName="record-filter-drawer-panel"
      actions={<EntityFormActions layout="drawer" formId={formId} onCancel={() => setOpen(false)} submitLabel="Filtra" onReset={() => {setOpen(false); router.push('/recurring-incomes');}}/>}>
      <form id={formId} key={JSON.stringify(filters)} className="record-filters recurring-drawer-filters record-styled-drawer-filters" action="/recurring-incomes" method="get">
        <input type="hidden" name="search" value={value('search')}/>
        {value('mobileSort') ? <input type="hidden" name="mobileSort" value={value('mobileSort')}/> : null}
        <FilterField label="Cliente" icon="◇">
          <input name="customer" defaultValue={value('customer')} placeholder="Nome cliente"/>
        </FilterField>
        <FilterField label="Descrizione" icon="≡">
          <input name="description" defaultValue={value('description')} placeholder="Descrizione ricorrenza"/>
        </FilterField>
        <FilterField label="Stato" icon="●">
          <select name="isActive" defaultValue={value('isActive')}><option value="">Tutti</option><option value="true">Attivi</option><option value="false">Disattivati</option></select>
        </FilterField>
        <FilterField label="Cadenza" icon="↻">
          <select name="cadence" defaultValue={value('cadence')}><option value="">Tutte</option>{cadenceOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </FilterField>
        <FilterField label="Accredito" icon="◉">
          <select name="isAutomaticCredit" defaultValue={value('isAutomaticCredit')}><option value="">Tutti</option><option value="true">Automatico</option><option value="false">Manuale</option></select>
        </FilterField>
      </form>
    </FilterDrawer>
  </>;
}
