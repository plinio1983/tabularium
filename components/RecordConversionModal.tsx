'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import InfoHint from './InfoHint';

export default function RecordConversionModal({title, description, help, busy, onClose, children}: {
    title: string; description: string; help: ReactNode; busy: boolean; onClose: () => void; children: ReactNode;
}) {
    const [mounted, setMounted] = useState(false);
    const card = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setMounted(true);
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus({preventScroll: true});
        };
    }, []);
    useEffect(() => {if (mounted) card.current?.querySelector<HTMLButtonElement>('button')?.focus();}, [mounted]);
    useEffect(() => {
        function keyDown(event: KeyboardEvent) {
            if (event.defaultPrevented || document.querySelector('dialog[open]')) return;
            const activeDialog = (document.activeElement as HTMLElement | null)?.closest('[role="dialog"]');
            if (activeDialog && !activeDialog.classList.contains('record-conversion-modal')) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                if (!busy) onClose();
            }
            if (event.key !== 'Tab') return;
            // Wizard actions are portaled beside the modal rather than inside its card.
            const controls = Array.from(document.querySelectorAll<HTMLElement>(
                '.record-conversion-modal button:not(:disabled), .record-conversion-modal a[href], .record-conversion-modal input:not(:disabled), .record-conversion-modal select:not(:disabled), .record-conversion-modal textarea:not(:disabled), .mobile-form-sticky-actions button:not(:disabled), .mobile-form-sticky-actions a[href]'
            )).filter(element => element.getClientRects().length && !element.closest('[hidden]'));
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
            if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
        }
        document.addEventListener('keydown', keyDown);
        return () => document.removeEventListener('keydown', keyDown);
    }, [busy, onClose]);
    if (!mounted) return null;
    return createPortal(<div className="modal-backdrop app-form-modal app-wizard-modal record-conversion-modal" role="dialog" aria-modal="true" aria-label={title}
        onMouseDown={event => {if (event.target === event.currentTarget && !busy) onClose();}}>
        <div ref={card} className="modal-card modal-card-wide app-wizard-modal-card record-conversion">
            <div className="modal-title">
                <div>
                    <div className="info-title-row"><h3>{title}</h3><InfoHint compactOnly title={title}><p>{description}</p>{help}</InfoHint></div>
                    <p className="muted record-conversion-description">{description}</p>
                </div>
                <button className="btn btn-neutral btn-icon-only modal-close-button" type="button" disabled={busy} onClick={onClose} aria-label="Chiudi conversione"><span className="btn-icon">×</span></button>
            </div>
            {children}
        </div>
    </div>, document.body);
}
