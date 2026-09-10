'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

/** Keep the shell mounted so both opening and closing use the shared CSS transition. */
export default function FilterDrawer({open, onClose, title, panelClassName = 'record-filter-drawer-panel transaction-filter-drawer-panel', actions, children}: {
  open: boolean; onClose: () => void; title: string; panelClassName?: string;
  actions: ReactNode; children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open || !mounted) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.classList.add('drawer-open');
    closeRef.current?.focus({preventScroll: true});
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;
      const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []).filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
      if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('drawer-open');
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus({preventScroll: true});
    };
  }, [open, mounted]);
  if (!mounted) return null;
  return createPortal(<div className={`filter-drawer-backdrop${open ? ' is-open' : ''}`} inert={!open} aria-hidden={!open}
    onMouseDown={event => {if (event.target === event.currentTarget) onClose();}}>
    <aside ref={panelRef} className={`filter-drawer-panel filter-drawer-with-footer ${panelClassName}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="filter-drawer-header">
        <h3>{title}</h3>
        <button ref={closeRef} className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi filtri" onClick={onClose}>×</button>
      </div>
      {children}
      {actions}
    </aside>
  </div>, document.body);
}
