'use client';

import {useId, useState} from 'react';
import {useRouter} from 'next/navigation';
import FilterDrawer from '@/components/FilterDrawer';
import EntityFormActions from '@/components/EntityFormActions';
import FilterIcon from '@/components/FilterIcon';
import {FormField} from '@/components/FormControls';
import {trackingIndicators} from '@/lib/product-tracking';

export default function ProductTrackingFilters({filters}: {filters: Record<string, string>}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const router = useRouter();
  return <>
    <button type="button" className="btn btn-sm btn-default app-filter-trigger" onClick={() => setOpen(true)}>
      <span className="btn-icon"><FilterIcon/></span><span className="app-filter-trigger-text">Filtri</span>
    </button>
    <FilterDrawer open={open} onClose={() => setOpen(false)} title="Filtri tracciamento prodotti" panelClassName="record-filter-drawer-panel" actions={<EntityFormActions layout="drawer" formId={id} onCancel={() => setOpen(false)} submitLabel="Filtra" onReset={() => {
      setOpen(false);
      try {localStorage.removeItem('dmsAccounting.product-trackings.filters');} catch { /* Filters work without browser storage. */ }
      router.push('/product-trackings');
    }}/> }>
      <form id={id} key={JSON.stringify(filters)} className="record-filters recurring-drawer-filters record-styled-drawer-filters party-filters" action="/product-trackings" method="get">
        {['q', 'mobileSort'].map(key => filters[key] && <input key={key} type="hidden" name={key} value={filters[key]}/>)}
        {['name', 'batch', 'alias'].map((key, i) => <FormField className="record-filter-field" label={['Nome', 'Lotto', 'Alias'][i]} icon={['▤', '#', '◇'][i]} htmlFor={`${id}-${key}`} key={key}><input id={`${id}-${key}`} name={key} defaultValue={filters[key]} /></FormField>)}
        <FormField className="record-filter-field" label="Ingresso dal" icon="◷" htmlFor={`${id}-from`}><input id={`${id}-from`} type="date" name="from" defaultValue={filters.from}/></FormField>
        <FormField className="record-filter-field" label="Ingresso al" icon="◷" htmlFor={`${id}-to`}><input id={`${id}-to`} type="date" name="to" defaultValue={filters.to}/></FormField>
        {['invoice', 'tracking'].map((key, i) => <FormField className="record-filter-field" label={i === 0 ? 'Fattura' : 'Allegato tracciamento'} icon="📎" htmlFor={`${id}-${key}`} key={key}><select id={`${id}-${key}`} name={key} defaultValue={filters[key] ?? ''}><option value="">Tutti</option><option value="present">Presente</option><option value="missing">Mancante</option></select></FormField>)}
        <FormField className="record-filter-field" label="Segnalazione" icon="!" htmlFor={`${id}-indicator`}><select id={`${id}-indicator`} name="indicator" defaultValue={filters.indicator ?? ''}><option value="">Tutte</option>{trackingIndicators.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></FormField>
        <FormField className="record-filter-field" label="Data ingresso" icon="◷" htmlFor={`${id}-missingEntry`}><select id={`${id}-missingEntry`} name="missingEntry" defaultValue={filters.missingEntry ?? ''}><option value="">Tutte</option><option value="1">Mancante</option></select></FormField>
      </form>
    </FilterDrawer>
  </>;
}
