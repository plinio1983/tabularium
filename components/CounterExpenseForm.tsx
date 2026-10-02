"use client";

import {Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {DateField, FormField, SelectField} from './FormControls';
import {CurrencyInput} from './CurrencyInput';
import MobileFormStickyActions from './MobileFormStickyActions';
import {useCompanyTimeZone} from './CompanyTimeZoneProvider';
import {dateInputInTimeZone, zonedMidnightUtc} from '@/lib/company-time';
import {applyCurrencyInputKeyWithState, formatCurrencyInput, currencyInputToNumber} from '@/lib/currency-input';

type Option = {id: number; name: string; code?: string; icon?: string | null; systemRole?: string | null; isFallback?: boolean | null; kind?: string; isPrimary?: boolean; isExpenseDefault?: boolean; cashRegisterDefaultBankId?: number | null};
type Payment = {id?: number; amount?: string | number | {toString(): string} | null; paymentDate?: string | Date | null; paymentMethodId?: number | null; bankId?: number | null};
type InitialExpense = {id?: number; counterSnapshot?: string; amount?: string | number | null; receivedDate?: string | Date | null; categoryId?: number | null; description?: string | null; isDeclared?: boolean; vatRate?: string | number | null; payments?: Payment[]};
type Props = {
  categories: Option[]; banks: Option[]; paymentMethods: Option[];
  initialExpense?: InitialExpense; initialDate?: string; mobileStepOffset?: number;
  hideMobileActions?: boolean; onBackToType?: () => void; onCancel?: () => void;
  onSubmitData?: (data: FormData) => void; submitLabel?: string; lockPayment?: boolean;
  onSaved?: () => void; cancelHref?: string; typeChoice?: ReactNode;
};

export default function CounterExpenseForm({categories, banks, paymentMethods, initialExpense, initialDate, mobileStepOffset = 0, hideMobileActions, onBackToType, onCancel, onSaved, onSubmitData, submitLabel, lockPayment, cancelHref = '/expenses', typeChoice}: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timeZone = useCompanyTimeZone();
  const asDate = (value?: string | Date | null) => value ? dateInputInTimeZone(timeZone, new Date(value)) : initialDate ?? dateInputInTimeZone(timeZone);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(asDate(lockPayment ? initialExpense?.payments?.[0]?.paymentDate : initialExpense?.receivedDate));
  const [category, setCategory] = useState(String(initialExpense?.categoryId ?? categories.find(item => item.code === 'DEFAULT')?.id ?? categories[0]?.id ?? ''));
  const [amount, setAmount] = useState(formatCurrencyInput(initialExpense?.amount));
  const keyState = useRef<{separatorDigits: 0 | 1 | null}>({separatorDigits: null});
  const [fiscal, setFiscal] = useState(initialExpense?.isDeclared ?? true);
  const [vat, setVat] = useState(initialExpense?.isDeclared ? Number(initialExpense.vatRate ?? 22) : 22);
  const [description, setDescription] = useState(initialExpense?.description ?? '');
  const methods = paymentMethods.filter(method => !method.kind || ['EXPENSE', 'BOTH'].includes(method.kind));
  const availableBanks = banks.filter(bank => !bank.isFallback);
  const cashBank = banks.find(bank => bank.name.toLocaleLowerCase('it-IT') === 'cassa') ?? banks.find(bank => bank.isFallback);
  const isCash = (methodId: string) => methods.find(method => String(method.id) === methodId)?.systemRole === 'CASH';
  function defaultBank(methodId: string) {
    if (isCash(methodId)) return String(cashBank?.id ?? '');
    const configured = methods.find(method => String(method.id) === methodId)?.cashRegisterDefaultBankId;
    return String(availableBanks.find(bank => bank.id === configured)?.id ?? availableBanks.find(bank => bank.isPrimary)?.id ?? '');
  }
  const defaultMethod = String((methods.find(method => method.isExpenseDefault) ?? methods[0])?.id ?? '');
  const [payments, setPayments] = useState(() => (initialExpense?.payments?.length ? initialExpense.payments : [{}]).map(payment => ({
    id: payment.id, amount: String(payment.amount ?? ''), date: asDate(payment.paymentDate), method: String(payment.paymentMethodId ?? defaultMethod), bank: payment.bankId ? String(payment.bankId) : defaultBank(String(payment.paymentMethodId ?? defaultMethod))
  })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const requestId = useRef<string | null>(null);
  const numericAmount = currencyInputToNumber(amount);
  const displayedStep = step + mobileStepOffset;
  const totalSteps = 2 + mobileStepOffset;
  const updatePayment = (index: number, changes: Partial<typeof payments[number]>) => setPayments(rows => rows.map((row, i) => i === index ? {...row, ...changes} : row));
  function validFirstStep() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || numericAmount <= 0 || numericAmount > 999999999.99) {
      setError('Inserisci data e un importo valido.');
      return false;
    }
    setError('');
    return true;
  }
  function next() { if (validFirstStep()) setStep(2); }
  function back() { setError(''); if (step === 1) onBackToType?.(); else setStep(1); }
  function key(value: string) { setAmount(current => applyCurrencyInputKeyWithState(current, value, keyState.current)); }
  useEffect(() => {
    function physicalKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || busy || hideMobileActions || step !== 1) return;
      if (!window.matchMedia('(max-width: 900px)').matches || !formRef.current?.getClientRects().length) return;
      const target = event.target;
      // CurrencyInput handles its own keys; leave dates and other editable fields alone.
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (target instanceof Element && target.closest('[role="dialog"]') && !target.closest('[role="dialog"]')?.contains(formRef.current)) return;
      const value = event.key === 'Backspace' || event.key === 'Delete' ? 'backspace' : event.key;
      if (!/^[0-9,.]$/.test(value) && value !== 'backspace') return;
      event.preventDefault();
      key(value);
    }
    window.addEventListener('keydown', physicalKey);
    return () => window.removeEventListener('keydown', physicalKey);
  }, [step, busy, hideMobileActions]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    if (window.matchMedia('(max-width: 900px)').matches && step === 1) { next(); return; }
    if (!validFirstStep()) { setStep(1); return; }
    if (!category) { setError('Seleziona la categoria.'); setStep(2); return; }
    if (payments.some(row => !/^\d{4}-\d{2}-\d{2}$/.test(row.date))) { setError('Inserisci una data valida per ogni pagamento.'); return; }
    const rows = payments.map(row => ({
      id: row.id, amount: payments.length === 1 ? numericAmount : Number(row.amount.replace(',', '.')),
      paymentDate: zonedMidnightUtc(row.date, timeZone).toISOString(),
      paymentMethodId: Number(row.method), bankId: methods.find(method => method.id === Number(row.method))?.systemRole === 'CASH' ? null : Number(row.bank) || null
    }));
    if (rows.some(row => !row.paymentMethodId || !Number.isFinite(row.amount) || row.amount <= 0 || (methods.find(method => method.id === row.paymentMethodId)?.systemRole !== 'CASH' && !row.bankId))) {
      setError('Completa importo, metodo e banca dei pagamenti.'); return;
    }
    if (Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) !== Math.round(numericAmount * 100)) {
      setError('Il totale dei pagamenti deve corrispondere all’importo della spesa.'); return;
    }
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (onSubmitData) {
        const data = new FormData();
        Object.entries({amount: numericAmount, isDeclared: fiscal, vatRate: fiscal ? vat : 0,
          paymentDate: rows[0].paymentDate, paymentMethodId: rows[0].paymentMethodId, bankId: rows[0].bankId ?? '',
          categoryId: category, description}).forEach(([key, value]) => data.set(key, String(value)));
        onSubmitData(data);
        return;
      }
      requestId.current ??= crypto.randomUUID();
      const base = {amount: numericAmount, isDeductible: fiscal, vatRate: fiscal ? vat : 0, paymentDate: zonedMidnightUtc(date, timeZone).toISOString(), categoryId: Number(category), description};
      const response = await fetch('/api/counter-expenses', {
        method: initialExpense?.id ? 'PATCH' : 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(initialExpense?.id ? {...base, id: initialExpense.id, snapshot: initialExpense.counterSnapshot, payments: rows} : {...base, paymentMethodId: rows[0].paymentMethodId, bankId: rows[0].bankId, requestId: requestId.current})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Salvataggio non riuscito.');
      if (onSaved) onSaved(); else { router.push(cancelHref); router.refresh(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Salvataggio non riuscito.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function amountControl() {
    return <label className="expense-wizard-amount-field">
      <div className="app-form-field-label switch-toggle-field-label"><span className="app-form-field-icon">€</span><span>Costo IVA inclusa</span></div>
      <div className="money-input"><span>€</span><CurrencyInput aria-label="Importo spesa" disabled={busy} value={amount} onValueChange={setAmount} clearable suppressSoftKeyboard onClear={() => {keyState.current.separatorDigits = null;}}/></div>
    </label>;
  }
  function vatButtons(className: string) {
    return <div className={`app-vat-rate-buttons ${className}`} role="group" aria-label="Aliquota IVA">
      {className === 'vat-buttons-mobile' ? <label>Aliquota IVA</label> : null}
      {[0,4,10,22].map(rate => <button type="button" key={rate} disabled={busy || !fiscal} aria-pressed={(fiscal ? vat : 0) === rate} className={(fiscal ? vat : 0) === rate ? 'is-selected' : ''} onMouseDown={event => event.preventDefault()} onClick={() => setVat(rate)}>{rate}%</button>)}
    </div>;
  }
  return <form ref={formRef} className={`form app-record-form single-expense-form counter-expense-form app-form-wizard app-form-wizard-current-${step}`} onSubmit={save} noValidate>
    <div className="app-form-wizard-header full">
      <div className="app-form-wizard-heading"><span>Passaggio {displayedStep} di {totalSteps}</span><strong><span>{step === 1 ? 'Dati della spesa' : 'Dettagli e pagamento'}</span></strong></div>
      <div className="app-form-wizard-progress" aria-label={`Passaggio ${displayedStep} di ${totalSteps}`}><span style={{width: `${displayedStep / totalSteps * 100}%`}}/></div>
    </div>
    {typeChoice ? <div className="full hidden-md-down">{typeChoice}</div> : null}
    <details className="form-section full app-form-wizard-split-section app-form-wizard-step app-form-wizard-step-1" open>
      <summary><span>Dati della spesa</span></summary>
      <div className="form-section-grid">
        <fieldset disabled={lockPayment} style={{border: 0, padding: 0, margin: 0}}><DateField label="Data" name="counterDate" value={date} onChange={value => {setDate(value); if (payments.length === 1) updatePayment(0, {date: value});}} required/></fieldset>
        <SelectField label="Categoria" icon="▦" name="counterCategory" className="hidden-md-down" value={category} onChange={setCategory} disabled={busy} options={categories.map(item => ({value: item.id, label: `${item.icon ?? ''} ${item.name}`}))}/>
        <div className="full hidden-md-up">
          <div className="expense-wizard-amount-entry">
          <label className="app-form-wizard-mobile-switch switch-toggle-field expense-fiscal-mobile-control">
            <div className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">⇆</span><span>Fiscale</span></div>
            <span className="switch"><input type="checkbox" aria-label="Spesa fiscale" disabled={busy} checked={fiscal} onChange={event => setFiscal(event.target.checked)}/><span className="slider"/></span>
          </label>
            <div className="expense-amount-control">
              <div className="expense-amount-vat-excluded" aria-live="polite"><strong>{new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR'}).format(fiscal ? numericAmount / (1 + vat / 100) : numericAmount)}</strong></div>
              {amountControl()}
            </div>
          </div>
          {vatButtons('vat-buttons-mobile')}
          <div className="app-amount-keypad full" aria-label="Tastiera numerica">
            {['1','2','3','4','5','6','7','8','9',',','0','backspace'].map(value => <button type="button" key={value} disabled={busy} onMouseDown={event => event.preventDefault()} onClick={() => key(value)} aria-label={value === 'backspace' ? 'Cancella ultima cifra' : value}>{value === 'backspace' ? <span className="btn-icon">⌫</span> : value}</button>)}
          </div>
        </div>
      </div>
    </details>
    <details className="form-section full hidden-md-down" open>
      <summary><span>Importo e IVA</span></summary>
      <div className="form-section-grid">
        <div className="amount-vat-row full">
          <div className="expense-wizard-amount-entry">
            <div className="switch-toggle-field expense-fiscal-desktop-control">
              <div className="switch-toggle-field-label app-form-field-label"><span className="app-form-field-icon">⇆</span><span>Fiscale</span></div>
              <label className="switch"><input type="checkbox" aria-label="Spesa fiscale" disabled={busy} checked={fiscal} onChange={event => setFiscal(event.target.checked)}/><span className="slider"/><span className="text-muted">{fiscal ? 'Fiscale' : 'Non fiscale'}</span></label>
            </div>
            <div className="expense-amount-control">
              <div className="expense-amount-vat-excluded" aria-live="polite"><strong>{new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR'}).format(fiscal ? numericAmount / (1 + vat / 100) : numericAmount)}</strong></div>
              {amountControl()}
              {vatButtons('vat-buttons-desktop')}
            </div>
          </div>
        </div>
      </div>
    </details>
    <details className="form-section full app-form-wizard-split-section app-form-wizard-step app-form-wizard-step-2" open>
      <summary><span>Descrizione e pagamento</span></summary>
      <div className="form-section-grid">
        <SelectField label="Categoria" icon="▦" name="counterCategoryMobile" className="full hidden-md-up" value={category} onChange={setCategory} disabled={busy} options={categories.map(item => ({value: item.id, label: `${item.icon ?? ''} ${item.name}`}))}/>
        {payments.map((row, index) => <Fragment key={row.id ?? index}>
            {payments.length > 1 ? <><FormField label={`Importo pagamento ${index + 1}`} icon="€"><div className="money-input"><span>€</span><CurrencyInput disabled={busy} clearable value={row.amount} onValueChange={value => updatePayment(index, {amount: value})}/></div></FormField><DateField label="Data pagamento" name={`counterPaymentDate${index}`} value={row.date} onChange={value => updatePayment(index, {date: value})}/></> : null}
            <SelectField label="Modalità di pagamento" icon="▣" name={`counterMethod${index}`} value={row.method} disabled={busy || lockPayment} onChange={value => updatePayment(index, {method: value, bank: defaultBank(value)})} options={[{value: '', label: 'Seleziona modalità'}, ...methods.map(method => ({value: method.id, label: `${method.icon ?? ''} ${method.name}`}))]}/>
            <SelectField label="Canale di addebito" icon="▥" name={`counterBank${index}`} value={isCash(row.method) ? String(cashBank?.id ?? '') : row.bank} disabled={busy || lockPayment || isCash(row.method) || !row.method} onChange={value => updatePayment(index, {bank: value})} options={[{value: '', label: isCash(row.method) ? 'Cassa' : 'Seleziona conto'}, ...(isCash(row.method) ? cashBank ? [cashBank] : [] : availableBanks).map(bank => ({value: bank.id, label: `${bank.icon ?? ''} ${bank.name}`}))]}/>
        </Fragment>)}
        <FormField label="Descrizione (opzionale)" icon="≡" className="full" htmlFor="counter-description"><input id="counter-description" disabled={busy} value={description} placeholder="Spesa da banco" maxLength={initialExpense?.id ? 2000 : 200} onChange={event => setDescription(event.target.value)}/></FormField>
      </div>
    </details>
    {error ? <p className="text-critical full" role="alert">{error}</p> : null}
    <div className="actions-row full form-actions-row form-sticky-actions hidden-md-down">
      {onCancel ? <button className="btn btn-md btn-default" type="button" disabled={busy} onClick={onCancel}><span className="btn-icon">×</span>Annulla</button> : <a className="btn btn-md btn-ghost" href={cancelHref}><span className="btn-icon">↩</span>Indietro</a>}
      <button className="btn btn-md btn-primary" disabled={busy} type="submit"><span className="btn-icon">✓</span>{busy ? 'Salvataggio…' : submitLabel ?? (initialExpense?.id ? 'Salva modifiche' : 'Paga')}</button>
    </div>
    {!hideMobileActions ? <MobileFormStickyActions currentStep={displayedStep} submitStep={totalSteps} onBack={back} onNext={next} onCancel={onCancel} cancelHref={cancelHref} isSubmitting={busy} submitLabel={submitLabel ?? (initialExpense?.id ? 'Salva modifiche' : 'Paga')}/> : null}
  </form>;
}
