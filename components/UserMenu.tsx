'use client';

import Link from 'next/link';
import {useEffect, useId, useRef, useState} from 'react';
import {usePathname} from 'next/navigation';

type Company = {id: number; name: string; isActive: boolean};
type CompaniesResponse = {activeCompanyId: number; companies: Company[]};

export default function UserMenu({userName}: {userName?: string | null}) {
    const initial = Array.from(userName?.trim() || 'U')[0].toLocaleUpperCase('it-IT');
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<CompaniesResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [switchingId, setSwitchingId] = useState<number | null>(null);
    const [retry, setRetry] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const switchingRef = useRef(false);
    const panelId = useId();
    const pathname = usePathname();

    useEffect(() => {setOpen(false);}, [pathname]);

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        setData(null);
        fetch('/api/companies?includeInactive=true', {cache: 'no-store', signal: controller.signal})
            .then(async response => {
                if (!response.ok) throw new Error('Impossibile caricare le società.');
                const payload: CompaniesResponse = await response.json();
                if (!controller.signal.aborted) setData(payload);
            })
            .catch(() => {if (!controller.signal.aborted) setError('Impossibile caricare le società. Riprova.');})
            .finally(() => {if (!controller.signal.aborted) setLoading(false);});
        return () => controller.abort();
    }, [open, retry]);

    useEffect(() => {
        if (!open) return;
        const outside = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('mousedown', outside);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    async function switchCompany(company: Company) {
        if (!company.isActive || company.id === data?.activeCompanyId || switchingRef.current) return;
        switchingRef.current = true;
        setSwitchingId(company.id);
        setError('');
        try {
            const formData = new FormData();
            formData.set('companyId', String(company.id));
            const response = await fetch('/api/companies/switch', {
                method: 'POST', headers: {Accept: 'application/json'}, body: formData
            });
            if (!response.ok) throw new Error('Impossibile cambiare società. Riprova.');
            try {
                window.localStorage.removeItem('dmsAccounting.expenses.filters');
                window.localStorage.removeItem('dmsAccounting.incomes.filters');
            } catch { /* The session has already changed even if storage is unavailable. */ }
            window.location.assign('/');
        } catch {
            setError('Impossibile cambiare società. Riprova.');
            setSwitchingId(null);
            switchingRef.current = false;
        }
    }

    return <div className="user-menu" ref={rootRef} onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
        <button ref={triggerRef} className="user-menu-trigger" type="button" aria-label="Menu utente"
                aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
            {/* <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>
            </svg> */}
            <span aria-hidden="true">{initial}</span>
        </button>
        {open ? <div className="user-menu-popover" id={panelId}>
            <nav aria-label="Menu utente" className="user-menu-links">
                <Link href="/settings/account" onClick={() => setOpen(false)}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>
                    </svg>
                    <span>{userName?.trim() || 'Account'}</span>
                </Link>
                <Link href="/account/workspace" onClick={() => setOpen(false)}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
                    </svg>
                    <span>Workspace</span>
                </Link>
                <Link href="/settings/company-settings" onClick={() => setOpen(false)}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 21V7h8v14M11 21V3h10v18M1 21h22M6 11h2m-2 4h2m6-8h3m-3 4h3m-3 4h3"/>
                    </svg>
                    <span>Società</span>
                </Link>
                <Link href="/settings/company-settings" onClick={() => setOpen(false)}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 21v-4h6v4M9 7h1m4 0h1M9 11h1m4 0h1"/>
                    </svg>
                    <span>Dati Azienda</span>
                </Link>
            </nav>
            <hr/>
            <div className="user-menu-companies" role="group" aria-label="Società" aria-busy={loading || switchingId !== null}>
                {loading ? <p role="status">Caricamento società…</p> : null}
                {data?.companies.map(company => <button key={company.id} type="button"
                    className={company.id === data.activeCompanyId ? 'is-active' : undefined}
                    aria-pressed={company.id === data.activeCompanyId}
                    disabled={!company.isActive || switchingId !== null}
                    onClick={() => switchCompany(company)}>
                    <span className="user-menu-company-name">{company.name}{!company.isActive ? <small>Disabilitata</small> : null}</span>
                    <span aria-hidden="true">{company.id === data.activeCompanyId ? '✓' : ''}</span>
                </button>)}
                {switchingId !== null ? <p role="status">Cambio società in corso…</p> : null}
                {error ? <div className="user-menu-error" role="alert">{error}
                    {!data ? <button type="button" onClick={() => setRetry(value => value + 1)}>Riprova</button> : null}
                </div> : null}
            </div>
            <hr/>
            <form action="/logout" method="post" className="user-menu-links user-menu-logout">
                <button type="submit">
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                    </svg>
                    <span>Logout</span>
                </button>
            </form>
        </div> : null}
    </div>;
}
