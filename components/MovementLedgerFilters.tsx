'use client';

import {useEffect, useId, useState} from 'react';
import {createPortal} from 'react-dom';
import FilterDrawer from './FilterDrawer';
import EntityFormActions from './EntityFormActions';
import FilterIcon from './FilterIcon';
import {useRouter, useSearchParams} from 'next/navigation';
import PeriodSelectorBox from './PeriodSelectorBox';
import {useCompanyTimeZone} from './CompanyTimeZoneProvider';
import {civilDateInTimeZone} from '@/lib/company-time';
import {receiptPeriodParams} from '@/lib/receipt-period';

type Option = {id: number; name: string};
export default function MovementLedgerFilters({path, quick, year, from, to, methods, banks, types, channels}: {
  path: string; quick: string; year: string; from: string; to: string;
  methods: Option[]; banks: Option[]; types: {id: string; name: string}[]; channels: Option[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const formId = useId();
  const [listTriggerTarget, setListTriggerTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setListTriggerTarget(document.getElementById('ledger-list-filter-trigger'));
  }, [path]);
  const companyNow = civilDateInTimeZone(useCompanyTimeZone());
  const filterButton = <button className="btn btn-sm btn-default app-filter-trigger" type="button" onClick={() => setOpen(true)} aria-label="Filtri" aria-haspopup="dialog" aria-expanded={open}>
    <span className="btn-icon"><FilterIcon/></span><span className="app-filter-trigger-text">Filtri</span>
  </button>;
  return <div>
    <div className="filter-drawer-wrapper period-filter-drawer-wrapper">
      {filterButton}
    </div>
    {listTriggerTarget ? createPortal(filterButton, listTriggerTarget) : null}
    <PeriodSelectorBox dateQuick={quick} dateYear={year} companyNow={companyNow} label="Periodo movimenti"
      inactivePeriodLabel={params.get('dateMode') === 'all' ? 'Tutte le date' : params.get('dateMode') === 'undated' ? 'Senza data' : undefined}
      onSelect={(value, selectedYear) => {
        const next = receiptPeriodParams(params.toString(), value, selectedYear);
        next.delete('dateMode');
        router.replace(`${path}?${next}`, {scroll: false});
      }}
      onOpenFilters={() => setOpen(true)}/>
    <FilterDrawer open={open} onClose={() => setOpen(false)} title={path === '/expenses/payments' ? 'Filtri pagamenti' : 'Filtri accrediti'}
      actions={<EntityFormActions layout="drawer" formId={formId} onCancel={() => setOpen(false)} submitLabel="Filtra" onReset={() => {setOpen(false); router.replace(path, {scroll: false});}}/>}>
    <form id={formId} key={params.toString() + open} className="record-filters recurring-drawer-filters record-styled-drawer-filters" action={path} method="get" onSubmit={event => {
      event.preventDefault();
      const next = new URLSearchParams();
      for (const key of ['sort', 'direction']) {const value = params.get(key); if (value) next.set(key, value);}
      new FormData(event.currentTarget).forEach((value, key) => {if (typeof value === 'string' && value) next.set(key, value);});
      if (next.get('dateFrom') === from && next.get('dateTo') === to && quick !== 'custom') {
        next.delete('dateFrom');
        next.delete('dateTo');
        next.set('dateQuick', quick);
        next.set('dateYear', year);
      }
      setOpen(false);
      router.replace(`${path}?${next}`, {scroll: false});
    }}>
      <label className="app-form-field record-filter-field"><span className="app-form-field-label">Ricerca</span><input name="search" defaultValue={params.get('search') ?? ''} placeholder="Nome, descrizione o numero del documento"/></label>
      <label className="app-form-field record-filter-field"><span className="app-form-field-label">Intervallo</span><select name="dateMode" defaultValue={params.get('dateMode') ?? 'period'}>
        <option value="period">Periodo selezionato</option><option value="all">Tutte le date</option><option value="undated">Senza data</option>
      </select></label>
      <label className="app-form-field record-filter-field"><span className="app-form-field-label">Dal</span><input type="date" name="dateFrom" defaultValue={from}/></label>
      <label className="app-form-field record-filter-field"><span className="app-form-field-label">Al</span><input type="date" name="dateTo" defaultValue={to}/></label>
      <label className="app-form-field record-filter-field"><span className="app-form-field-label">Metodo</span><select name="methodId" defaultValue={params.get('methodId') ?? ''}><option value="">Tutti</option>{methods.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="app-form-field record-filter-field"><span className="app-form-field-label">Banca / conto</span><select name="bankId" defaultValue={params.get('bankId') ?? ''}><option value="">Tutti</option><option value="none">Non specificato</option>{banks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="app-form-field record-filter-field"><span className="app-form-field-label">Tipo</span><select name="type" defaultValue={params.get('type') ?? ''}><option value="">Tutti</option>{types.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {channels.length > 0 ? <label className="app-form-field record-filter-field"><span className="app-form-field-label">Canale di vendita</span><select name="salesChannelId" defaultValue={params.get('salesChannelId') ?? ''}><option value="">Tutti</option>{channels.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
    </form>
    </FilterDrawer>
  </div>;
}
