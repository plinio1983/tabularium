'use client';

import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

/** Contextual help, including inside an existing form dialog. */
export default function InfoHint({title = 'Informazioni', children, compactOnly = false, desktopAs: DesktopText = 'span'}: {title?: string; children: ReactNode; compactOnly?: boolean; desktopAs?: 'span' | 'small' | 'p' | 'div'}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    // Intercept Escape before the enclosing form's own dismissal handler.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus({preventScroll: true});
    };
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" className="info-hint-trigger" aria-label={`Informazioni: ${title}`}
      aria-haspopup="dialog" aria-expanded={open} onClick={event => {
        event.preventDefault(); event.stopPropagation(); setOpen(true);
      }}>
      <span className="btn-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg></span>
    </button>
    {!compactOnly ? <DesktopText className="info-hint-desktop-text">{children}</DesktopText> : null}
    {open ? createPortal(<dialog ref={dialogRef} className="info-hint-dialog" aria-labelledby={titleId}
      onCancel={event => {event.preventDefault(); setOpen(false);}}
      onClose={() => setOpen(false)}
      onKeyDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onClick={event => {event.stopPropagation(); if (event.target === event.currentTarget) setOpen(false);}}>
      <div className="info-hint-content">
        <div className="info-hint-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-neutral btn-icon-only modal-close-button" aria-label="Chiudi informazioni" onClick={() => setOpen(false)}><span className="btn-icon">×</span></button>
        </div>
        <div className="info-hint-body">{children}</div>
      </div>
    </dialog>, document.body) : null}
  </>;
}
