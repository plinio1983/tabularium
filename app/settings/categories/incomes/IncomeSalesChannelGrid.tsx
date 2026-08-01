'use client';

import {useEffect, useState} from 'react';
import IncomeEntityDeleteForm from './IncomeEntityDeleteForm';
import MobileFormStickyActions from '@/components/MobileFormStickyActions';

type Channel = {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
  isDefault?: boolean;
  isFallback?: boolean;
  _count: {incomes: number};
};

type Props = {
  channels: Channel[];
  iconOptions: readonly string[];
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
};

export default function IncomeSalesChannelGrid({channels, iconOptions, updateAction, deleteAction}: Props) {
  const [editing, setEditing] = useState<Channel | null>(null);

  useEffect(() => {
    if (!editing) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditing(null);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [editing]);

  return <>
    <section className="card expense-category-list-card sales-channel-list-card">
      <div className="expense-category-list-heading"><div><h3>Canali configurati</h3><p className="muted">{channels.length} {channels.length === 1 ? 'canale' : 'canali'}</p></div></div>
      <div className="expense-category-settings-list">
      {channels.map(channel => <article className="expense-category-settings-item" key={channel.id}>
        <span className="expense-category-settings-icon" aria-hidden="true">{channel.icon || '•'}</span>
        <div className="expense-category-settings-copy">
          <strong>{channel.name} {channel.isDefault ? <span className="badge">Preselezionato</span> : null} {channel.isFallback ? <span className="badge tone-neutral">Fallback</span> : null}</strong>
          <span>Ordine {channel.sortOrder} · {channel._count.incomes} {channel._count.incomes === 1 ? 'incasso' : 'incassi'}</span>
        </div>
        <div className="expense-category-settings-actions">
          {!channel.isFallback
            ? <IncomeEntityDeleteForm id={channel.id} kind="channel" name={channel.name} action={deleteAction}/>
            : <button className="btn btn-sm btn-danger" type="button" disabled>Rimuovi</button>}
          <button className="btn btn-sm btn-primary" type="button" onClick={() => setEditing(channel)}>
            ✎ Modifica
          </button>
        </div>
      </article>)}
      </div>
    </section>

    {editing ? <div
      className="modal-backdrop app-form-modal sales-channel-edit-backdrop"
      role="presentation"
      onMouseDown={() => setEditing(null)}
    >
      <section
        className="modal-card sales-channel-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-channel-edit-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="toolbar-card modal-toolbar-card">
          <div>
            <h3 id="sales-channel-edit-title">Modifica canale di vendita</h3>
            <p className="muted">Aggiorna nome, icona e posizione nelle select.</p>
          </div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi" onClick={() => setEditing(null)}>×</button>
        </div>
        <form action={updateAction} className="form app-record-form sales-channel-edit-form">
          <input type="hidden" name="id" value={editing.id}/>
          <input type="hidden" name="kind" value="channel"/>
          <div className="app-form-field span-2"><label className="app-form-field-label">Nome</label><input name="name" defaultValue={editing.name} maxLength={80} required autoFocus/></div>
          <div className="app-form-field"><label className="app-form-field-label">Icona</label>
            <select name="icon" defaultValue={editing.icon ?? ''}>
              <option value="">Nessuna</option>
              {iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}
            </select>
          </div>
          <label className="app-form-field">Ordine nelle select
            <input name="sortOrder" type="number" min="0" max="9999" step="1" defaultValue={editing.sortOrder}/>
          </label>
          {!editing.isFallback ? <label className="span-2">
            <span><input name="isDefault" type="checkbox" defaultChecked={editing.isDefault}/> Preseleziona questo canale nei nuovi incassi</span>
          </label> : <p className="muted span-2">Questo è il canale tecnico di fallback e viene usato solo quando non sono disponibili canali ordinari.</p>}
          <div className="actions-row span-2 sales-channel-edit-actions">
            <button className="btn btn-md btn-default" type="button" onClick={() => setEditing(null)}>Annulla</button>
            <button className="btn btn-md btn-primary" type="submit">✓ Salva modifiche</button>
          </div>
          <MobileFormStickyActions currentStep={1} submitStep={1} onBack={() => undefined} onNext={() => undefined}
            onCancel={() => setEditing(null)} submitLabel="Salva canale"/>
        </form>
      </section>
    </div> : null}
  </>;
}
