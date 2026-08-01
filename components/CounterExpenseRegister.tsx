"use client";

import {useEffect, useMemo, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {applyCurrencyInputKeyWithState, formatCurrencyInput} from '@/lib/currency-input';

type Category = {id: number; name: string; icon: string | null};
type Method = {id: number; name: string; icon: string | null; systemRole: string | null};
type Bank = {id: number; name: string; icon: string | null; isPrimary: boolean};

const vatRates = [0, 4, 10, 22];

function euro(value: number) {
  return new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR'}).format(value);
}

export default function CounterExpenseRegister({
  initialDate,
  categories,
  methods,
  banks
}: {
  initialDate: string;
  categories: Category[];
  methods: Method[];
  banks: Bank[];
}) {
  const router = useRouter();
  const amountRef = useRef<HTMLInputElement>(null);
  const amountKeyStateRef = useRef<{separatorDigits: 0 | 1 | null}>({separatorDigits: null});
  const methodRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const bankRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const [paymentDate, setPaymentDate] = useState(initialDate);
  const [categoryId, setCategoryId] = useState(String(categories[0]?.id ?? ''));
  const [isDeductible, setIsDeductible] = useState(false);
  const [vatRate, setVatRate] = useState(0);
  const [lastVatRate, setLastVatRate] = useState(22);
  const [amount, setAmount] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [methodIndex, setMethodIndex] = useState(0);
  const [bankIndex, setBankIndex] = useState(0);
  const [confirmationIndex, setConfirmationIndex] = useState<0 | 1>(1);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{tone: 'ok' | 'error'; text: string} | null>(null);

  const numericAmount = Number(amount.replace(',', '.'));
  const hasValidAmount = Number.isFinite(numericAmount) && numericAmount > 0;
  const formattedAmount = useMemo(() => formatCurrencyInput(amount), [amount]);
  const selectedMethod = methods.find(method => method.id === selectedMethodId) ?? null;
  const isCash = selectedMethod?.systemRole === 'CASH';
  const selectedCategory = categories.find(category => category.id === Number(categoryId)) ?? null;
  const orderedBanks = useMemo(
    () => [...banks].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
    [banks]
  );

  function moveIndex(current: number, direction: 1 | -1, length: number) {
    return length ? (current + direction + length) % length : 0;
  }

  function focusAmount() {
    requestAnimationFrame(() => amountRef.current?.focus({preventScroll: true}));
  }

  function appendKey(key: string) {
    setNotice(null);
    setAmount(current => applyCurrencyInputKeyWithState(current, key, amountKeyStateRef.current));
    focusAmount();
  }

  function toggleDeduction(value: boolean) {
    setIsDeductible(value);
    if (!value) {
      if (vatRate > 0) setLastVatRate(vatRate);
      setVatRate(0);
    } else {
      setVatRate(lastVatRate || 22);
    }
    focusAmount();
  }

  function openPaymentModal() {
    if (!hasValidAmount || !categoryId || !paymentDate) {
      setNotice({tone: 'error', text: 'Inserisci data, categoria e un importo valido.'});
      return;
    }
    setSelectedMethodId(null);
    setMethodIndex(0);
    setBankIndex(0);
    setConfirmationIndex(1);
    setNotice(null);
    setModalOpen(true);
  }

  function closePaymentModal() {
    if (sending) return;
    setModalOpen(false);
    setSelectedMethodId(null);
    focusAmount();
  }

  useEffect(() => {
    focusAmount();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    requestAnimationFrame(() => {
      if (!selectedMethod) {
        methodRefs.current[methodIndex]?.focus({preventScroll: true});
      } else if (!isCash) {
        bankRefs.current[bankIndex]?.focus({preventScroll: true});
      } else {
        (confirmationIndex === 0 ? cancelRef.current : submitRef.current)?.focus({preventScroll: true});
      }
    });
  }, [bankIndex, confirmationIndex, isCash, methodIndex, modalOpen, selectedMethod]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (modalOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closePaymentModal();
          return;
        }
        const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : null;
        if (!selectedMethod) {
          if (direction) {
            event.preventDefault();
            setMethodIndex(current => moveIndex(current, direction, methods.length));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            const method = methods[methodIndex];
            if (method) {
              setSelectedMethodId(method.id);
              setBankIndex(0);
              setConfirmationIndex(1);
            }
          }
          return;
        }
        if (!isCash) {
          if (direction) {
            event.preventDefault();
            setBankIndex(current => moveIndex(current, direction, orderedBanks.length));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            const bank = orderedBanks[bankIndex];
            if (bank) void saveExpense(bank.id);
          }
          return;
        }
        if (direction) {
          event.preventDefault();
          setConfirmationIndex(current => current === 0 ? 1 : 0);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (confirmationIndex === 0) closePaymentModal();
          else void saveExpense(null);
        }
        return;
      }
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        appendKey(event.key);
      } else if (event.key === ',' || event.key === '.') {
        event.preventDefault();
        appendKey(',');
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        appendKey('backspace');
      } else if (event.key === 'Enter' && hasValidAmount) {
        event.preventDefault();
        openPaymentModal();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    amount,
    bankIndex,
    categoryId,
    confirmationIndex,
    hasValidAmount,
    isCash,
    isDeductible,
    methodIndex,
    methods,
    modalOpen,
    orderedBanks,
    paymentDate,
    requestId,
    selectedMethod,
    sending,
    vatRate
  ]);

  async function saveExpense(bankId: number | null) {
    if (!selectedMethod || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const now = new Date();
      const localDate = new Date(`${paymentDate}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`);
      const response = await fetch('/api/counter-expenses', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          amount: numericAmount,
          isDeductible,
          vatRate: isDeductible ? vatRate : 0,
          paymentDate: localDate.toISOString(),
          categoryId: Number(categoryId),
          paymentMethodId: selectedMethod.id,
          bankId,
          requestId
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Registrazione non riuscita');
      setModalOpen(false);
      setSelectedMethodId(null);
      setAmount('');
      setRequestId(crypto.randomUUID());
      setNotice({tone: 'ok', text: `Spesa registrata · ${selectedMethod.icon ?? ''} ${selectedMethod.name}`});
      router.refresh();
      focusAmount();
    } catch (error) {
      setNotice({tone: 'error', text: error instanceof Error ? error.message : 'Registrazione non riuscita'});
    } finally {
      setSending(false);
    }
  }

  return <main className={`cash-register-shell counter-expense-shell ${notice ? 'has-notice' : ''}`}>
    <header className="cash-register-header">
      <div>
        <h1>Spesa da banco</h1>
      </div>
      <div className="cash-register-header-actions">
        <a className="btn btn-circle btn-sm btn-neutral btn-close" href="/expenses" aria-label="Torna alle spese">
          <span className="btn-icon" aria-hidden="true">✕</span>
        </a>
      </div>
    </header>

    <section className="cash-register-controls counter-expense-controls" aria-label="Dati della spesa">
      <label className="cash-register-fiscal-switch">
        <input type="checkbox" checked={isDeductible}
               onChange={event => toggleDeduction(event.currentTarget.checked)}/>
        <span>Detrazione</span>
      </label>
      <input aria-label="Data pagamento" type="date" value={paymentDate}
             onChange={event => setPaymentDate(event.currentTarget.value)}/>
      <select aria-label="Categoria" value={categoryId}
              onChange={event => setCategoryId(event.currentTarget.value)}>
        {categories.map(category =>
          <option value={category.id} key={category.id}>{category.icon ?? ''} {category.name}</option>)}
      </select>
    </section>

    <section className="cash-register-display">
      <span>€</span>
      <input ref={amountRef} aria-label="Importo spesa" value={formattedAmount} readOnly inputMode="none"/>
    </section>

    <section className="cash-register-vat" aria-label="Aliquota IVA">
      {vatRates.map(rate =>
        <button type="button" key={rate}
                disabled={!isDeductible && rate !== 0}
                className={vatRate === rate ? 'is-selected' : ''}
                onClick={() => {
                  if (!isDeductible) return;
                  setVatRate(rate);
                  if (rate > 0) setLastVatRate(rate);
                  focusAmount();
                }}>{rate}%</button>)}
    </section>

    <section className="cash-register-keypad" aria-label="Tastiera numerica">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace'].map(key =>
        <button type="button" key={key} onClick={() => appendKey(key)}
                aria-label={key === 'backspace' ? 'Cancella ultima cifra' : key}>
          {key === 'backspace' ? '⌫' : key}
        </button>)}
    </section>

    {notice ? <div className={`cash-register-notice ${notice.tone === 'error' ? 'is-error' : ''}`} role="status">
      {notice.text}
    </div> : null}

    <section className="cash-register-actions counter-expense-actions">
      <button className="cash-register-submit" type="button" disabled={!hasValidAmount}
              onClick={openPaymentModal}>
        <span aria-hidden="true">💳</span>

              <span>PAGA</span>
              <span>➤</span>
      </button>
    </section>

    {modalOpen ? <div className="cash-register-method-backdrop" role="presentation" onMouseDown={closePaymentModal}>
      <section className="cash-register-method-modal counter-expense-payment-modal" role="dialog" aria-modal="true"
               aria-labelledby="counter-expense-method-title" onMouseDown={event => event.stopPropagation()}>
        <header>
          <h2 id="counter-expense-method-title">
            {selectedMethod ? 'Conferma spesa' : 'Metodo di pagamento'}
          </h2>
          <button type="button" aria-label="Chiudi" disabled={sending} onClick={closePaymentModal}>×</button>
        </header>

        {!selectedMethod ? <div className="counter-expense-choice-list">
          {methods.map((method, index) =>
            <button ref={element => { methodRefs.current[index] = element; }}
                    type="button" key={method.id} disabled={sending}
                    className={methodIndex === index ? 'is-selected' : ''}
                    onFocus={() => setMethodIndex(index)}
                    onClick={() => {
                      setSelectedMethodId(method.id);
                      setBankIndex(0);
                      setConfirmationIndex(1);
                    }}>
              <span>{method.icon ?? '•'}</span>{method.name}
            </button>)}
          <p className="cash-register-keyboard-hint">Usa le frecce per scegliere e premi Invio per selezionare.</p>
        </div> : <>
          <div className="counter-expense-summary">
            <div className="record-review-heading">
              <div>
                <span className="record-review-kicker">Controlla prima di salvare</span>
                <h3>Riepilogo della spesa</h3>
              </div>
              <strong>{euro(numericAmount)}</strong>
            </div>
            <div className="record-review-grid">
              <div className="record-review-item">
                <i aria-hidden="true">◷</i>
                <span>Data pagamento<strong>{new Intl.DateTimeFormat('it-IT').format(new Date(`${paymentDate}T12:00:00`))}</strong></span>
              </div>
              <div className="record-review-item">
                <i aria-hidden="true">%</i>
                <span>Fiscale / IVA<strong>{isDeductible ? `Sì · ${vatRate}%` : 'No · 0%'}</strong></span>
              </div>
              <div className="record-review-item wide">
                <i aria-hidden="true">◇</i>
                <span>Categoria<strong>{selectedCategory?.icon} {selectedCategory?.name}</strong></span>
              </div>
              <div className="record-review-item wide">
                <i aria-hidden="true">€</i>
                <span>Metodo di pagamento<strong>{selectedMethod.icon} {selectedMethod.name}</strong></span>
              </div>
            </div>
          </div>

          {!isCash ? <div className="counter-expense-bank-section">
            <h3>Addebita su</h3>
            <div className="counter-expense-choice-list">
              {orderedBanks.map((bank, index) =>
                <button ref={element => { bankRefs.current[index] = element; }}
                        type="button" key={bank.id} disabled={sending}
                        className={`${bank.isPrimary ? 'is-primary' : ''} ${bankIndex === index ? 'is-selected' : ''}`}
                        onFocus={() => setBankIndex(index)}
                        onClick={() => void saveExpense(bank.id)}>
                  <span>➤</span>
                  <span>{bank.icon ?? '🏦'}</span>
                  <span>{bank.name}{bank.isPrimary ? <small>Principale</small> : null}</span>
                </button>)}
            </div>
            {orderedBanks.length ? <p className="cash-register-keyboard-hint">Usa le frecce e premi Invio per addebitare.</p> : null}
            {!orderedBanks.length ? <p className="cash-register-notice is-error">Non ci sono banche disponibili.</p> : null}
          </div> : null}

          <div className="counter-expense-modal-actions cash-register-actions has-confirmation">
            <button ref={cancelRef}
                    className={`cash-register-cancel btn btn-md btn-danger ${isCash && confirmationIndex === 0 ? 'is-selected' : ''}`}
                    type="button" disabled={sending}
                    onFocus={() => { if (isCash) setConfirmationIndex(0); }}
                    onClick={closePaymentModal}>↵</button>
            {isCash ? <button ref={submitRef}
                              className={`btn cash-register-submit ${confirmationIndex === 1 ? 'is-selected' : ''}`}
                              type="button" disabled={sending}
                              onFocus={() => setConfirmationIndex(1)}
                              onClick={() => void saveExpense(null)}>
              <span aria-hidden="true">{selectedMethod.icon ?? '•'}</span>
              <span>{sending ? 'Salvataggio…' : 'Salva spesa'}</span>
              <span aria-hidden="true">➤</span>
            </button> : null}
          </div>
        </>}
      </section>
    </div> : null}
  </main>;
}
