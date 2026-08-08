"use client";

import {useRouter} from 'next/navigation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {applyCurrencyInputKeyWithState, formatCurrencyInput} from '@/lib/currency-input';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {zonedMidnightUtc} from '@/lib/company-time';

type Method = {
    id: number;
    name: string;
    icon: string | null;
    systemRole: string | null;
};
type Channel = { id: number; name: string; icon: string | null };
type InitialReceipt = {
    id: number;
    amount: number;
    isFiscal: boolean;
    vatRate: number;
    salesChannelId: number;
    paymentMethodId: number;
    description: string | null;
};

function cashRegisterDateLabel(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return '';
    const parts = new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).formatToParts(new Date(year, month - 1, day, 12));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
    const monthLabel = part('month').replace('.', '');
    return `${part('day')} ${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${part('year')}`;
}

function euro(value: number) {
    return new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR'}).format(value);
}

function newRequestId() {
    return crypto.randomUUID();
}

export default function CashRegister({
                                         methods,
                                         channels,
                                         defaultChannelId,
                                         primaryMethodId,
                                         initialDate,
                                         mode,
                                         initialReceipt
                                     }: {
    methods: Method[];
    channels: Channel[];
    defaultChannelId: number;
    primaryMethodId: number | null;
    initialDate: string;
    mode: 'create' | 'edit' | 'copy';
    initialReceipt: InitialReceipt | null;
}) {
    const timeZone = useCompanyTimeZone();
    const router = useRouter();
    const amountRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLInputElement>(null);
    const amountKeyStateRef = useRef<{separatorDigits: 0 | 1 | null}>({separatorDigits: null});
    const keyboardMethodRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const keyboardCancelRef = useRef<HTMLButtonElement>(null);
    const keyboardSubmitRef = useRef<HTMLButtonElement>(null);
    const [amount, setAmount] = useState(initialReceipt ? String(initialReceipt.amount).replace('.', ',') : '');
    const amountValueRef = useRef(amount);
    const [description, setDescription] = useState(initialReceipt?.description === 'Incasso da banco' ? '' : initialReceipt?.description ?? '');
    const [isFiscal, setIsFiscal] = useState(initialReceipt?.isFiscal ?? true);
    const [vatRate, setVatRate] = useState(initialReceipt?.vatRate ?? 22);
    const [lastFiscalVatRate, setLastFiscalVatRate] = useState(initialReceipt?.vatRate || 22);
    const [creditDate, setCreditDate] = useState(initialDate);
    const [salesChannelId, setSalesChannelId] = useState(String(initialReceipt?.salesChannelId ?? defaultChannelId));
    const [selectedMethodId, setSelectedMethodId] = useState<number | null>(
        initialReceipt && !initialReceipt.isFiscal
            ? methods.find(method => method.systemRole === 'CASH')?.id ?? null
            : initialReceipt?.paymentMethodId ?? null
    );
    const [requestId, setRequestId] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [keyboardMethodOpen, setKeyboardMethodOpen] = useState(false);
    const [keyboardMethodIndex, setKeyboardMethodIndex] = useState(0);
    const [keyboardConfirmationIndex, setKeyboardConfirmationIndex] = useState<0 | 1>(1);
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

    const cashMethod = methods.find(method => method.systemRole === 'CASH') ?? null;
    const primaryMethod = methods.find(method => method.id === primaryMethodId && method.id !== cashMethod?.id) ?? null;
    const otherMethods = methods.filter(method => method.id !== cashMethod?.id && method.id !== primaryMethod?.id);
    const orderedMethods = useMemo(() => {
        const cash = methods.find(method => method.systemRole === 'CASH') ?? null;
        const primary = methods.find(method => method.id === primaryMethodId && method.id !== cash?.id) ?? null;
        return [cash, primary, ...methods.filter(method => method.id !== cash?.id && method.id !== primary?.id)]
            .filter((method): method is Method => Boolean(method));
    }, [methods, primaryMethodId]);
    const selectedMethod = methods.find(method => method.id === selectedMethodId) ?? null;
    const confirmationLocked = Boolean(selectedMethod && mode === 'create');
    const numericAmount = Number(amount.replace(',', '.'));
    const hasValidAmount = Number.isFinite(numericAmount) && numericAmount > 0;
    const netAmount = isFiscal && vatRate > 0
        ? numericAmount / (1 + vatRate / 100)
        : numericAmount;
    const formattedAmount = useMemo(() => formatCurrencyInput(amount), [amount]);
    const amountDigitCount = amount.replace(/\D/g, '').length;
    const amountSizeClass = amountDigitCount > 8
        ? 'is-very-long'
        : amountDigitCount > 5
            ? 'is-long'
            : undefined;
    const methodIsAvailable = (method: Method) => isFiscal || method.id === cashMethod?.id;

    function moveKeyboardMethod(direction: 1 | -1) {
        setKeyboardMethodIndex(current => {
            for (let offset = 1; offset <= orderedMethods.length; offset += 1) {
                const index = (current + direction * offset + orderedMethods.length) % orderedMethods.length;
                if (methodIsAvailable(orderedMethods[index])) return index;
            }
            return current;
        });
    }

    function selectKeyboardConfirmation(index: 0 | 1) {
        setKeyboardConfirmationIndex(index);
        const button = index === 0 ? keyboardCancelRef.current : keyboardSubmitRef.current;
        button?.focus({preventScroll: true});
    }

    function focusAmount() {
        requestAnimationFrame(() => amountRef.current?.focus({preventScroll: true}));
    }

    function cancelKeyboardMethodModal() {
        setSelectedMethodId(null);
        setKeyboardMethodOpen(false);
        setNotice(null);
        focusAmount();
    }

    useEffect(() => {
        requestAnimationFrame(() => amountRef.current?.focus({preventScroll: true}));
    }, []);

    useEffect(() => {
        if (!keyboardMethodOpen) return;
        requestAnimationFrame(() => {
            if (selectedMethod) {
                const confirmationButton = keyboardConfirmationIndex === 0
                    ? keyboardCancelRef.current
                    : keyboardSubmitRef.current;
                confirmationButton?.focus({preventScroll: true});
            } else {
                keyboardMethodRefs.current[keyboardMethodIndex]?.focus({preventScroll: true});
            }
        });
    }, [keyboardConfirmationIndex, keyboardMethodIndex, keyboardMethodOpen, selectedMethod]);

    useEffect(() => {
        if (!requestId) setRequestId(newRequestId());
        const onKey = (event: KeyboardEvent) => {
            if (event.target === descriptionRef.current) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    focusAmount();
                }
                return;
            }
            if (keyboardMethodOpen) {
                if (selectedMethod) {
                    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
                        event.preventDefault();
                        selectKeyboardConfirmation(keyboardConfirmationIndex === 0 ? 1 : 0);
                    } else if (event.key === 'Enter') {
                        event.preventDefault();
                        if (keyboardConfirmationIndex === 0) {
                            cancelKeyboardMethodModal();
                        } else {
                            void submitReceipt();
                        }
                    } else if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelKeyboardMethodModal();
                    }
                    return;
                }
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    moveKeyboardMethod(1);
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    moveKeyboardMethod(-1);
                } else if (event.key === 'Enter') {
                    event.preventDefault();
                    const method = orderedMethods[keyboardMethodIndex];
                    if (method && methodIsAvailable(method)) {
                        setSelectedMethodId(method.id);
                        setKeyboardConfirmationIndex(1);
                        setNotice(null);
                    }
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setKeyboardMethodOpen(false);
                    focusAmount();
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
            } else if (event.key === 'Enter' && selectedMethod && methodIsAvailable(selectedMethod)) {
                event.preventDefault();
                void submitReceipt();
            } else if (event.key === 'Enter' && hasValidAmount && orderedMethods.length) {
                event.preventDefault();
                setMenuOpen(false);
                const selectedIndex = orderedMethods.findIndex(method => method.id === selectedMethodId && methodIsAvailable(method));
                const firstAvailableIndex = orderedMethods.findIndex(methodIsAvailable);
                setKeyboardMethodIndex(selectedIndex >= 0 ? selectedIndex : Math.max(0, firstAvailableIndex));
                setKeyboardMethodOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [requestId, selectedMethodId, amount, description, isFiscal, vatRate, creditDate, salesChannelId, sending, keyboardMethodOpen, keyboardMethodIndex, keyboardConfirmationIndex, orderedMethods, hasValidAmount]);

    function appendKey(key: string) {
        if (confirmationLocked) return;
        setNotice(null);
        const nextAmount = applyCurrencyInputKeyWithState(amountValueRef.current, key, amountKeyStateRef.current);
        amountValueRef.current = nextAmount;
        setAmount(nextAmount);
        focusAmount();
    }

    function toggleFiscal(value: boolean) {
        if (confirmationLocked) return;
        setIsFiscal(value);
        if (!value) {
            if (vatRate) setLastFiscalVatRate(vatRate);
            setVatRate(0);
            setSelectedMethodId(mode === 'create' ? null : cashMethod?.id ?? null);
        } else {
            setVatRate(lastFiscalVatRate || 22);
        }
        focusAmount();
    }

    function chooseVat(rate: number) {
        if (confirmationLocked) return;
        setVatRate(rate);
        if (rate > 0) setLastFiscalVatRate(rate);
        focusAmount();
    }

    function chooseMethod(id: number) {
        if (!hasValidAmount) return;
        const method = methods.find(item => item.id === id);
        if (!method || !methodIsAvailable(method)) return;
        setSelectedMethodId(id);
        setMenuOpen(false);
        setKeyboardMethodOpen(false);
        setNotice(null);
        focusAmount();
    }

    function cancelMethod() {
        setSelectedMethodId(null);
        setMenuOpen(false);
        setNotice(null);
        focusAmount();
    }

    async function submitReceipt(methodOverride?: Method) {
        const paymentMethod = methodOverride ?? selectedMethod;
        if (!paymentMethod || !methodIsAvailable(paymentMethod) || !requestId || !Number.isFinite(numericAmount) || numericAmount <= 0 || sending) {
            setNotice({tone: 'error', text: 'Inserisci un importo valido e scegli il metodo.'});
            focusAmount();
            return;
        }
        setSending(true);
        setNotice(null);
        try {
            const localDate = new Date(zonedMidnightUtc(creditDate, timeZone).getTime() + 12 * 60 * 60 * 1000);
            const editing = mode === 'edit' && initialReceipt;
            const response = await fetch(editing ? `/api/cash-register/receipts/${initialReceipt.id}` : '/api/cash-register/receipts', {
                method: editing ? 'PATCH' : 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    amount: numericAmount,
                    isFiscal,
                    vatRate: isFiscal ? vatRate : 0,
                    creditDate: localDate.toISOString(),
                    salesChannelId: Number(salesChannelId),
                    description,
                    paymentMethodId: paymentMethod.id,
                    ...(!editing ? {requestId} : {})
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Registrazione non riuscita');
            if (editing) {
                router.push('/incomes/cash-register/receipts');
                router.refresh();
                return;
            }
            setNotice({tone: 'ok', text: `Incasso registrato · ${paymentMethod.icon ?? ''} ${paymentMethod.name}`});
            amountValueRef.current = '';
            amountKeyStateRef.current.separatorDigits = null;
            setAmount('');
            setDescription('');
            setSelectedMethodId(null);
            setKeyboardMethodOpen(false);
            setRequestId(newRequestId());
        } catch (error) {
            setNotice({tone: 'error', text: error instanceof Error ? error.message : 'Registrazione non riuscita'});
        } finally {
            setSending(false);
            requestAnimationFrame(() => {
                const confirmationButton = keyboardConfirmationIndex === 0
                    ? keyboardCancelRef.current
                    : keyboardSubmitRef.current;
                const methodButton = keyboardMethodRefs.current[keyboardMethodIndex];
                if (keyboardMethodOpen && confirmationButton?.isConnected) {
                    confirmationButton.focus({preventScroll: true});
                } else if (keyboardMethodOpen && methodButton?.isConnected) {
                    methodButton.focus({preventScroll: true});
                } else {
                    amountRef.current?.focus({preventScroll: true});
                }
            });
        }
    }

    return <main className={`cash-register-shell ${mode === 'edit' ? 'is-editing' : ''} ${notice ? 'has-notice' : ''}`}>
        <header className="cash-register-header">
            <div className="">
                <h1>{mode === 'edit' ? `Modifica scontrino #${initialReceipt?.id}` : mode === 'copy' ? 'Copia scontrino' : 'Registratore di cassa'}</h1>
                <a className="btn btn-sm btn-link" href="/incomes/cash-register/receipts">
                    <span className="btn-icon" aria-hidden="true">📊</span>
                    <span className="hidden-sm-up">Report scontrini</span>
                    <span className="hidden-sm-down">Report scontrini</span>
                </a>
            </div>
            <div className="cash-register-header-actions">
                <a className="btn btn-circle btn-sm btn-neutral btn-close" href="/incomes/">
                    <span className="btn-icon" aria-hidden="true">✕</span>
                </a>
                {/*<DetailBackButton href={mode === 'edit' ? '/incomes/cash-register/receipts' : '/incomes'}/>*/}
            </div>
        </header>

        {mode === 'edit' ? <div className="cash-register-edit-confirm">
            <button className="btn btn-sm btn-success" type="button" disabled={sending}
                    onClick={() => void submitReceipt()}>
                ✓ {sending ? 'Salvataggio…' : 'Conferma modifica'}
            </button>
        </div> : null}

        <section className="cash-register-controls" aria-label="Impostazioni incasso">
            <label className="cash-register-fiscal-switch">
                <input type="checkbox" checked={isFiscal} disabled={confirmationLocked}
                       onChange={event => toggleFiscal(event.currentTarget.checked)}/>
                <span>Fiscale</span>
                {/*<b>{isFiscal ? 'ON' : 'OFF'}</b>*/}
            </label>
            <div className="cash-register-date-control">
                <input aria-label="Data incasso" type="date" value={creditDate} disabled={confirmationLocked}
                       onChange={event => setCreditDate(event.currentTarget.value)}/>
                <span aria-hidden="true">{cashRegisterDateLabel(creditDate)}</span>
            </div>
            <select aria-label="Canale di vendita" value={salesChannelId} disabled={confirmationLocked}
                    onChange={event => setSalesChannelId(event.currentTarget.value)}>
                {channels.map(channel =>
                    <option value={channel.id} key={channel.id}>{channel.icon ?? ''} {channel.name}</option>)}
            </select>
        </section>

        <label className="cash-register-description">
            <span aria-hidden="true">≡</span>
            <input ref={descriptionRef} value={description} maxLength={200}
                   placeholder="Incasso da banco" aria-label="Descrizione dell’incasso"
                   disabled={confirmationLocked}
                   onChange={event => setDescription(event.currentTarget.value)}
                   onKeyDown={event => {
                       if (event.key !== 'Enter') return;
                       event.preventDefault();
                       event.stopPropagation();
                       focusAmount();
                   }}/>
        </label>

        <section className="cash-register-display cash-register-display-with-net">
            <small className="cash-register-net-amount" aria-live="polite">
                <span>IVA esclusa</span>
                <strong>{euro(Number.isFinite(netAmount) ? netAmount : 0)}</strong>
            </small>
            <div className="cash-register-display-amount">
                <span>€</span>
                <input ref={amountRef} className={amountSizeClass} aria-label="Importo incasso" value={formattedAmount} readOnly
                       disabled={confirmationLocked} inputMode="none"/>
            </div>
        </section>

        <section className="cash-register-vat" aria-label="Aliquota IVA">
            {[0, 4, 10, 22].map(rate =>
                <button type="button" key={rate}
                        disabled={confirmationLocked || (isFiscal && rate === 0) || (!isFiscal && rate !== 0)}
                        className={vatRate === rate ? 'is-selected' : ''}
                        onClick={() => chooseVat(rate)}>{rate}%</button>)}
        </section>

        <section className="cash-register-keypad" aria-label="Tastiera numerica">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace'].map(key =>
                <button type="button" key={key} disabled={confirmationLocked} onClick={() => appendKey(key)}
                        aria-label={key === 'backspace' ? 'Cancella ultima cifra' : key}>
                    {key === 'backspace' ? '⌫' : key}
                </button>)}
        </section>

        {notice ? <div className={`cash-register-notice ${notice.tone === 'error' ? 'is-error' : ''}`} role="status">
            {notice.text}
        </div> : null}

        <section className={`cash-register-actions ${primaryMethod ? '' : 'without-primary'} ${selectedMethod && mode === 'create' ? 'has-confirmation' : ''}`}>
            {selectedMethod && mode === 'create' ? <button className="cash-register-cancel btn-danger" type="button"
                                                           disabled={sending} onClick={cancelMethod}
                                                           aria-label="Annulla metodo selezionato" title="Annulla">
                ↵
            </button> : null}
            {selectedMethod && mode === 'create' ?
                <button className="cash-register-submit" type="button" disabled={sending || !hasValidAmount || !methodIsAvailable(selectedMethod)}
                        onClick={() => void submitReceipt()}>
                    <span>{selectedMethod.icon ?? '✓'}</span> {sending ? 'Invio…' : 'INCASSA'}
                </button> : <>
                    {cashMethod ? <button type="button" disabled={!hasValidAmount}
                                          className={selectedMethodId === cashMethod.id ? 'is-selected' : ''}
                                          onClick={() => chooseMethod(cashMethod.id)}>
                        <span>{cashMethod.icon ?? '💶'}</span>{cashMethod.name}
                    </button> : null}
                    {primaryMethod ?
                        <button type="button" disabled={!hasValidAmount || !methodIsAvailable(primaryMethod)}
                                className={selectedMethodId === primaryMethod.id ? 'is-selected' : ''}
                                onClick={() => chooseMethod(primaryMethod.id)}>
                            <span>{primaryMethod.icon ?? '💳'}</span>{primaryMethod.name}
                        </button> : null}
                    {otherMethods.length ? <div className="cash-register-more">
                        <button type="button" disabled={!hasValidAmount || !isFiscal}
                                className={otherMethods.some(method => method.id === selectedMethodId) ? 'is-selected' : ''}
                                aria-label="Altri metodi" aria-expanded={menuOpen}
                                onClick={() => setMenuOpen(open => !open)}>•••
                        </button>
                    </div> : null}
                </>}
            {mode === 'copy' && selectedMethod ?
                <button className="cash-register-submit" type="button" disabled={sending || !methodIsAvailable(selectedMethod)}
                        onClick={() => void submitReceipt()}>
                    <span>{selectedMethod.icon ?? '✓'}</span> {sending ? 'Invio…' : 'INVIA COPIA'}
                </button> : null}
        </section>
        {menuOpen && otherMethods.length ? <div className="cash-register-method-backdrop"
                                                role="presentation"
                                                onClick={() => setMenuOpen(false)}>
            <section className="cash-register-method-modal" role="dialog" aria-modal="true"
                     aria-labelledby="cash-register-method-title" onClick={event => event.stopPropagation()}>
                <header>
                    <h2 id="cash-register-method-title">Metodo di pagamento</h2>
                    <button type="button" aria-label="Chiudi" onClick={() => setMenuOpen(false)}>×</button>
                </header>
                <div>
                    {otherMethods.map(method =>
                        <button type="button" key={method.id} disabled={!hasValidAmount || !methodIsAvailable(method)}
                                className={selectedMethodId === method.id ? 'is-selected' : ''}
                                onClick={() => chooseMethod(method.id)}>
                            <span>{method.icon ?? '•'}</span>{method.name}
                        </button>)}
                </div>
            </section>
        </div> : null}
        {keyboardMethodOpen ? <div className="cash-register-method-backdrop"
                                   role="presentation"
                                   onClick={() => {
                                       if (sending) return;
                                       setKeyboardMethodOpen(false);
                                       focusAmount();
                                   }}>
            <section className="cash-register-method-modal cash-register-keyboard-method-modal" role="dialog"
                     aria-modal="true" aria-labelledby="cash-register-keyboard-method-title"
                     onClick={event => event.stopPropagation()}>
                <header>
                    <h2 id="cash-register-keyboard-method-title">Metodo di pagamento</h2>
                    <button type="button" aria-label="Chiudi" disabled={sending} onClick={() => {
                        setKeyboardMethodOpen(false);
                        focusAmount();
                    }}>×
                    </button>
                </header>
                {!selectedMethod ? <div>
                    {orderedMethods.map((method, index) =>
                        <button ref={element => {
                            keyboardMethodRefs.current[index] = element;
                        }}
                                type="button" key={method.id} disabled={sending || !methodIsAvailable(method)}
                                className={keyboardMethodIndex === index ? 'is-selected' : ''}
                                onFocus={() => setKeyboardMethodIndex(index)}
                                onClick={() => {
                                    setSelectedMethodId(method.id);
                                    setKeyboardConfirmationIndex(1);
                                    setNotice(null);
                                }}>
                            <span>{method.icon ?? '•'}</span>{method.name}
                        </button>)}
                </div> : <section className="cash-register-actions has-confirmation cash-register-keyboard-confirmation">
                    <button ref={keyboardCancelRef}
                            className={`cash-register-cancel btn-danger ${keyboardConfirmationIndex === 0 ? 'is-selected' : ''}`}
                            type="button" tabIndex={0} disabled={sending}
                            aria-label="Annulla metodo selezionato" title="Annulla"
                            onFocus={() => setKeyboardConfirmationIndex(0)}
                            onClick={cancelKeyboardMethodModal}>↩</button>
                    <button ref={keyboardSubmitRef}
                            className={`cash-register-submit ${keyboardConfirmationIndex === 1 ? 'is-selected' : ''}`}
                            type="button" tabIndex={0}
                            disabled={sending || !hasValidAmount || !methodIsAvailable(selectedMethod)}
                            onFocus={() => setKeyboardConfirmationIndex(1)}
                            onClick={() => void submitReceipt()}>
                        <span>{selectedMethod.icon ?? '✓'}</span> {sending ? 'Invio…' : 'INCASSA'}
                    </button>
                </section>}
                {!selectedMethod ? <p className="cash-register-keyboard-hint">Usa le frecce per scegliere e premi Invio per selezionare.</p> : null}
            </section>
        </div> : null}
    </main>;
}
