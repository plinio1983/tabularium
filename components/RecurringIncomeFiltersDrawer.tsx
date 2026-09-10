'use client';

import {useId, useState} from 'react';
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
    <FilterDrawer open={open} onClose={() => setOpen(false)} title="Filtri incassi ricorrenti" panelClassName=""
      actions={<EntityFormActions layout="drawer" formId={formId} onCancel={() => setOpen(false)} submitLabel="Filtra" onReset={() => {setOpen(false); router.push('/recurring-incomes');}}/>}>
      <form id={formId} key={JSON.stringify(filters)} className="record-filters recurring-drawer-filters" action="/recurring-incomes" method="get">
        <input type="hidden" name="search" value={value('search')}/>
        {value('mobileSort') ? <input type="hidden" name="mobileSort" value={value('mobileSort')}/> : null}
        <label>Cliente<input name="customer" defaultValue={value('customer')} placeholder="Nome cliente"/></label>
        <label>Descrizione<input name="description" defaultValue={value('description')} placeholder="Descrizione ricorrenza"/></label>
        <label>Stato<select name="isActive" defaultValue={value('isActive')}><option value="">Tutti</option><option value="true">Attivi</option><option value="false">Disattivati</option></select></label>
        <label>Cadenza<select name="cadence" defaultValue={value('cadence')}><option value="">Tutte</option>{cadenceOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Accredito<select name="isAutomaticCredit" defaultValue={value('isAutomaticCredit')}><option value="">Tutti</option><option value="true">Automatico</option><option value="false">Manuale</option></select></label>
      </form>
    </FilterDrawer>
  </>;
}
