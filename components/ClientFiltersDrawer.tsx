'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import FilterIcon from '@/components/FilterIcon';

type Props = { filters: Record<string, string | string[] | undefined> };
const value = (filters: Props['filters'], key: string) => { const item = filters[key]; return Array.isArray(item) ? item[0] ?? '' : item ?? ''; };

export default function ClientFiltersDrawer({ filters }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (!open) return; const key = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false); document.body.classList.add('drawer-open'); document.addEventListener('keydown', key); return () => { document.body.classList.remove('drawer-open'); document.removeEventListener('keydown', key); }; }, [open]);
  const drawer = mounted ? createPortal(<div className={open ? 'filter-drawer-backdrop is-open' : 'filter-drawer-backdrop'} onMouseDown={() => setOpen(false)} aria-hidden={!open}>
    <aside className="filter-drawer-panel record-filter-drawer-panel" role="dialog" aria-modal="true" aria-label="Filtri clienti" onMouseDown={event => event.stopPropagation()}>
      <div className="filter-drawer-header"><h3>Filtri clienti</h3><button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setOpen(false)}>×</button></div>
      <form className="record-filters recurring-drawer-filters party-filters" action="/clients" method="get">
        <label>Ragione sociale<input name="businessName" defaultValue={value(filters, 'businessName')} /></label>
        <label>Referente<input name="alias" defaultValue={value(filters, 'alias')} /></label>
        <label>Email<input type="email" name="email" defaultValue={value(filters, 'email')} /></label>
        <label>P.IVA / C.F.<input name="vatNumber" defaultValue={value(filters, 'vatNumber')} /></label>
        <label>Cod. SDI<input name="taxCodeSdi" defaultValue={value(filters, 'taxCodeSdi')} /></label>
        <label>PEC<input type="email" name="pec" defaultValue={value(filters, 'pec')} /></label>
        <label>IBAN<input name="iban" defaultValue={value(filters, 'iban')} /></label>
        <label>Swift<input name="swift" defaultValue={value(filters, 'swift')} /></label>
        <div className="filter-drawer-actions"><Link className="btn btn-md btn-default reset-button" href="/clients" onClick={() => setOpen(false)}>↺ Reset</Link><button className="btn btn-md btn-primary" type="submit">🔎 Filtra</button></div>
      </form>
    </aside>
  </div>, document.body) : null;
  return <><button className="btn btn-sm btn-default recurring-filter-trigger" type="button" onClick={() => setOpen(true)}><span className="btn-icon"><FilterIcon /></span><span className="recurring-filter-trigger-text">Filtri</span></button>{drawer}</>;
}
