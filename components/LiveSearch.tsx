'use client';

import {useEffect, useId, useRef, useState, useTransition} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import SearchIcon from '@/components/SearchIcon';
import {liveSearchParams} from '@/lib/live-search';

type Props = {name: string; label: string; placeholder: string};
const storagePaths = new Set(['/expenses', '/incomes', '/suppliers']);

export default function LiveSearch({name, label, placeholder}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [value, setValue] = useState(searchParams.get(name) ?? '');
  const [pending, startTransition] = useTransition();
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requested = useRef(new Set<string>());
  const latestTarget = useRef(query);
  const restored = useRef(false);
  const id = useId();

  function cancelTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function navigate(text: string) {
    cancelTimer();
    setWaiting(false);
    const next = liveSearchParams(query, name, text).toString();
    if (next === query && latestTarget.current === next) return;
    latestTarget.current = next;
    requested.current.add(next);
    startTransition(() => router.replace(`${pathname}${next ? `?${next}` : ''}`, {scroll: false}));
  }

  useEffect(() => {
    // Responses to our own requests must never overwrite more recently typed text.
    if (requested.current.delete(query)) return;
    cancelTimer();
    setWaiting(false);
    latestTarget.current = query;
    setValue(new URLSearchParams(query).get(name) ?? '');
  }, [query, name]);

  useEffect(() => () => cancelTimer(), []);

  useEffect(() => {
    if (!pending) requested.current.clear();
  }, [pending]);

  useEffect(() => {
    if (!storagePaths.has(pathname)) return;
    const storageKey = `dmsAccounting.${pathname.slice(1)}.filters`;
    const params = liveSearchParams(query, name, new URLSearchParams(query).get(name) ?? '');
    const clean = params.toString();
    try {
      if (!restored.current) {
        restored.current = true;
        if (!clean) {
          const raw = localStorage.getItem(storageKey);
          let saved = '';
          if (raw && pathname === '/suppliers') saved = raw;
          else if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (typeof parsed.value === 'string' && typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt < 86400000) saved = parsed.value;
            } catch { /* Ignore expired or invalid stored filters. */ }
          }
          if (saved) {
            const stored = new URLSearchParams(saved);
            const next = liveSearchParams(stored.toString(), name, stored.get(name) ?? '').toString();
            if (next) {
              startTransition(() => router.replace(`${pathname}?${next}`, {scroll: false}));
              return;
            }
          }
        }
      }
      if (!clean) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, pathname === '/suppliers' ? `?${clean}` : JSON.stringify({value: `?${clean}`, savedAt: Date.now()}));
    } catch { /* Search also works when browser storage is unavailable. */ }
  }, [query, pathname, name, router]);

  return <form className="entity-quick-search app-quick-search-form" action={pathname} method="get" role="search" data-in-place-submit="true"
    onSubmit={event => { event.preventDefault(); navigate(value); }}>
    {Array.from(searchParams.entries()).filter(([key]) => key !== name).map(([key, item], index) =>
      <input type="hidden" name={key} value={item} key={`${key}-${index}`}/>)}
    <label className="app-form-field-label" htmlFor={id}><span className="app-form-field-icon" aria-hidden="true">⌕</span><span>{label}</span></label>
    <div className="entity-quick-search-field app-quick-search-field input-group">
      <input id={id} name={name} value={value} placeholder={placeholder} autoComplete="off" type="search"
        onChange={event => {
          const next = event.target.value;
          setValue(next);
          cancelTimer();
          setWaiting(true);
          if (!(event.nativeEvent as InputEvent).isComposing) timer.current = setTimeout(() => navigate(next), 300);
        }}
        onCompositionStart={cancelTimer}
        onCompositionEnd={event => { const next = event.currentTarget.value; cancelTimer(); timer.current = setTimeout(() => navigate(next), 300); }}/>
      <button className="btn btn-sm btn-main" type="submit" aria-label={label}><SearchIcon/></button>
    </div>
    <span role="status" aria-live="polite" className={pending || waiting ? 'muted' : 'sr-only'}>{pending || waiting ? 'Ricerca in corso…' : ''}</span>
  </form>;
}
