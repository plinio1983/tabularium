'use client';

import {useEffect, useId, useRef, useState, type ComponentProps} from 'react';
import {createPortal, useFormStatus} from 'react-dom';
import CompanyFormFields from '@/components/CompanyFormFields';
import EntityFormActions from '@/components/EntityFormActions';

type Props = {
  company?: NonNullable<ComponentProps<typeof CompanyFormFields>['company']> & {id: number};
  action: (formData: FormData) => void | Promise<void>;
};

function FormActions({editing, onCancel}: {editing: boolean; onCancel: () => void}) {
  const {pending} = useFormStatus();
  return <EntityFormActions onCancel={onCancel} submitting={pending}
    submitLabel={editing ? 'Salva modifiche' : 'Aggiungi società'}
    mobileSubmitLabel={editing ? 'Salva modifiche' : 'Aggiungi società'}/>;
}

export default function CompanyCreatePanel({action, company}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const previousFocus = useRef<HTMLElement | null>(null);
  function openModal() {
    previousFocus.current = document.activeElement as HTMLElement | null;
    setIsOpen(true);
  }

  useEffect(() => {
    if (company) return;
    function onClick(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest('[data-company-new]')) openModal();
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [company]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cardRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      (previousFocus.current ?? triggerRef.current)?.focus({preventScroll: true});
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
    <div className="company-modal-trigger">
      <button ref={triggerRef} type="button" className={`btn btn-md ${company ? 'btn-default' : 'btn-primary'}`} aria-haspopup="dialog" onClick={openModal}>
        <span className="btn-icon" aria-hidden="true">{company ? '✎' : '＋'}</span> {company ? 'Modifica' : 'Nuova società'}
      </button>
    </div>
    {isOpen ? createPortal(<div className="modal-backdrop app-form-modal company-create-modal" role="presentation"
      onMouseDown={event => {if (event.target === event.currentTarget) setIsOpen(false);}}
      onKeyDown={event => {
        if (event.key === 'Escape') {event.stopPropagation(); setIsOpen(false);}
        if (event.key !== 'Tab') return;
        const focusable = [...Array.from(cardRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') ?? []), ...Array.from(document.querySelectorAll<HTMLElement>('body > .mobile-form-sticky-actions button:not(:disabled)'))]
          .filter(element => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
      }}>
      <section ref={cardRef} className="modal-card modal-card-wide entity-form-modal-card" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-title">
          <div><h3 id={titleId}>{company ? 'Modifica società' : 'Nuova società'}</h3><p className="muted">{company ? company.name : 'Inserisci i dati della nuova società contabile.'}</p></div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi" onClick={() => setIsOpen(false)}><span className="btn-icon">×</span></button>
        </div>
        <form action={submit} className="form app-record-form entity-form entity-styled-form company-settings-form company-create-form">
          {company ? <input type="hidden" name="id" value={company.id}/> : null}
          <CompanyFormFields company={company} idPrefix={company ? `company-${company.id}` : 'company-new'}/>
          <FormActions editing={Boolean(company)} onCancel={() => setIsOpen(false)}/>
        </form>
      </section>
    </div>, document.body) : null}
  </>;
}
