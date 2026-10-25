"use client";
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {DateField} from '@/components/FormControls';
import {CurrencyInput} from '@/components/CurrencyInput';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {dateInputInTimeZone} from '@/lib/company-time';
import {allocateBulkPayment, paymentCents, type bulkPaymentRows} from '@/lib/expense-bulk-payment';
type Option = {id: number; name: string; icon?: string | null; isFallback?: boolean | null; systemRole?: string | null};
type Rows = ReturnType<typeof bulkPaymentRows>;
const money = (cents: number) => (cents / 100).toLocaleString('it-IT', {style: 'currency', currency: 'EUR'});
export default function BulkExpensePaymentModal({ids, banks, methods, onClose, onSaved}: {ids: number[]; banks: Option[]; methods: Option[]; onClose: () => void; onSaved: () => void}) {
  const timeZone = useCompanyTimeZone();
  const [rows, setRows] = useState<Rows | null>(null);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [paymentDate, setPaymentDate] = useState(() => dateInputInTimeZone(timeZone));
  const [methodId, setMethodId] = useState('');
  const [bankId, setBankId] = useState('');
  const lock = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const content = dialog.current?.querySelector<HTMLElement>('.bulk-payment-content');
    if (content) content.scrollTop = 0;
    if (mobile) dialog.current?.querySelector<HTMLElement>('#bulk-payment-title')?.focus();
  }, [step, mobile]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/expenses/bulk-payment?${new URLSearchParams(ids.map(id => ['ids', String(id)]))}`, {cache: 'no-store', signal: controller.signal})
      .then(async response => {const data = await response.json(); if (!response.ok) throw new Error(data.error); setRows(data.rows); setAmount((data.rows.reduce((sum: number, row: Rows[number]) => sum + row.residualCents, 0) / 100).toFixed(2));})
      .catch(err => {if (err.name !== 'AbortError') setError(err.message);});
    return () => controller.abort();
  }, [ids]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add('bulk-attachments-modal-open');
    dialog.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {document.body.classList.remove('bulk-attachments-modal-open'); previous?.focus();};
  }, []);
  const total = rows?.reduce((sum, row) => sum + row.residualCents, 0) ?? 0;
  let allocation: ReturnType<typeof allocateBulkPayment> = [];
  let validation = '';
  if (rows) {try {allocation = allocateBulkPayment(rows, paymentCents(amount));} catch (err) {validation = (err as Error).message;}}
  const summaryRows = (allocation.length ? allocation : (rows ?? []).map(row => ({...row, allocatedCents: 0}))).map(row => {
    const balance = row.residualCents - row.allocatedCents;
    const status = row.residualCents === 0 ? {label: 'Già saldata', tone: 'tone-muted'}
      : !row.allocatedCents ? {label: 'Invariata', tone: 'tone-waiting'}
      : balance === 0 ? {label: 'Saldata', tone: 'tone-paid'} : {label: 'Copertura parziale', tone: 'tone-partial'};
    return {...row, balance, status};
  });
  const allocatedTotal = summaryRows.reduce((sum, row) => sum + row.allocatedCents, 0);
  const vat = rows?.[0]?.expenseType === 'VAT_SETTLEMENT';
  const allowedMethods = methods.filter(m => !vat || (m.systemRole !== 'CASH' && m.name.trim().toLowerCase() !== 'cash'));
  const cashMethod = methods.find(method => String(method.id) === methodId);
  const cash = cashMethod?.systemRole === 'CASH' || cashMethod?.name.trim().toLowerCase() === 'cash';
  const cashBank = banks.find(bank => bank.name.toLowerCase() === 'cassa') ?? banks.find(bank => bank.isFallback) ?? banks[0];
  const effectiveBankId = cash && cashBank ? String(cashBank.id) : bankId;
  return createPortal(<div className="app-form-modal-backdrop bulk-category-modal-backdrop" role="presentation" onMouseDown={e => {if (e.target === e.currentTarget && !lock.current) onClose();}}>
    <div ref={dialog} className="bulk-category-modal bulk-edit-fields-modal bulk-expense-payment-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-payment-title" onKeyDown={e => {
      if (e.key === 'Escape' && !lock.current) onClose();
      if (e.key === 'Tab') {
        const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), [tabindex="0"]') ?? []);
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {e.preventDefault(); last?.focus();}
        else if (!e.shiftKey && document.activeElement === last) {e.preventDefault(); first?.focus();}
      }
    }}>
      <div className="modal-toolbar-card toolbar-card">
        <div className="bulk-edit-toolbar-copy"><span className="bulk-edit-toolbar-kicker">{mobile ? `Pagamento multiplo · ${step} di 2` : 'Pagamento multiplo'}</span><h2 id="bulk-payment-title" tabIndex={-1}>{mobile && step === 2 ? 'Ripartizione del pagamento' : 'Inserisci pagamento'}</h2><p className="muted"><strong>{ids.length}</strong> record selezionati</p></div>
        <button type="button" className="btn btn-neutral btn-icon-only modal-close-button bulk-edit-close-button" disabled={saving} onClick={onClose} aria-label="Chiudi"><span className="btn-icon" aria-hidden="true">×</span></button>
      </div>
      <div className="bulk-edit-step bulk-edit-step-forward">
      {!rows && <div className="bulk-edit-form"><div className="bulk-edit-accounting-content">{error ? <p className="inline-warning" role="alert">{error}</p> : <p className="muted" role="status">Caricamento spese…</p>}</div><div className="bulk-edit-actions"><button type="button" className="btn btn-md btn-default" onClick={onClose}>Annulla</button></div></div>}
      {rows && <form className="bulk-edit-form" onSubmit={async e => {
        e.preventDefault(); if (lock.current || validation || !paymentDate || !methodId) return;
        if (mobile && step === 1) {setStep(2); return;}
        lock.current = true; setSaving(true); setError('');
        try {
          const response = await fetch('/api/expenses/bulk-payment', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids, preview: rows, amount: Number(amount), paymentDate, paymentMethodId: Number(methodId), bankId: effectiveBankId ? Number(effectiveBankId) : null})});
          const data = await response.json(); if (!response.ok) throw new Error(data.error);
          onSaved();
        } catch (err) {setError((err as Error).message);} finally {lock.current = false; setSaving(false);}
      }}>
        <div className="bulk-edit-accounting-content app-record-form app-form-wizard bulk-payment-content">
        {error && <p className="inline-warning" role="alert">{error}</p>}
        {(!mobile || step === 1) && <>
        <div className="form-summary full"><div><span className="muted">Residuo totale</span><strong className={total > 0 ? 'text-critical' : 'text-ok'}>{money(total)}</strong></div><div><span className="muted">Pagamento</span><strong>{money(paymentCents(amount))}</strong></div></div>
        <div className="payment-row">
          <DateField className="payment-date-field" label="Data pagamento" name="paymentDate" required value={paymentDate} onChange={value => {if (!saving) setPaymentDate(value);}}/>
          <label className="payment-amount-field">
            <div className="switch-toggle-field-label app-form-field-label"><span className="app-form-field-icon">€</span><span>Importo pagamento</span></div>
            <div className="money-input"><span>€</span><CurrencyInput clearable required disabled={saving} value={amount} onValueChange={value => setAmount(value.replace(',', '.'))}/></div>
            <span className="payment-amount-shortcuts" aria-label="Impostazione rapida importo pagamento">{[25, 50, 75, 100].map(percentage => {
              const suggested = Math.round(total * percentage / 100);
              const selected = suggested > 0 && paymentCents(amount) === suggested;
              return <button key={percentage} type="button" disabled={saving} className={selected ? 'is-selected' : ''} aria-pressed={selected} onClick={() => setAmount((suggested / 100).toFixed(2))}>{percentage}%</button>;
            })}</span>
          </label>
          <label className="payment-select-field"><span className="payment-select-label"><i aria-hidden="true">▣</i> Canale pagamento</span><div className="payment-select-control"><select required disabled={saving} value={methodId} onChange={event => setMethodId(event.target.value)}><option value="">Seleziona metodo</option>{allowedMethods.map(method => <option key={method.id} value={method.id}>{method.icon ?? '•'} {method.name}</option>)}</select><span className="payment-select-caret" aria-hidden="true">⌄</span></div></label>
          <label className="payment-select-field"><span className="payment-select-label"><i aria-hidden="true">▥</i> Banca pagamento</span><div className="payment-select-control"><select disabled={saving || !!(cash && cashBank)} value={effectiveBankId} onChange={event => setBankId(event.target.value)}><option value="">-</option>{banks.map(bank => <option key={bank.id} value={bank.id}>{bank.icon ?? '•'} {bank.name}</option>)}</select><span className="payment-select-caret" aria-hidden="true">⌄</span></div></label>
        </div>
        </>}
        {(!mobile || step === 2) && <p className="muted">Copertura dalla scadenza più vecchia, poi data della spesa e ID. Le spese già saldate vengono saltate.</p>}
        {validation && <p className="inline-warning" role="alert">{validation}</p>}
        {(!mobile || step === 2) && <section className="bulk-payment-summary" aria-labelledby="bulk-payment-summary-title">
          <div className="bulk-payment-summary-heading">
            <div><span className="record-review-kicker">Anteprima</span><h3 id="bulk-payment-summary-title">Ripartizione del pagamento</h3><p>Il saldo si aggiorna mentre modifichi l’importo.</p></div>
            <div className="bulk-payment-summary-total"><span>Totale assegnato</span><strong>{money(allocatedTotal)}</strong></div>
          </div>
          {mobile ? <div className="bulk-payment-summary-cards">
            {summaryRows.map(row => <article className={`bulk-payment-summary-card${row.allocatedCents > 0 ? ' is-allocated' : ''}`} key={row.id} aria-label={`Spesa ${row.id}`}>
              <div className="bulk-payment-card-heading"><div><span className="bulk-payment-expense-id">Spesa #{row.id}</span><h4>{row.merchant || 'Spesa'}</h4></div><span className={`badge color-badge ${row.status.tone}`}>{row.status.label}</span></div>
              <dl className="bulk-payment-card-amounts">
                <div><dt>Residuo iniziale</dt><dd>{money(row.residualCents)}</dd></div>
                <div><dt>Quota pagamento</dt><dd className={row.allocatedCents > 0 ? 'bulk-payment-allocated' : 'muted'}>{money(row.allocatedCents)}</dd></div>
                <div className="bulk-payment-card-balance"><dt>Saldo finale</dt><dd className={row.balance === 0 ? 'text-ok' : ''}>{money(row.balance)}</dd></div>
              </dl>
            </article>)}
            <div className="bulk-payment-summary-card bulk-payment-summary-totals"><h4>Totali</h4><dl className="bulk-payment-card-amounts">
              <div><dt>Residuo iniziale</dt><dd>{money(total)}</dd></div>
              <div><dt>Pagamento assegnato</dt><dd className="bulk-payment-allocated">{money(allocatedTotal)}</dd></div>
              <div className="bulk-payment-card-balance"><dt>Saldo finale</dt><dd>{money(total - allocatedTotal)}</dd></div>
            </dl></div>
          </div> :
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Saldo delle spese selezionate">
            <table className="bulk-payment-summary-table">
              <thead><tr><th scope="col">Spesa</th><th scope="col">Residuo iniziale</th><th scope="col">Quota pagamento</th><th scope="col">Saldo finale</th><th scope="col">Esito</th></tr></thead>
              <tbody>{summaryRows.map(({balance, status, ...row}) => {
                return <tr key={row.id} className={row.allocatedCents > 0 ? 'is-allocated' : ''}>
                  <th scope="row"><span className="bulk-payment-expense-id">#{row.id}</span><strong>{row.merchant || 'Spesa'}</strong></th>
                  <td>{money(row.residualCents)}</td>
                  <td className={row.allocatedCents > 0 ? 'bulk-payment-allocated' : 'muted'}>{money(row.allocatedCents)}</td>
                  <td className={balance === 0 ? 'text-ok' : ''}><strong>{money(balance)}</strong></td>
                  <td><span className={`badge color-badge ${status.tone}`}>{status.label}</span></td>
                </tr>;
              })}</tbody>
              <tfoot><tr><th scope="row">Totale</th><td>{money(total)}</td><td>{money(allocatedTotal)}</td><td>{money(total - allocatedTotal)}</td><td/></tr></tfoot>
            </table>
          </div>}
        </section>}
        </div>
        <div className="bulk-edit-actions">
          {mobile && step === 2 ? <button type="button" className="btn btn-md btn-ghost" disabled={saving} onClick={() => setStep(1)}><span className="btn-icon" aria-hidden="true">‹</span> Indietro</button> : <button type="button" className="btn btn-md btn-default" disabled={saving} onClick={onClose}>Annulla</button>}
          <button key={mobile && step === 1 ? 'next' : 'save'} className="btn btn-md btn-primary" type="submit" disabled={saving || !!validation || !paymentDate || !methodId}><span className="btn-icon" aria-hidden="true">{mobile && step === 1 ? '›' : '✓'}</span> {saving ? 'Salvataggio…' : mobile && step === 1 ? 'Avanti' : 'Salva pagamento'}</button>
        </div>
      </form>}
      </div>
    </div>
  </div>, document.body);
}
