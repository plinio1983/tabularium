"use client";

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {applyCurrencyInputKeyWithState, formatCurrencyInput, resetCurrencyInput} from '@/lib/currency-input';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {zonedMidnightUtc} from '@/lib/company-time';
import {euro} from '@/lib/money';
import {SelectField} from '@/components/FormControls';
import {existingReceiptLines, receiptLineSummary, receiptLineLimit, type ReceiptLine} from '@/lib/cash-register-lines';

type Method = {
    id: number;
    name: string;
    icon: string | null;
    systemRole: string | null;
    defaultBankId: number | null;
    bankRules: Array<{ salesChannelId: number; bankId: number }>
};
type Option = { id: number; name: string; icon?: string | null };
type InitialReceipt = {
    id: number;
    amount: number;
    isFiscal: boolean;
    vatRate: number;
    salesChannelId: number;
    incomeCategoryId: number;
    paymentMethodId: number;
    bankId: number;
    description: string | null;
    receiptLines?: ReceiptLine[]
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

export default function CashRegister({
                                         methods,
                                         banks,
                                         channels,
                                         categories,
                                         defaultCategoryId,
                                         defaultChannelId,
                                         primaryMethodId,
                                         initialDate,
                                         mode,
                                         initialReceipt,
                                         returnTo
                                     }: {
    methods: Method[];
    banks: Option[];
    channels: Option[];
    categories: Option[];
    defaultCategoryId: number;
    defaultChannelId: number;
    primaryMethodId: number | null;
    initialDate: string;
    mode: 'create' | 'edit' | 'copy';
    initialReceipt: InitialReceipt | null;
    returnTo: string;
}) {
    const router = useRouter();
    const timeZone = useCompanyTimeZone();
    const amountRef = useRef<HTMLInputElement>(null);
    const amountValueRef = useRef('');
    const keyState = useRef<{ separatorDigits: 0 | 1 | null }>({separatorDigits: null});
    const sendingRef = useRef(false);
    const submitRef = useRef<HTMLButtonElement>(null);
    const previousFocus = useRef<HTMLElement | null>(null);
    const [amount, setAmount] = useState('');
    const [lines, setLines] = useState<ReceiptLine[]>(() => initialReceipt ? existingReceiptLines(initialReceipt) : []);
    const [isFiscal, setIsFiscal] = useState(true);
    const [vatRate, setVatRate] = useState(22);
    const [description, setDescription] = useState(initialReceipt?.description === 'Incasso da banco' ? '' : initialReceipt?.description ?? '');
    const [creditDate, setCreditDate] = useState(initialDate);
    const [categoryId] = useState(String(initialReceipt?.incomeCategoryId ?? defaultCategoryId));
    const [channelId, setChannelId] = useState(String(initialReceipt?.salesChannelId ?? defaultChannelId));
    const [bankId, setBankId] = useState<number | null>(initialReceipt?.bankId ?? null);
    const [selectedMethod, setSelectedMethod] = useState<Method | null>(null);
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
    const [requestId, setRequestId] = useState('');
    const [mounted, setMounted] = useState(false);
    const [keyboardSheet, setKeyboardSheet] = useState<'vat' | 'payment' | null>(null);
    const [keyboardIndex, setKeyboardIndex] = useState(0);
    const [confirmationAction, setConfirmationAction] = useState<'submit' | 'cancel'>('submit');
    const vatPanel = useRef<HTMLDivElement>(null);
    const methodPanel = useRef<HTMLDivElement>(null);
    const draftDescriptionRef = useRef<string | null>(null);
    const registerRef = useRef<HTMLElement>(null);
    const keyboardButtons = useRef<Array<HTMLButtonElement | null>>([]);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const keyboardVatOptions = [{isFiscal: false, vatRate: 0}, ...[0, 4, 10, 22].map(rate => ({isFiscal: true, vatRate: rate}))];
    const numericAmount = Number(amount.replace(',', '.'));
    const hasDraft = Number.isFinite(numericAmount) && numericAmount > 0;
    const summary = useMemo(() => lines.length ? receiptLineSummary(lines) : null, [lines]);
    const showMethods = lines.length > 0 && !hasDraft;
    const orderedMethods = useMemo(() => [...methods].sort((a, b) => {
        const rank = (method: Method) => method.systemRole === 'CASH' ? 0 : method.id === primaryMethodId ? 1 : 2;
        return rank(a) - rank(b);
    }), [methods, primaryMethodId]);
    const available = (method: Method) => !summary?.hasNonFiscal || method.systemRole === 'CASH';
    const taxGroups = useMemo(() => lines.reduce((groups, line) => {
        const key = line.isFiscal ? `IVA ${line.vatRate}%` : 'Non fiscale';
        groups.set(key, Math.round(((groups.get(key) ?? 0) + line.amount) * 100) / 100);
        return groups;
    }, new Map<string, number>()), [lines]);

    useEffect(() => {
        setMounted(true);
        setRequestId(crypto.randomUUID());
        amountRef.current?.focus();
    }, []);
    useEffect(() => {
        if (vatPanel.current) vatPanel.current.inert = showMethods || Boolean(selectedMethod);
        if (methodPanel.current) methodPanel.current.inert = !showMethods || Boolean(selectedMethod);
    }, [showMethods, selectedMethod]);
    const dialogOpen = Boolean(selectedMethod || keyboardSheet);
    const keyboardMethods = orderedMethods.filter(available);
    useEffect(() => {
        if (registerRef.current) registerRef.current.inert = dialogOpen;
        if (!dialogOpen) return;
        const overflow = document.body.style.overflow;
        previousFocus.current = document.activeElement as HTMLElement | null;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = overflow;
            if (registerRef.current) registerRef.current.inert = false;
            requestAnimationFrame(() => {
                if (previousFocus.current?.isConnected && previousFocus.current.getClientRects().length && !previousFocus.current.closest('[inert]')) previousFocus.current.focus({preventScroll: true}); else amountRef.current?.focus({preventScroll: true});
            });
        };
    }, [dialogOpen]);
    useEffect(() => {
        if (selectedMethod) {
            (confirmationAction === 'submit' ? submitRef.current : cancelRef.current)?.focus({preventScroll: true});
        } else if (keyboardSheet) keyboardButtons.current[keyboardIndex]?.focus({preventScroll: true});
    }, [selectedMethod, keyboardSheet, keyboardIndex, confirmationAction, sending]);

    function closeKeyboardSheet() {
        setKeyboardSheet(null);
    }

    function openKeyboardSheet() {
        if (hasDraft) {
            setKeyboardIndex(Math.max(0, keyboardVatOptions.findIndex(option => option.isFiscal === isFiscal && option.vatRate === vatRate)));
            setKeyboardSheet('vat');
        } else if (summary && keyboardMethods.length) {
            const preferred = keyboardMethods.findIndex(method => method.id === (mode === 'edit' ? initialReceipt?.paymentMethodId : primaryMethodId));
            setKeyboardIndex(Math.max(0, preferred));
            setKeyboardSheet('payment');
        }
    }

    function acceptKeyboardChoice(index: number) {
        if (sendingRef.current) return;
        if (keyboardSheet === 'vat') {
            const option = keyboardVatOptions[index];
            if (!option) return;
            setIsFiscal(option.isFiscal);
            setVatRate(option.vatRate);
            if (addLine(option)) closeKeyboardSheet();
        } else if (keyboardSheet === 'payment') {
            const method = keyboardMethods[index];
            if (!method) return;
            closeKeyboardSheet();
            chooseMethod(method);
        }
    }

    function focusAmount() {
        requestAnimationFrame(() => amountRef.current?.focus({preventScroll: true}));
    }

    function changeAmount(next: string) {
        amountValueRef.current = next;
        setAmount(next);
        setNotice(null);
    }

    function appendKey(key: string) {
        if (selectedMethod || keyboardSheet || sendingRef.current) return;
        changeAmount(applyCurrencyInputKeyWithState(amountValueRef.current, key, keyState.current));
        focusAmount();
    }

    function clearAmount() {
        if (selectedMethod || sendingRef.current) return;
        draftDescriptionRef.current = null;
        changeAmount(resetCurrencyInput(keyState.current));
        focusAmount();
    }

    function addLine(option = {isFiscal, vatRate}) {
        if (!hasDraft || sendingRef.current || selectedMethod) return false;
        const next = [...lines, {
            amount: numericAmount,
            isFiscal: option.isFiscal,
            vatRate: option.isFiscal ? option.vatRate : 0, ...(draftDescriptionRef.current ? {description: draftDescriptionRef.current} : {})
        }];
        try {
            receiptLineSummary(next);
        } catch (error) {
            setNotice({tone: 'error', text: (error as Error).message});
            return false;
        }
        setLines(next);
        clearAmount();
        return true;
    }

    function undoLastLine() {
        if (sendingRef.current || selectedMethod || !lines.length) return;
        const last = lines[lines.length - 1];
        setLines(lines.slice(0, -1));
        setIsFiscal(last.isFiscal);
        setVatRate(last.vatRate);
        keyState.current.separatorDigits = null;
        draftDescriptionRef.current = last.description ?? null;
        changeAmount(String(last.amount).replace('.', ','));
        focusAmount();
    }

    function cancelReceipt() {
        if (sendingRef.current || selectedMethod) return;
        setLines([]);
        setDescription('');
        setRequestId(crypto.randomUUID());
        clearAmount();
    }

    function closeConfirmation() {
        if (!sendingRef.current) {
            setSelectedMethod(null);
            setNotice(null);
        }
    }

    function chooseMethod(method: Method) {
        if (!summary || hasDraft || !available(method) || sendingRef.current) return;
        if (mode === 'edit' && method.id !== initialReceipt?.paymentMethodId) setBankId(method.bankRules.find(rule => rule.salesChannelId === Number(channelId))?.bankId ?? method.defaultBankId ?? bankId);
        setConfirmationAction('submit');
        setSelectedMethod(method);
        setNotice(null);
    }

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (sendingRef.current || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
            if (event.key === 'Enter' && event.repeat) {event.preventDefault(); return;}
            if (keyboardSheet) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    if (keyboardSheet === 'payment') undoLastLine();
                    closeKeyboardSheet();
                }
                else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
                    event.preventDefault();
                    const length = keyboardSheet === 'vat' ? keyboardVatOptions.length : keyboardMethods.length;
                    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
                    setKeyboardIndex(index => (index + step + length) % length);
                } else if (event.key === 'Enter' && !(event.target as HTMLElement | null)?.closest('button[aria-label="Chiudi selezione"]')) {event.preventDefault(); acceptKeyboardChoice(keyboardIndex);}
                return;
            }
            if (selectedMethod) {
                if (event.key === 'Escape') {event.preventDefault(); closeConfirmation(); return;}
                const target = event.target as HTMLElement | null;
                if (target?.matches('input, select, textarea') || target?.closest('[contenteditable="true"]')) return;
                if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
                    event.preventDefault();
                    setConfirmationAction(action => action === 'submit' ? 'cancel' : 'submit');
                } else if (event.key === 'Enter' && (target === submitRef.current || target === cancelRef.current || target === amountRef.current)) {
                    event.preventDefault();
                    if (confirmationAction === 'submit') void submitReceipt(); else closeConfirmation();
                }
                return;
            }
            const target = event.target as HTMLElement | null;
            if (target?.matches('input:not([readonly]), select, textarea') || target?.closest('[contenteditable="true"]')) return;
            if (/^\d$/.test(event.key)) {
                event.preventDefault();
                appendKey(event.key);
            } else if (event.key === ',' || event.key === '.') {
                event.preventDefault();
                appendKey(',');
            } else if (event.key === 'Backspace') {
                event.preventDefault();
                appendKey('backspace');
            } else if (event.key === 'Escape' || event.key === 'Delete') {
                event.preventDefault();
                if (event.key === 'Escape' && showMethods) undoLastLine(); else clearAmount();
            } else if (event.key === 'Enter' && target === amountRef.current) {
                event.preventDefault();
                openKeyboardSheet();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedMethod, amount, lines, isFiscal, vatRate, keyboardSheet, keyboardIndex, confirmationAction, orderedMethods, primaryMethodId, creditDate, channelId, bankId, description, requestId]);

    async function submitReceipt() {
        if (!selectedMethod || !summary || !available(selectedMethod) || !requestId || !creditDate || !categoryId || !channelId || mode === 'edit' && !bankId || sendingRef.current) return;
        sendingRef.current = true;
        setSending(true);
        setNotice(null);
        try {
            const date = new Date(zonedMidnightUtc(creditDate, timeZone).getTime() + 12 * 60 * 60 * 1000);
            const response = await fetch(mode === 'edit' ? `/api/cash-register/receipts/${initialReceipt!.id}` : '/api/cash-register/receipts', {
                method: mode === 'edit' ? 'PATCH' : 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    lines,
                    creditDate: date.toISOString(),
                    incomeCategoryId: Number(categoryId),
                    salesChannelId: Number(channelId),
                    description,
                    paymentMethodId: selectedMethod.id, ...(mode === 'edit' ? {bankId} : {requestId})
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Registrazione non riuscita');
            if (mode === 'edit') {
                router.push(returnTo);
                router.refresh();
                return;
            }
            setLines([]);
            draftDescriptionRef.current = null;
            changeAmount(resetCurrencyInput(keyState.current));
            setDescription('');
            setSelectedMethod(null);
            setRequestId(crypto.randomUUID());
            setNotice({tone: 'ok', text: `Incasso registrato · ${selectedMethod.name}`});
            router.refresh();
        } catch (error) {
            setNotice({tone: 'error', text: error instanceof Error ? error.message : 'Registrazione non riuscita'});
        } finally {
            sendingRef.current = false;
            setSending(false);
        }
    }

    return <main ref={registerRef} className={`cash-register-shell cash-register-multiple ${mode === 'edit' ? 'is-editing' : ''}`}>
        <header className="cash-register-header">
            <div>
                <h1>{mode === 'edit' ? `Modifica scontrino #${initialReceipt?.id}` : mode === 'copy' ? 'Copia scontrino' : 'Registratore di cassa'}</h1>
                <a className="btn btn-sm btn-link" href="/incomes/cash-register/receipts">Report scontrini</a></div>
            <Link data-page-transition="backward" aria-label="Chiudi"
                  className="btn btn-neutral btn-icon-only modal-close-button"
                  href={mode === 'edit' ? returnTo : '/incomes'}><span className="btn-icon">×</span></Link>
        </header>
        <section className="cash-register-controls" aria-label="Impostazioni incasso">
            <div className="cash-register-date-control"><input aria-label="Data incasso" type="date" value={creditDate}
                                                               required disabled={Boolean(selectedMethod)}
                                                               onChange={event => setCreditDate(event.currentTarget.value)}/><span
                aria-hidden="true">{cashRegisterDateLabel(creditDate)}</span></div>
            <select aria-label="Canale di vendita" value={channelId} disabled={Boolean(selectedMethod)}
                    onChange={event => setChannelId(event.currentTarget.value)}>{channels.map(item => <option
                key={item.id} value={item.id}>{item.icon ?? ''} {item.name}</option>)}</select>
        </section>
        <label className="cash-register-description"><span aria-hidden="true">≡</span><input value={description}
                                                                                             maxLength={200}
                                                                                             placeholder="Incasso da banco"
                                                                                             aria-label="Descrizione dell’incasso"
                                                                                             disabled={Boolean(selectedMethod)}
                                                                                             onChange={event => setDescription(event.currentTarget.value)}
                                                                                             onKeyDown={event => {
                                                                                                 if (event.key === 'Enter') {
                                                                                                     event.preventDefault();
                                                                                                     focusAmount();
                                                                                                 }
                                                                                             }}/></label>
        <section className="cash-register-display cash-register-total-display" aria-label="Totale provvisorio">
            <div className="cash-register-total-heading">
                <div>
                    <small>TOT · <strong>{lines.length} {lines.length === 1 ? 'importo' : 'importi'}</strong></small>
                </div>
                <div>
                    {/*<div><strong aria-live="polite">{euro(summary?.amount ?? 0)}</strong></div>*/}
                    <small>IVA Esc. <strong className="text-success">{euro(summary?.net ?? 0)}</strong></small>
                </div>
            </div>
            <div className="cash-register-display-amount cash-register-draft-amount"><label><input ref={amountRef}
                                                                                                   aria-label="Importo da aggiungere"
                                                                                                   value={formatCurrencyInput(showMethods ? String(summary?.amount ?? 0).replace('.', ',') : amount)}
                                                                                                   readOnly
                                                                                                   disabled={Boolean(selectedMethod)}
                                                                                                   inputMode="none"/></label>
                <button type="button" className="amount-clear-button" aria-label="Azzera importo"
                        disabled={Boolean(selectedMethod)} onClick={clearAmount}><span className="btn-icon">×</span>
                </button>
            </div>
        </section>
        <section className="cash-register-keypad"
                 aria-label="Tastiera numerica">{['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace'].map(key =>
            <button type="button" key={key} disabled={Boolean(selectedMethod)} onClick={() => appendKey(key)}
                    aria-label={key === 'backspace' ? 'Cancella ultima cifra' : key}>{key === 'backspace' ?
                <span className="btn-icon">⌫</span> : key}</button>)}</section>
        <div className="cash-register-panel-slider" data-methods-open={showMethods}>
            <div ref={vatPanel} className="cash-register-entry-pane">
                <section className="cash-register-vat" aria-label="Fiscalità e IVA">
                    <button type="button" className={`cash-register-non-fiscal ${!isFiscal ? 'is-selected' : ''}`}
                            disabled={!hasDraft} aria-pressed={!isFiscal} onClick={() => {
                        setIsFiscal(false);
                        setVatRate(0);
                        focusAmount();
                    }}>Non Fisc.
                    </button>
                    {[0, 4, 10, 22].map(rate => <button type="button" key={rate} disabled={!hasDraft}
                                                        className={isFiscal && vatRate === rate ? 'is-selected' : ''}
                                                        aria-pressed={isFiscal && vatRate === rate} onClick={() => {
                        setIsFiscal(true);
                        setVatRate(rate);
                        focusAmount();
                    }}>{rate}%</button>)}
                </section>
                <button className="btn btn-md btn-primary cash-register-add" type="button"
                        disabled={!hasDraft || lines.length >= receiptLineLimit} onClick={() => addLine()}><span className="btn-icon btn-icon-add" aria-hidden="true">＋</span>Aggiungi
                </button>
            </div>
            <div ref={methodPanel} className="cash-register-method-pane">
                <div className="cash-register-cancel-links">
                    <button type="button" className="btn btn-sm btn-link" disabled={sending || Boolean(selectedMethod)}
                            onClick={undoLastLine}>
                        <span className="btn-icon">↩</span> Annulla ultimo
                    </button>
                    <button type="button" className="btn btn-sm btn-link text-critical"
                            disabled={sending || Boolean(selectedMethod)}
                            onClick={cancelReceipt}>
                        <span className="btn-icon">×</span> Annulla scontrino
                    </button>
                </div>
                <section className="cash-register-actions cash-register-method-buttons"
                         aria-label="Metodi di incasso">{orderedMethods.map(method => <button type="button"
                                                                                              key={method.id}
                                                                                              disabled={!summary || !available(method)}
                                                                                              onClick={() => chooseMethod(method)}
                                                                                              title={!available(method) ? 'Gli importi non fiscali richiedono contanti' : undefined}>
                    <span className="btn-icon">{method.icon ?? '•'}</span>{method.name}</button>)}</section>
            </div>
        </div>
        {notice && !selectedMethod && <p className={`cash-register-notice ${notice.tone === 'error' ? 'is-error' : ''}`} role="status">{notice.text}</p>}
        {mounted && keyboardSheet && createPortal(<div className="cash-register-method-backdrop cash-register-keyboard-backdrop" onMouseDown={event => {
            if (event.target === event.currentTarget) closeKeyboardSheet();
        }}>
            <section className="cash-register-method-modal cash-register-keyboard-choice-modal" role="dialog" aria-modal="true" aria-labelledby="cash-register-keyboard-title" onKeyDown={event => {
                if (event.key !== 'Tab') return;
                const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
                else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
            }}>
                <header><h2 id="cash-register-keyboard-title">{keyboardSheet === 'vat' ? 'Seleziona reparto IVA' : 'Seleziona metodo di pagamento'}</h2>
                    <button className="btn btn-neutral btn-icon-only modal-close-button" type="button" aria-label="Chiudi selezione" onClick={closeKeyboardSheet}><span className="btn-icon" aria-hidden="true">×</span></button>
                </header>
                <div>
                    {keyboardSheet === 'vat' ? keyboardVatOptions.map((option, index) => <button key={index} type="button" ref={node => {keyboardButtons.current[index] = node;}} className={`${keyboardIndex === index ? 'is-selected' : ''} ${!option.isFiscal ? 'is-non-fiscal' : ''}`} aria-pressed={keyboardIndex === index} onFocus={() => setKeyboardIndex(index)} onClick={() => acceptKeyboardChoice(index)}>{option.isFiscal ? `Rep. ${option.vatRate}%` : 'Non Fisc.'}</button>) : keyboardMethods.map((method, index) => <button key={method.id} type="button" ref={node => {keyboardButtons.current[index] = node;}} className={keyboardIndex === index ? 'is-selected' : ''} aria-pressed={keyboardIndex === index} onFocus={() => setKeyboardIndex(index)} onClick={() => acceptKeyboardChoice(index)}><span className="btn-icon" aria-hidden="true">{method.icon ?? '•'}</span>{method.name}</button>)}
                </div>
                {notice?.tone === 'error' && <p className="form-error" role="alert">{notice.text}</p>}
                <p className="cash-register-keyboard-hint">Frecce per scegliere · Invio per confermare · Esc per annullare</p>
            </section>
        </div>, document.body)}
        {mounted && selectedMethod && summary && createPortal(<div
            className="modal-backdrop app-form-modal-backdrop cash-register-confirm-backdrop" onMouseDown={event => {
            if (event.target === event.currentTarget) closeConfirmation();
        }}>
            <section className="modal-card app-form-modal cash-register-confirm-modal" role="dialog" aria-modal="true"
                     aria-labelledby="cash-register-confirm-title" onKeyDown={event => {
                if (event.key !== 'Tab') return;
                const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), a[href], input:not(:disabled)'));
                const first = controls[0], last = controls[controls.length - 1];
                if (!first) {
                    event.preventDefault();
                    return;
                }
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }}>
                <div className="modal-title"><h3 id="cash-register-confirm-title">Riepilogo scontrino</h3>
                    <button className="btn btn-neutral btn-icon-only modal-close-button" type="button"
                            aria-label="Chiudi riepilogo" disabled={sending} onClick={closeConfirmation}><span
                        className="btn-icon" aria-hidden="true">×</span></button>
                </div>
                <div className="cash-register-confirm-content">
                    <strong className="cash-register-confirm-total">{euro(summary.amount)}</strong>
                    <dl className="cash-register-confirm-facts">
                        <div>
                            <dt>Data</dt>
                            <dd>{creditDate.split('-').reverse().join('/')}</dd>
                        </div>
                        <div>
                            <dt>Canale</dt>
                            <dd>{channels.find(item => String(item.id) === channelId)?.name}</dd>
                        </div>
                        <div>
                            <dt>Metodo di accredito</dt>
                            <dd>{selectedMethod.name}</dd>
                        </div>
                    </dl>
                    {mode === 'edit' &&
                        <SelectField label="Banca di accredito" icon="▥" name="bankId" value={String(bankId ?? '')}
                                     disabled={sending} onChange={value => setBankId(Number(value) || null)} options={[{
                            value: '',
                            label: 'Seleziona banca'
                        }, ...banks.map(bank => ({value: bank.id, label: bank.name, icon: bank.icon ?? undefined}))]}/>}
                    <div className="cash-register-tax-summary">{[...taxGroups].map(([label, amount]) => <span
                        className="badge" key={label}>{label} · {euro(amount)}</span>)}</div>
                    <ul className="cash-register-line-list" aria-label="Importi inseriti">{lines.map((line, index) =>
                        <li key={index}>
                            <span>{index + 1}. {line.isFiscal ? `Rep. ${line.vatRate}%` : 'Non fiscale'}{line.description ? ` · ${line.description}` : ''}</span><strong>{euro(line.amount)}</strong>
                        </li>)}</ul>
                    {description.trim() && <p className="text-pre">{description}</p>}
                    <dl className="cash-register-confirm-breakdown" aria-label="Riepilogo fiscalità">
                        <div>
                            <dt>IVA</dt>
                            <dd>{euro(summary.receiptVatAmount)}</dd>
                        </div>
                        {/*<div><dt>Fiscale</dt><dd>{euro(summary.receiptFiscalAmount)}</dd></div>*/}
                        {/*<div><dt>Non fiscale</dt><dd>{euro(Math.round((summary.amount - summary.receiptFiscalAmount) * 100) / 100)}</dd></div>*/}
                    </dl>
                    {notice?.tone === 'error' && <p className="form-error" role="alert">{notice.text}</p>}
                    <button ref={cancelRef} className="btn btn-md btn-link text-critical" type="button" disabled={sending}
                            onFocus={() => setConfirmationAction('cancel')}
                            onClick={closeConfirmation}>Annulla e torna al registratore
                    </button>
                    <button ref={submitRef} className="btn btn-md btn-success cash-register-confirm-submit"
                            type="button" onFocus={() => setConfirmationAction('submit')}
                            disabled={sending || !creditDate || !categoryId || !channelId || mode === 'edit' && !bankId}
                            onClick={() => void submitReceipt()}><span className="btn-icon"
                                                                       aria-hidden="true">✓</span>{sending ? 'Salvataggio…' : mode === 'edit' ? 'SALVA MODIFICHE' : 'INCASSA'}
                    </button>
                </div>
            </section>
        </div>, document.body)}
    </main>;
}
