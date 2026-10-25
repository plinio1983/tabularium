'use client';

import {useEffect, useId, useRef, useState} from 'react';
import Link from 'next/link';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import SearchIcon from '@/components/SearchIcon';
import type {DashboardSearchGroup, DashboardSearchItem} from '@/lib/dashboard-search';

export default function DashboardSearch() {
    const id = useId();
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams().toString();
    const returnTo = `${pathname}${params ? `?${params}` : ''}`;
    const [value, setValue] = useState('');
    const [response, setResponse] = useState<{ query: string; groups: DashboardSearchGroup[] }>({
        query: '',
        groups: []
    });
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [composing, setComposing] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const query = value.trim().replace(/\s+/g, ' ').slice(0, 120);
    const groups = response.query === query ? response.groups : [];
    const items = groups.flatMap(group => group.items);
    const visible = open && query.length >= 2 && !composing;
    const loading = pending || response.query !== query;
    const href = (item: DashboardSearchItem) => `${item.href}?returnTo=${encodeURIComponent(returnTo)}`;

    useEffect(() => {
        const close = (event: MouseEvent) => {
            if (!container.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;
        setActive(-1);
        setError('');
        if (query.length < 2 || composing) {
            setPending(false);
            return () => controller.abort();
        }
        setPending(true);
        const timer = window.setTimeout(async () => {
            try {
                const result = await fetch(`/api/dashboard/search?q=${encodeURIComponent(query)}`, {
                    signal: controller.signal,
                    cache: 'no-store'
                });
                if (!result.ok) throw new Error('Ricerca non disponibile. Riprova.');
                const data = await result.json();
                if (!cancelled) setResponse({query, groups: data.groups});
            } catch {
                if (!cancelled) {
                    setResponse({query, groups: []});
                    setError('Ricerca non disponibile. Riprova.');
                }
            } finally {
                if (!cancelled) setPending(false);
            }
        }, 280);
        return () => {
            cancelled = true;
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [query, composing]);

    useEffect(() => {
        if (visible && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block: 'nearest'});
    }, [id, active, visible]);

    return <div className="dashboard-search entity-quick-search" ref={container} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
        <label className="app-form-field-label hidden-sm-down" htmlFor={id}>
            <span className="app-form-field-icon" aria-hidden="true">⌕</span>
            Cerca nell’app
        </label>
        <div className="app-autocomplete-control dashboard-search-control">
            <span className="app-autocomplete-search-icon" aria-hidden="true"><SearchIcon/></span>
            <input ref={input} id={id} type="text" enterKeyHint="search" role="combobox" autoComplete="off" maxLength={120}
                   placeholder="Cerca spese, incassi, ricorrenze, fornitori, clienti e dipendenti"
                   value={value} aria-autocomplete="list" aria-expanded={visible}
                   aria-controls={visible ? `${id}-results` : undefined}
                   aria-activedescendant={visible && active >= 0 && items[active] ? `${id}-option-${active}` : undefined}
                   onFocus={() => setOpen(true)} onChange={event => {
                setValue(event.target.value);
                setActive(-1);
                setOpen(true);
            }}
                   onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
                   onKeyDown={event => {
                       if (event.nativeEvent.isComposing || composing) return;
                       if (event.key === 'Escape') {
                           event.preventDefault();
                           setOpen(false);
                           setActive(-1);
                       }
                       if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                           event.preventDefault();
                           setOpen(true);
                           setActive(index => items.length ? event.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : index <= 0 ? items.length - 1 : index - 1 : -1);
                       }
                       if (event.key === 'Enter') {
                           event.preventDefault();
                           if (visible && items[active]) {
                               setOpen(false);
                               router.push(href(items[active]));
                           } else setOpen(true);
                       }
                   }}/>
            {value &&
                <button type="button" className="app-autocomplete-clear" aria-label="Cancella ricerca" onClick={() => {
                    setValue('');
                    setOpen(false);
                    setActive(-1);
                    input.current?.focus();
                }}><span className="btn-icon">×</span></button>}
        </div>
        {visible &&
            <div className="entity-autocomplete-results dashboard-search-results" id={`${id}-results`} role="listbox"
                 aria-label="Risultati ricerca" aria-busy={loading}>
                {loading ? <div className="entity-autocomplete-empty" role="status">Ricerca in corso…</div> : error ?
                    <div className="entity-autocomplete-empty" role="status">{error}</div> : !items.length ?
                        <div className="entity-autocomplete-empty" role="status">Nessun risultato
                            trovato.</div> : groups.map(group => <div key={group.key} role="group"
                                                                      aria-labelledby={`${id}-${group.key}`}>
                            <div className="dashboard-search-group-label" id={`${id}-${group.key}`}>{group.label}</div>
                            {group.items.map(item => {
                                const index = items.indexOf(item);
                                return <Link key={item.id} id={`${id}-option-${index}`} role="option"
                                             aria-selected={active === index}
                                             href={href(item)}
                                             className={`dashboard-search-result${active === index ? ' active' : ''}`}
                                             onMouseEnter={() => setActive(index)} onClick={() => setOpen(false)}>
                                    <strong>{item.title}</strong>{item.subtitle && <small>{item.subtitle}</small>}
                                </Link>;
                            })}
                        </div>)}
            </div>}
        <span className="sr-only" role="status"
              aria-live="polite">{visible && !loading && !error ? `${items.length} risultati mostrati, massimo 5 per categoria.` : ''}</span>
    </div>;
}
