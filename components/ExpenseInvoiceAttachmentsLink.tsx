'use client';

import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';

type InvoiceAttachment = {
  id: number;
  originalName: string;
  sizeBytes?: number | null;
};

export default function ExpenseInvoiceAttachmentsLink({attachments}: {attachments?: InvoiceAttachment[]}) {
  const invoices = attachments ?? [];
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.classList.add('invoice-attachments-modal-open');
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('invoice-attachments-modal-open');
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!invoices.length) return null;

  function activate(event: React.MouseEvent | React.KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (invoices.length === 1) {
      window.open(`/api/attachments/${invoices[0].id}`, '_blank', 'noopener,noreferrer');
      return;
    }
    setOpen(true);
  }

  const modal = mounted && open ? createPortal(
    <div className="modal-backdrop invoice-attachments-modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="modal-card invoice-attachments-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-attachments-modal-title" onMouseDown={event => event.stopPropagation()}>
        <div className="modal-title">
          <div><h3 id="invoice-attachments-modal-title">Fatture allegate</h3><p className="muted">Seleziona il documento da aprire o scaricare.</p></div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setOpen(false)} aria-label="Chiudi">×</button>
        </div>
        <div className="invoice-attachments-modal-list">
          {invoices.map(attachment => <a href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer" key={attachment.id} onClick={() => setOpen(false)}>
            <span aria-hidden="true">📎</span>
            <strong>{attachment.originalName}</strong>
            <small>{attachment.sizeBytes ? `${Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB` : 'Apri documento'}</small>
            <span aria-hidden="true">↗</span>
          </a>)}
        </div>
      </section>
    </div>,
    document.body
  ) : null;

  return <>
    <span className="expense-invoice-attachment-link" role="link" tabIndex={0}
          aria-label={invoices.length === 1 ? `Apri fattura allegata ${invoices[0].originalName}` : `Apri elenco di ${invoices.length} fatture allegate`}
          title={invoices.length === 1 ? 'Apri fattura allegata' : `${invoices.length} fatture allegate`}
          onClick={activate}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') activate(event);
          }}>
      <span aria-hidden="true">📎</span>{invoices.length > 1 ? <small>{invoices.length}</small> : null}
    </span>
    {modal}
  </>;
}
