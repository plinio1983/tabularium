'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {createPortal, useFormStatus} from 'react-dom';
import CompanyFormFields from '@/components/CompanyFormFields';

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

function SubmitButton() {
  const {pending} = useFormStatus();
  return <button className="btn btn-md btn-primary" type="submit" disabled={pending}>
    <span className="btn-icon">＋</span> {pending ? 'Salvataggio…' : 'Aggiungi società'}
  </button>;
}

export default function CompanyCreatePanel({action}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cardRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus({preventScroll: true});
    };
  }, [isOpen]);

  async function submit(formData: FormData) {
    try {
      await action(formData);
    } finally {
      setIsOpen(false);
    }
  }

  return <>
    <div className="actions-row">
      <button ref={triggerRef} type="button" className="btn btn-md btn-primary" aria-haspopup="dialog" onClick={() => setIsOpen(true)}>
        <span className="btn-icon" aria-hidden="true">＋</span> Nuova società
      </button>
    </div>
    {isOpen ? createPortal(<div className="modal-backdrop app-form-modal company-create-modal" role="presentation"
      onMouseDown={event => {if (event.target === event.currentTarget) setIsOpen(false);}}
      onKeyDown={event => {
        if (event.key === 'Escape') {event.stopPropagation(); setIsOpen(false);}
        if (event.key !== 'Tab') return;
        const focusable = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') ?? [])
          .filter(element => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
      }}>
      <section ref={cardRef} className="modal-card modal-card-wide entity-form-modal-card" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-title">
          <div><h3 id={titleId}>Nuova società</h3><p className="muted">Inserisci i dati della nuova società contabile.</p></div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi" onClick={() => setIsOpen(false)}>×</button>
        </div>
        <form action={submit} className="form app-record-form entity-form entity-styled-form company-settings-form company-create-form">
          <CompanyFormFields idPrefix="company-new"/>
          <div className="actions-row form-actions-row full company-settings-actions company-create-actions">
            <button type="button" className="btn btn-md btn-default" onClick={() => setIsOpen(false)}><span className="btn-icon">✕</span> Annulla</button>
            <SubmitButton/>
          </div>
        </form>
      </section>
    </div>, document.body) : null}
  </>;
}
