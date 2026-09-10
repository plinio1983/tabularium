'use client';

import {useEffect, useRef, useState, type ComponentProps, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useRouter} from 'next/navigation';
import RecurringIncomeForm from './RecurringIncomeForm';

type FormProps = ComponentProps<typeof RecurringIncomeForm>;
type Item = NonNullable<FormProps['initial']> & {id: number};

function Editor({item, onClose, onSaved, ...options}: Pick<FormProps, 'channels' | 'customers' | 'methods' | 'banks'> & {
  item: Item; onClose: () => void; onSaved: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    card.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({preventScroll: true});
    };
  }, []);
  return createPortal(<div className="modal-backdrop app-form-modal app-wizard-modal" role="dialog" aria-modal="true" aria-label="Modifica entrata ricorrente"
    onMouseDown={event => {if (event.target === event.currentTarget) onClose();}}
    onKeyDown={event => {
      if (event.key === 'Escape') {event.stopPropagation(); onClose();}
      if (event.key !== 'Tab') return;
      const controls = Array.from(card.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
      if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
    }}>
    <div ref={card} className="modal-card modal-card-wide app-wizard-modal-card">
      <div className="modal-title"><div><h3>Modifica entrata ricorrente</h3><p className="muted">Le modifiche valgono per le generazioni future.</p></div>
        <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={onClose} aria-label="Chiudi modifica entrata ricorrente">×</button>
      </div>
      <RecurringIncomeForm {...options} initial={item} editId={item.id} action="" cancelHref="/recurring-incomes" onCancel={onClose} onSaved={onSaved}/>
    </div>
  </div>, document.body);
}

export default function RecurringIncomeEditModal({items, children, ...options}: Pick<FormProps, 'channels' | 'customers' | 'methods' | 'banks'> & {items: Item[]; children: ReactNode}) {
  const [selected, setSelected] = useState<Item | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  function open(trigger: HTMLElement) {
    const item = items.find(item => item.id === Number(trigger.dataset.recurringIncomeEditId));
    if (item) {trigger.focus({preventScroll: true}); setSaved(false); setSelected(item);}
  }
  return <div onClickCapture={event => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest<HTMLElement>('[data-recurring-income-edit-id]');
    if (!trigger || (trigger.tagName !== 'A' && event.target.closest('a, button, input, select, textarea, label'))) return;
    event.preventDefault(); event.stopPropagation(); open(trigger);
  }} onKeyDown={event => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches('tr[data-recurring-income-edit-id]') || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); open(event.target);
  }}>
    {saved ? <p role="status" className="card">Entrata ricorrente aggiornata.</p> : null}
    {children}
    {selected ? <Editor key={selected.id} {...options} item={selected} onClose={() => setSelected(null)} onSaved={() => {setSelected(null); setSaved(true); router.refresh();}}/> : null}
  </div>;
}
