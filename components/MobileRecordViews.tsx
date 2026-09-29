'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import {usePathname, useSearchParams} from 'next/navigation';

/** Two mobile views sharing the existing server-rendered summary and records. */
export default function MobileRecordViews({summary, children, title, count, kind = 'expense', linkLabel}: {
  summary: ReactNode; children: ReactNode; title: string; count: number; kind?: 'expense' | 'income'; linkLabel?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const open = params.get('mobileList') === '1';
  const [mobile, setMobile] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const previousOpen = useRef(open);
  const summaryScroll = useRef(0);
  const query = new URLSearchParams(params.toString());
  query.set('mobileList', '1');
  const href = `${pathname}?${query}`;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (summaryRef.current) summaryRef.current.inert = mobile && open;
    if (listRef.current) listRef.current.inert = mobile && !open;
    if (mobile && previousOpen.current !== open) {
      window.scrollTo({top: open ? 0 : summaryScroll.current, behavior: 'instant'});
      (open ? listRef.current?.querySelector<HTMLButtonElement>('.mobile-record-close') : triggerRef.current)?.focus({preventScroll: true});
    }
    previousOpen.current = open;
    window.dispatchEvent(new Event('record-view-change'));
  }, [open, mobile]);

  function showList() {
    summaryScroll.current = window.scrollY;
    // Native history preserves the mounted records and supports browser Back.
    window.history.pushState(null, '', href);
  }

  return <div className="mobile-record-views" data-list-open={open}>
    <div className="mobile-record-summary" ref={summaryRef}>
      {summary}
      <a ref={triggerRef} className={`card month-report-record-link is-${kind} mobile-record-open`} href={href}
        onClick={event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); showList();
        }}>
        <span>{linkLabel ?? `Visualizza ${kind === 'income' ? 'incassi' : 'spese'}`} · {count}</span><strong aria-hidden="true">→</strong>
      </a>
    </div>
    <div className="mobile-record-list-pane" aria-label={title} ref={listRef} onTransitionEnd={event => {
      if (event.target === event.currentTarget && event.propertyName === 'transform') window.dispatchEvent(new Event('record-view-change'));
    }}>
      {children}
    </div>
  </div>;
}

export function MobileRecordCloseButton() {
  const pathname = usePathname();
  function closeList() {
    const next = new URLSearchParams(window.location.search);
    next.delete('mobileList');
    window.history.replaceState(null, '', `${pathname}${next.size ? `?${next}` : ''}`);
  }
  return <button type="button" className="btn btn-neutral btn-icon-only modal-close-button mobile-record-close"
    aria-label="Chiudi lista e torna al riepilogo" onClick={closeList}><span className="btn-icon">×</span></button>;
}
