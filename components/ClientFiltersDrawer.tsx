'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (!open) return; const key = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false); document.body.classList.add('drawer-open'); document.addEventListener('keydown', key); return () => { document.body.classList.remove('drawer-open'); document.removeEventListener('keydown', key); }; }, [open]);
  const drawer = mounted ? createPortal(<div className={open ? 'filter-drawer-backdrop is-open' : 'filter-drawer-backdrop'} onMouseDown={() => setOpen(false)} aria-hidden={!open}>
    <aside className="filter-drawer-panel record-filter-drawer-panel" role="dialog" aria-modal="true" aria-label="Filtri clienti" onMouseDown={event => event.stopPropagation()}>
      <div className="filter-drawer-header"><h3>Filtri clienti</h3><button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setOpen(false)}>×</button></div>
      <form className="record-filters recurring-drawer-filters record-styled-drawer-filters party-filters" action="/clients" method="get">
        <FilterField label="Ragione sociale" icon="◇"><input name="businessName" defaultValue={value(filters, 'businessName')} /></FilterField>
        <FilterField label="Referente" icon="♙"><input name="alias" defaultValue={value(filters, 'alias')} /></FilterField>
        <FilterField label="Email" icon="@"><input type="email" name="email" defaultValue={value(filters, 'email')} /></FilterField>
        <FilterField label="P.IVA / C.F." icon="▤"><input name="vatNumber" defaultValue={value(filters, 'vatNumber')} /></FilterField>
        <FilterField label="Cod. SDI" icon="#"><input name="taxCodeSdi" defaultValue={value(filters, 'taxCodeSdi')} /></FilterField>
        <FilterField label="PEC" icon="✉"><input type="email" name="pec" defaultValue={value(filters, 'pec')} /></FilterField>
        <FilterField label="IBAN" icon="▣"><input name="iban" defaultValue={value(filters, 'iban')} /></FilterField>
        <FilterField label="Swift" icon="⇄"><input name="swift" defaultValue={value(filters, 'swift')} /></FilterField>
        <div className="filter-drawer-actions"><Link className="btn btn-md btn-default reset-button" href="/clients" onClick={() => setOpen(false)}><span className="btn-icon">↺</span> Reset</Link><button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">🔎</span> Filtra</button></div>
      </form>
    </aside>
  </div>, document.body) : null;
  return <><button className="btn btn-sm btn-default app-filter-trigger" type="button" onClick={() => setOpen(true)}><span className="btn-icon"><FilterIcon /></span><span className="app-filter-trigger-text">Filtri</span></button>{drawer}</>;
}
