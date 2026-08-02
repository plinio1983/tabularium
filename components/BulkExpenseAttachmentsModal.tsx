'use client';

import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';

type Filter = 'ALL' | 'INVOICES' | 'PAYMENTS';
type Summary = {selectedExpenses: number; matchedExpenses: number; attachmentCount: number; totalBytes: number};

const filters: Array<{value: Filter; label: string; icon: string}> = [
  {value: 'ALL', label: 'Tutti', icon: '📎'},
  {value: 'INVOICES', label: 'Solo fatture', icon: '▤'},
  {value: 'PAYMENTS', label: 'Solo pagamenti', icon: '✓'}
];

function selectedIds(formId: string) {
  const selector = `input[name="ids"][form="${CSS.escape(formId)}"]:checked, form#${CSS.escape(formId)} input[name="ids"]:checked`;
  return [...new Set(Array.from(document.querySelectorAll<HTMLInputElement>(selector)).map(input => Number(input.value)).filter(Number.isInteger))];
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

export default function BulkExpenseAttachmentsModal({formId}: {formId: string}) {
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<number[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'SUMMARY' | 'DOWNLOAD' | 'SHARE' | 'EMAIL' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function showModal() {
    const selected = selectedIds(formId);
    if (!selected.length) return;
    setIds(selected);
    setFilter('ALL');
    setError('');
    setNotice('');
    setOpen(true);
  }

  useEffect(() => {
    if (!open || !ids.length) return;
    const controller = new AbortController();
    setBusy('SUMMARY');
    setError('');
    fetch('/api/expenses/attachments/archive', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ids, filter, action: 'SUMMARY'}), signal: controller.signal
    }).then(async response => {
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? 'Impossibile verificare gli allegati');
      setSummary(body as Summary);
    }).catch(cause => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setSummary(null); setError(cause instanceof Error ? cause.message : 'Verifica non riuscita');
    }).finally(() => setBusy(current => current === 'SUMMARY' ? null : current));
    return () => controller.abort();
  }, [open, ids, filter]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.body.classList.add('bulk-attachments-modal-open');
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.classList.remove('bulk-attachments-modal-open'); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);

  async function archive(action: 'DOWNLOAD' | 'SHARE') {
    setBusy(action); setError(''); setNotice('');
    try {
      const response = await fetch('/api/expenses/attachments/archive', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids, filter, action})
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? 'Operazione non riuscita');
      }
      const blob = await response.blob();
      const filename = `allegati-spese-${new Date().toISOString().slice(0, 10)}.zip`;
      const file = new File([blob], filename, {type: 'application/zip'});
      if (action === 'SHARE' && navigator.share && (!navigator.canShare || navigator.canShare({files: [file]}))) {
        await navigator.share({title: 'Allegati spese', text: 'Allegati delle spese selezionate', files: [file]});
        setNotice('Archivio condiviso.');
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice(action === 'SHARE' ? 'Condivisione non disponibile: archivio scaricato.' : 'Download avviato.');
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Operazione non riuscita');
    } finally { setBusy(null); }
  }

  async function sendEmail() {
    if (!email.trim()) { setError('Inserisci l’indirizzo email del destinatario.'); return; }
    setBusy('EMAIL'); setError(''); setNotice('');
    try {
      const response = await fetch('/api/expenses/attachments/archive', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ids, filter, action: 'EMAIL', email: email.trim()})
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? 'Invio email non riuscito');
      setNotice(`Email inviata a ${email.trim()}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invio email non riuscito'); }
    finally { setBusy(null); }
  }

  const available = Boolean(summary?.attachmentCount) && !busy;
  const modal = open ? createPortal(
    <div className="app-form-modal-backdrop bulk-attachments-modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}>
      <section className="app-form-modal bulk-attachments-modal" role="dialog" aria-modal="true" aria-labelledby={`${formId}-attachments-title`}>
        <div className="modal-title bulk-attachments-modal-header">
          <div><h2 id={`${formId}-attachments-title`}>Scarica allegati</h2><p className="muted">Scegli quali documenti includere per le {ids.length} spese selezionate.</p></div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setOpen(false)} aria-label="Chiudi">×</button>
        </div>

        <div className="btn-group bulk-attachment-filter-group" role="group" aria-label="Tipo allegati">
          {filters.map(option => <button type="button" className={filter === option.value ? 'is-selected' : ''} aria-pressed={filter === option.value} key={option.value} onClick={() => {setFilter(option.value);setNotice('');}}><span aria-hidden="true">{option.icon}</span>{option.label}</button>)}
        </div>

        <div className="bulk-attachments-summary" aria-live="polite">
          {busy === 'SUMMARY' ? <p>Verifica degli allegati…</p> : summary ? <>
            <div><span>Spese selezionate</span><strong>{summary.selectedExpenses}</strong></div>
            <div><span>Spese con allegati</span><strong>{summary.matchedExpenses}</strong></div>
            <div><span>Documenti</span><strong>{summary.attachmentCount}</strong></div>
            <div><span>Dimensione</span><strong>{summary.totalBytes ? formatBytes(summary.totalBytes) : '—'}</strong></div>
          </> : null}
        </div>

        <label className="app-form-field bulk-attachments-email-field">
          <span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">@</span>Destinatario email</span>
          <input type="email" value={email} onChange={event => setEmail(event.currentTarget.value)} placeholder="nome@azienda.it" autoComplete="email"/>
        </label>

        {error ? <p className="inline-warning bulk-attachments-feedback" role="alert">{error}</p> : null}
        {notice ? <p className="inline-success bulk-attachments-feedback" role="status">{notice}</p> : null}
        {!busy && summary && !summary.attachmentCount ? <p className="inline-warning bulk-attachments-feedback">Nessun allegato del tipo selezionato.</p> : null}

        <div className="actions-row form-actions-row bulk-attachments-actions">
            <button className="btn btn-md btn-default btn-cancel" type="button" disabled={Boolean(busy)} onClick={() => setOpen(false)}>× Annulla</button>
            <button className="btn btn-md btn-default" type="button" disabled={!available || !email.trim()} onClick={sendEmail}><span className="btn-icon">✉</span>{busy === 'EMAIL' ? 'Invio…' : 'Invia mail'}</button>
            <button className="btn btn-md btn-default" type="button" disabled={!available} onClick={() => archive('SHARE')}><span className="btn-icon">↗</span>{busy === 'SHARE' ? 'Preparazione…' : 'Condividi'}</button>
            <button className="btn btn-md btn-primary" type="button" disabled={!available} onClick={() => archive('DOWNLOAD')}><span className="btn-icon">⇩</span>{busy === 'DOWNLOAD' ? 'Preparazione…' : 'Scarica'}</button>
        </div>
      </section>
    </div>, document.body
  ) : null;

  return <>
    <button className="btn btn-sm btn-default" type="button" onClick={showModal} data-bulk-download-attachments>
      <span className="btn-icon">📎</span><span className="bulk-label">Scarica allegati</span>
    </button>
    {modal}
  </>;
}
