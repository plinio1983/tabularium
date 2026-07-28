'use client';

import {useEffect, useState} from 'react';
import IncomeEntityDeleteForm from './IncomeEntityDeleteForm';

type Channel = {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
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
    <div className="sales-channel-settings-grid">
      {channels.map(channel => <article className="card sales-channel-settings-card" key={channel.id}>
        <div className="sales-channel-settings-card-heading">
          <span className="sales-channel-settings-icon" aria-hidden="true">{channel.icon || '•'}</span>
          <div><h4>{channel.name}</h4><p className="muted">Posizione nelle select: {channel.sortOrder}</p></div>
        </div>
        <div className="sales-channel-settings-usage">
          <strong>{channel._count.incomes}</strong>
          <span>{channel._count.incomes === 1 ? 'incasso collegato' : 'incassi collegati'}</span>
        </div>
        <div className="actions-row sales-channel-settings-card-actions">
          <IncomeEntityDeleteForm id={channel.id} kind="channel" name={channel.name} action={deleteAction}/>
          <button className="btn btn-sm btn-primary" type="button" onClick={() => setEditing(channel)}>
            ✎ Modifica
          </button>
        </div>
      </article>)}
    </div>

    {editing ? <div
      className="modal-backdrop sales-channel-edit-backdrop"
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
        <div className="modal-title">
          <div>
            <h3 id="sales-channel-edit-title">Modifica canale di vendita</h3>
            <p className="muted">Aggiorna nome, icona e posizione nelle select.</p>
          </div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi" onClick={() => setEditing(null)}>×</button>
        </div>
        <form action={updateAction} className="form expense-form sales-channel-edit-form">
          <input type="hidden" name="id" value={editing.id}/>
          <input type="hidden" name="kind" value="channel"/>
          <label className="span-2">Nome<input name="name" defaultValue={editing.name} maxLength={80} required autoFocus/></label>
          <label>Icona
            <select name="icon" defaultValue={editing.icon ?? ''}>
              <option value="">Nessuna</option>
              {iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}
            </select>
          </label>
          <label>Ordine nelle select
            <input name="sortOrder" type="number" min="0" max="9999" step="1" defaultValue={editing.sortOrder}/>
          </label>
          <div className="actions-row span-2 sales-channel-edit-actions">
            <button className="btn btn-md btn-default" type="button" onClick={() => setEditing(null)}>Annulla</button>
            <button className="btn btn-md btn-primary" type="submit">✓ Salva modifiche</button>
          </div>
        </form>
      </section>
    </div> : null}
  </>;
}
