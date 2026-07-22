'use client';
import { useEffect, useState } from 'react';
import ClientFormFields from '@/components/ClientFormFields';

export default function NewClientPanel({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [action, setAction] = useState('/api/clients');
  useEffect(() => {
    const handler = (event: MouseEvent) => { if ((event.target as HTMLElement)?.closest('[data-client-new]')) { event.preventDefault(); setOpen(true); } };
    document.addEventListener('click', handler); return () => document.removeEventListener('click', handler);
  }, []);
  useEffect(() => { setAction(`/api/clients?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`); }, []);
  return <>{open ? <div className="modal-backdrop app-form-modal" role="dialog" aria-modal="true" aria-label="Aggiungi nuovo cliente" onMouseDown={() => setOpen(false)}><div className="modal-card modal-card-wide supplier-form-modal-card" onMouseDown={event => event.stopPropagation()}>
    <div className="modal-title"><div><h3>Nuovo cliente</h3><p className="muted">Inserisci i dati del cliente.</p></div><button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setOpen(false)}>×</button></div>
    <form className="card form income-form expense-form supplier-form supplier-styled-form inline-create-form" action={action} method="post"><ClientFormFields /><div className="full actions-row right-actions form-actions-row supplier-form-actions"><button className="btn btn-md btn-default" type="button" onClick={() => setOpen(false)}><span className="btn-icon">✕</span> Annulla</button><button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">✓</span> Salva cliente</button></div></form>
  </div></div> : null}</>;
}
