'use client';

import {useRef} from 'react';
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
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const companyNow = civilDateInTimeZone(useCompanyTimeZone());
  return <div className="ledger-filter-box">
    <PeriodSelectorBox dateQuick={quick} dateYear={year} companyNow={companyNow} label="Periodo movimenti"
      inactivePeriodLabel={params.get('dateMode') === 'all' ? 'Tutte le date' : params.get('dateMode') === 'undated' ? 'Senza data' : undefined}
      onSelect={(value, selectedYear) => {
        const next = receiptPeriodParams(params.toString(), value, selectedYear);
        next.delete('dateMode');
        router.replace(`${path}?${next}`, {scroll: false});
      }}
      onOpenFilters={() => {
        if (detailsRef.current) detailsRef.current.open = true;
        formRef.current?.scrollIntoView({block: 'center', behavior: 'smooth'});
        fromRef.current?.focus({preventScroll: true});
      }}/>
    <details ref={detailsRef} className="ledger-filter-details">
    <summary>Filtri: date, metodo, banca e tipo</summary>
    <form key={params.toString()} ref={formRef} className="ledger-filters" action={path} method="get" onSubmit={event => {
      event.preventDefault();
      const next = new URLSearchParams();
      new FormData(event.currentTarget).forEach((value, key) => {if (typeof value === 'string' && value) next.set(key, value);});
      if (next.get('dateFrom') === from && next.get('dateTo') === to && quick !== 'custom') {
        next.delete('dateFrom');
        next.delete('dateTo');
        next.set('dateQuick', quick);
        next.set('dateYear', year);
      }
      router.replace(`${path}?${next}`, {scroll: false});
    }}>
      <input type="hidden" name="search" value={params.get('search') ?? ''}/>
      <label>Intervallo<select name="dateMode" defaultValue={params.get('dateMode') ?? 'period'}>
        <option value="period">Periodo selezionato</option><option value="all">Tutte le date</option><option value="undated">Senza data</option>
      </select></label>
      <label>Dal<input ref={fromRef} type="date" name="dateFrom" defaultValue={from}/></label>
      <label>Al<input type="date" name="dateTo" defaultValue={to}/></label>
      <label>Metodo<select name="methodId" defaultValue={params.get('methodId') ?? ''}><option value="">Tutti</option>{methods.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Banca / conto<select name="bankId" defaultValue={params.get('bankId') ?? ''}><option value="">Tutti</option><option value="none">Non specificato</option>{banks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Tipo<select name="type" defaultValue={params.get('type') ?? ''}><option value="">Tutti</option>{types.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {channels.length > 0 ? <label>Canale di vendita<select name="salesChannelId" defaultValue={params.get('salesChannelId') ?? ''}><option value="">Tutti</option>{channels.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
      <div className="actions-row"><button type="submit" className="btn btn-md btn-primary">Filtra</button><button type="button" className="btn btn-md btn-default" onClick={() => router.replace(path, {scroll: false})}>Reset</button></div>
    </form>
    </details>
  </div>;
}
