'use client';

import {useFormStatus} from 'react-dom';

function DeleteButton({blocked}: {blocked: boolean}) {
  const {pending} = useFormStatus();
  return <button type="submit" className="btn btn-md btn-danger" disabled={blocked || pending}>
    <span className="btn-icon">🗑</span> {pending ? 'Eliminazione…' : 'Elimina società'}
  </button>;
}

export default function CompanyDeleteForm({id, name, blockedReason, action}: {
  id: number; name: string; blockedReason?: string; action: (formData: FormData) => Promise<void>;
}) {
  return <form action={action} className="company-settings-delete-form" onSubmit={event => {
    if (blockedReason || !window.confirm(`Eliminare definitivamente la società “${name}”? L’operazione non può essere annullata. Se è in uso o predefinita, verrà selezionata un’altra società abilitata.`)) event.preventDefault();
  }}>
    <input type="hidden" name="id" value={id}/>
    <p className="muted">{blockedReason || 'Puoi eliminare questa società perché non contiene dati collegati.'}</p>
    <DeleteButton blocked={Boolean(blockedReason)}/>
  </form>;
}
