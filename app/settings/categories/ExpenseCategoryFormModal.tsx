'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {createPortal, useFormStatus} from 'react-dom';
import {FormField} from '@/components/FormControls';
import EntityFormActions from '@/components/EntityFormActions';

type CategoryValues = {id: number; name: string; code: string; icon: string | null; protected: boolean};
type Props = {
  category?: CategoryValues;
  action: (formData: FormData) => void | Promise<void>;
  iconOptions: readonly string[];
  onClose: () => void;
};

function FormActions({editing, onCancel}: {editing: boolean; onCancel: () => void}) {
  const {pending} = useFormStatus();
  const label = editing ? 'Salva categoria' : 'Aggiungi categoria';
  return <EntityFormActions onCancel={onCancel} submitting={pending} submitLabel={label} mobileSubmitLabel={label}/>;
}

/** Creation and editing share the application's entity modal, fields and actions. */
export default function ExpenseCategoryFormModal({category, action, iconOptions, onClose}: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const busyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const fieldPrefix = useId();
  const title = category ? 'Modifica categoria' : 'Nuova categoria';
  function close() {if (!busyRef.current) onClose();}

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cardRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus({preventScroll: true});
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({preventScroll: true});
    };
  }, []);

  async function submit(formData: FormData) {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    try {await action(formData);} finally {
      busyRef.current = false;
      setSaving(false);
      onClose();
    }
  }

  return createPortal(<div className="modal-backdrop app-form-modal" role="presentation"
    onMouseDown={event => {if (event.target === event.currentTarget) close();}}
    onKeyDown={event => {
      if (event.defaultPrevented || document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {event.stopPropagation(); close();}
      if (event.key !== 'Tab') return;
      const controls = [...Array.from(cardRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]') ?? []),
        ...Array.from(document.querySelectorAll<HTMLElement>('body > .mobile-form-sticky-actions button:not(:disabled)'))]
        .filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
    }}>
    <section ref={cardRef} className="modal-card modal-card-wide entity-form-modal-card" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="modal-title">
        <div><h3 id={titleId}>{title}</h3><p className="muted">{category ? category.name : 'Inserisci i dati della nuova categoria di spesa.'}</p></div>
        <button className="btn btn-neutral btn-icon-only modal-close-button" type="button" aria-label="Chiudi" disabled={saving} onClick={close}><span className="btn-icon">×</span></button>
      </div>
      <form action={submit} className="form app-record-form entity-form entity-styled-form">
        {category ? <input type="hidden" name="id" value={category.id}/> : null}
        <details className="form-section full entity-form-section" open>
          <summary><span>Dati categoria</span><small>Nome, acronimo e icona</small></summary>
          <div className="form-section-grid entity-form-section-grid">
            <FormField label="Nome" icon="✎" htmlFor={`${fieldPrefix}-name`} className="span-2">
              <input id={`${fieldPrefix}-name`} name="name" defaultValue={category?.name ?? ''} maxLength={80} required/>
            </FormField>
            <FormField label="Acronimo" icon="#" htmlFor={`${fieldPrefix}-code`} hint={category?.protected ? 'Acronimo di sistema non modificabile.' : 'Massimo 5 lettere o numeri.'}>
              <input id={`${fieldPrefix}-code`} name="code" defaultValue={category?.code ?? ''} maxLength={5} pattern="[A-Za-z0-9]{1,5}" readOnly={category?.protected ?? false} required/>
            </FormField>
            <FormField label="Icona" icon="◇" htmlFor={`${fieldPrefix}-icon`} hint="Icona mostrata nei form e nelle liste.">
              <div className="app-select-control">
                <select id={`${fieldPrefix}-icon`} name="icon" defaultValue={category?.icon ?? ''}>
                  <option value="">Nessuna</option>
                  {iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}
                </select>
                <span className="app-select-caret" aria-hidden="true">⌄</span>
              </div>
            </FormField>
          </div>
        </details>
        <FormActions editing={Boolean(category)} onCancel={close}/>
      </form>
    </section>
  </div>, document.body);
}
