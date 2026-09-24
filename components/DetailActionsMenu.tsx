'use client';

import {useEffect, useRef, type ReactNode} from 'react';

export default function DetailActionsMenu({children, desktop = false}: {children: ReactNode; desktop?: boolean}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      const menu = menuRef.current;
      if (event.key === 'Escape' && menu?.open) {
        menu.open = false;
        menu.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return <details ref={menuRef} className={`detail-actions-menu${desktop ? " detail-actions-menu-desktop" : ""}`}>
    <summary className="btn btn-sm btn-default" aria-label="Azioni del dettaglio">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    </summary>
    <div className="detail-actions-menu-panel" onClick={event => {
      const action = event.target instanceof Element ? event.target.closest('button, a') : null;
      if (!action || action.matches(':disabled, [aria-disabled="true"]')) return;
      // Let delegated action handlers and native form submissions run first.
      window.setTimeout(() => {if (menuRef.current) menuRef.current.open = false;}, 0);
    }}>{children}</div>
  </details>;
}
