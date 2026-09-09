'use client';

import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import Link from 'next/link';
import FilterIcon from '@/components/FilterIcon';

type Filters = Record<string, string | string[] | undefined>;
const cadenceOptions = [
  ['MONTHLY', 'Ogni mese'], ['EVERY_2_MONTHS', 'Ogni 2 mesi'],
  ['EVERY_3_MONTHS', 'Ogni 3 mesi'], ['EVERY_6_MONTHS', 'Ogni 6 mesi'],
  ['YEARLY', 'Annuale'], ['EVERY_2_YEARS', 'Ogni 2 anni'],
];

export default function RecurringIncomeFiltersDrawer({filters}: {filters: Filters}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const value = (key: string) => {
    const item = filters[key];
    return Array.isArray(item) ? item[0] ?? '' : item ?? '';
  };
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.body.classList.add('drawer-open');
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.classList.remove('drawer-open');
      document.removeEventListener('keydown', keydown);
    };
  }, [open]);

  return <>
    <button className="btn btn-sm btn-default app-filter-trigger bulk-direct-link bulk-filter-action" data-bulk-filter="true" type="button" onClick={() => setOpen(true)}>
      <span className="btn-icon"><FilterIcon/></span><span className="app-filter-trigger-text">Filtri</span>
    </button>
    {mounted ? createPortal(<div className={open ? 'filter-drawer-backdrop is-open' : 'filter-drawer-backdrop'} onMouseDown={() => setOpen(false)} aria-hidden={!open}>
      <aside className="filter-drawer-panel" role="dialog" aria-modal="true" aria-label="Filtri incassi ricorrenti" onMouseDown={event => event.stopPropagation()}>
        <div className="filter-drawer-header">
          <h3>Filtri incassi ricorrenti</h3>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi filtri" onClick={() => setOpen(false)}>×</button>
        </div>
        <form key={JSON.stringify(filters)} className="record-filters recurring-drawer-filters" action="/recurring-incomes" method="get">
          <input type="hidden" name="search" value={value('search')}/>
          {value('mobileSort') ? <input type="hidden" name="mobileSort" value={value('mobileSort')}/> : null}
          <label>Cliente<input name="customer" defaultValue={value('customer')} placeholder="Nome cliente"/></label>
          <label>Descrizione<input name="description" defaultValue={value('description')} placeholder="Descrizione ricorrenza"/></label>
          <label>Stato<select name="isActive" defaultValue={value('isActive')}><option value="">Tutti</option><option value="true">Attivi</option><option value="false">Disattivati</option></select></label>
          <label>Cadenza<select name="cadence" defaultValue={value('cadence')}><option value="">Tutte</option>{cadenceOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Accredito<select name="isAutomaticCredit" defaultValue={value('isAutomaticCredit')}><option value="">Tutti</option><option value="true">Automatico</option><option value="false">Manuale</option></select></label>
          <div className="filter-drawer-actions">
            <Link className="btn btn-md btn-default reset-button" href="/recurring-incomes" onClick={() => setOpen(false)}><span className="btn-icon">↺</span> Reset</Link>
            <button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">🔎</span> Filtra</button>
          </div>
        </form>
      </aside>
    </div>, document.body) : null}
  </>;
}
