'use client';

import {useState} from 'react';
import Link from 'next/link';
import type {ReceiptPreview} from '@/lib/receipt-import';

const labels = {new: 'Nuovo', duplicate: 'Duplicato', conflict: 'Conflitto', invalid: 'Errore'};
export default function ReceiptCsvImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{imported: number; duplicates: number} | null>(null);
  async function send(mode: 'preview' | 'commit') {
    if (!file || busy) return;
    setBusy(true); setError(''); setResult(null);
    const form = new FormData(); form.set('file', file); form.set('mode', mode);
    if (mode === 'commit' && preview) form.set('token', preview.token);
    try {
      const response = await fetch('/api/cash-register/receipts/import', {method: 'POST', body: form});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Importazione non completata.');
      if (mode === 'preview') setPreview(data);
      else {setResult(data); setPreview(null);}
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Importazione non completata.'); setPreview(null);}
    finally {setBusy(false);}
  }
  return <div className="grid">
    <section className="card" style={{padding: 20}}>
      <h3>Importa scontrini da CSV</h3>
      <p>Carica il file esportato dalla lista Scontrini oppure compila il modello. Limite: 1.000 scontrini, 5 MB, UTF-8, separatore punto e virgola.</p>
      <p>Data e ora devono includere il fuso orario. Usa i nomi configurati per metodo e banca e un identificativo origine diverso per ogni vendita. Mantieni lo stesso identificativo nelle importazioni successive.</p>
      <p>Le righe già presenti vengono ignorate. Errori e identificativi con dati diversi bloccano il salvataggio dell’intero file.</p>
      <div className="actions-row"><a className="btn btn-sm btn-default" href="/api/cash-register/receipts/import" download>Scarica modello CSV</a><Link className="btn btn-sm btn-default" href="/incomes/cash-register/receipts">Vai agli scontrini</Link></div>
      <form onSubmit={event => {event.preventDefault(); void send('preview');}}>
        <label className="import-file-drop"><strong>File CSV scontrini</strong><input aria-label="File CSV scontrini" type="file" accept=".csv,text/csv" required disabled={busy} onChange={event => {setFile(event.target.files?.[0] ?? null); setPreview(null); setResult(null); setError('');}}/></label>
        <button className="btn btn-md btn-primary" disabled={!file || busy} type="submit">{busy ? 'Elaborazione…' : 'Analizza file'}</button>
      </form>
      {error ? <p role="alert" className="inline-form-error">{error}</p> : null}
      {result ? <p role="status">Importazione completata: {result.imported} scontrini creati, {result.duplicates} duplicati ignorati.</p> : null}
    </section>
    {preview ? <section className="card" style={{padding: 20}}>
      <h3>Anteprima importazione</h3>
      <p role="status">Nuovi: {preview.counts.new} · Duplicati: {preview.counts.duplicate} · Conflitti: {preview.counts.conflict} · Errori: {preview.counts.invalid}</p>
      <div className="table-scroll"><table><thead><tr><th>Riga</th><th>Origine</th><th>Descrizione</th><th>Importo</th><th>Esito</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.line}><td>{row.line}</td><td>{row.origin}</td><td>{row.description}</td><td>{row.amount.replace('.', ',')}</td><td><strong>{labels[row.status]}</strong> — {row.message}</td></tr>)}</tbody></table></div>
      <button className="btn btn-md btn-primary" type="button" disabled={busy || !preview.counts.new || !!preview.counts.invalid || !!preview.counts.conflict} onClick={() => void send('commit')}>{busy ? 'Importazione…' : `Conferma importazione di ${preview.counts.new} scontrini`}</button>
    </section> : null}
  </div>;
}
