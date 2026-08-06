'use client';

import {FormEvent, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import MobileFormStickyActions from '@/components/MobileFormStickyActions';
import {CurrencyInput} from '@/components/CurrencyInput';
import {applyCurrencyInputKeyWithState, formatCurrencyInput} from '@/lib/currency-input';
import {DateField, FormField, SelectField} from '@/components/FormControls';
import CustomerAutocomplete from '@/components/CustomerAutocomplete';
import DescriptionAutocomplete from '@/components/DescriptionAutocomplete';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {dateInputInTimeZone, zonedCalendarParts} from '@/lib/company-time';

type Option = { id: number; name: string };
type Customer = { id: number; businessName: string; alias?: string | null; systemRole?: string | null };
type Initial = Record<string, any>;
const labels = ['Ricorrenza', 'Dettagli', 'Importo', 'Accredito', 'Riepilogo'];
const monthOptions = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function RecurringIncomeForm({
                                                action,
                                                cancelHref,
                                                onCancel,
                                                onSwitchToSingle,
                                                channels,
                                                customers,
                                                methods,
                                                banks,
                                                initial,
                                                editId
                                            }: {
    action: string;
    cancelHref: string;
    onCancel?: () => void;
    onSwitchToSingle?: () => void;
    channels: Option[];
    customers: Customer[];
    methods: Option[];
    banks: Option[];
    initial?: Initial;
    editId?: number;
}) {
    const timeZone = useCompanyTimeZone();
    const today = dateInputInTimeZone(timeZone);
    const currentParts = zonedCalendarParts(new Date(), timeZone);
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const amountRef = useRef<HTMLInputElement>(null);
    const amountKeyStateRef = useRef<{ separatorDigits: 0 | 1 | null }>({separatorDigits: null});
    const [step, setStep] = useState(1);
    const [automatic, setAutomatic] = useState(Boolean(initial?.isAutomaticCredit));
    const [cadence, setCadence] = useState(initial?.cadence ?? 'MONTHLY');
    const [billingMode, setBillingMode] = useState(initial?.billingPeriodMode ?? 'SAME_MONTH');
    const [fiscal, setFiscal] = useState(initial?.isFiscal ?? true);
    const [vatRate, setVatRate] = useState(initial?.vatRate?.toString?.() ?? '22');
    const [amount, setAmount] = useState(formatCurrencyInput(initial?.amount?.toString?.() ?? ''));
    const [startDate, setStartDate] = useState(initial?.startDate ? new Date(initial.startDate).toISOString().slice(0, 10) : today);
    const [hasEndDate, setHasEndDate] = useState(Boolean(initial?.endDate));
    const [endDate, setEndDate] = useState(initial?.endDate ? new Date(initial.endDate).toISOString().slice(0, 10) : '');
    const [creditDay, setCreditDay] = useState(String(initial?.creditDay ?? currentParts?.day ?? 1));
    const [creditMonth, setCreditMonth] = useState(String(initial?.creditMonth ?? currentParts?.month ?? 1));
    const [channelId, setChannelId] = useState(String(initial?.salesChannelId ?? channels[0]?.id ?? ''));
    const [methodId, setMethodId] = useState(String(initial?.paymentMethodId ?? ''));
    const [bankId, setBankId] = useState(String(initial?.bankId ?? ''));
    const [billingMonth, setBillingMonth] = useState(String(initial?.billingMonth ?? ''));
    const [customerName, setCustomerName] = useState(customers.find(customer => customer.id === initial?.customerId)?.businessName ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    function goNext() {
        if (step === 3) {
            const value = Number(amount.replace(/\./g, '').replace(',', '.'));
            const valid = Number.isFinite(value) && value > 0;
            amountRef.current?.setCustomValidity(valid ? '' : 'Inserisci un importo maggiore di zero.');
            if (!valid) {
                amountRef.current?.reportValidity();
                amountRef.current?.focus();
                return;
            }
        }
        const form = formRef.current;
        const section = form?.querySelector<HTMLElement>(`.recurring-income-step-${step}`);
        const invalid = section ? Array.from(section.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')).find(control => !control.checkValidity()) : null;
        if (invalid) {
            invalid.reportValidity();
            invalid.focus();
            return;
        }
        setStep(value => Math.min(5, value + 1));
    }

    function appendAmountKey(key: string) {
        amountRef.current?.setCustomValidity('');
        setAmount(current => applyCurrencyInputKeyWithState(current, key, amountKeyStateRef.current));
        requestAnimationFrame(() => amountRef.current?.focus({preventScroll: true}));
    }

    const amountValue = Number(amount.replace(/\./g, '').replace(',', '.')) || 0;
    const formatEuro = (value: number) => new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);

    async function submit(event: FormEvent<HTMLFormElement>) {
        if (!(amountValue > 0)) {
            event.preventDefault();
            setStep(3);
            amountRef.current?.setCustomValidity('Inserisci un importo maggiore di zero.');
            requestAnimationFrame(() => {
                amountRef.current?.reportValidity();
                amountRef.current?.focus();
            });
            return;
        }
        if (!editId) return;
        event.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const response = await fetch(`/api/recurring-incomes/${editId}`, {
                method: 'PUT',
                body: new FormData(event.currentTarget)
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error ?? 'Salvataggio non riuscito');
            }
            router.push(`${cancelHref}${cancelHref.includes('?') ? '&' : '?'}saved=updated`);
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Salvataggio non riuscito');
        } finally {
            setSubmitting(false);
        }
    }

    return <form ref={formRef} className={`card form income-form app-record-form recurring-record-form recurring-income-form app-form-wizard income-mobile-wizard recurring-form-wizard app-form-wizard-current-${step}`} action={editId ? undefined : action} method="post" onSubmit={submit}>
        <div className="app-form-wizard-header full">
            <div className="app-form-wizard-heading">
                <span>Passaggio {step} di 5</span><strong>{labels[step - 1]}</strong></div>
            <div className="app-form-wizard-progress"><span style={{width: `${step / 5 * 100}%`}}/></div>
        </div>
        <div className="entry-type-choice full app-form-wizard-step app-form-wizard-step-1">
            <span className="entry-type-choice-title">Tipo di incasso</span>
            <div className="entry-type-choice-grid" role="radiogroup" aria-label="Tipo di incasso">
                <button type="button" role="radio" aria-checked="false" disabled={!onSwitchToSingle} onClick={onSwitchToSingle}>
                    <span aria-hidden="true">●</span><strong>Incasso<br/>singolo</strong><small>Entrata occasionale</small>
                </button>
                <button type="button" className="is-selected" role="radio" aria-checked="true">
                    <span aria-hidden="true">↻</span><strong>Entrata<br/>ricorrente</strong><small>Entrata periodica</small>
                </button>
                <button type="button" role="radio" aria-checked="false" onClick={() => window.location.assign('/incomes/cash-register')}>
                    <span aria-hidden="true">🧮</span><strong>Incasso da Banco</strong><small>Inserimento scontrini</small>
                </button>
            </div>
        </div>

        <details className="form-section full recurring-form-section recurring-document-section recurring-dates-section recurring-income-step-1 app-form-wizard-step app-form-wizard-step-1" open>
            <summary><span>Ricorrenza e scadenza</span><small>Data iniziale, frequenza e giorno previsto</small>
            </summary>
            <div className="form-section-grid recurring-form-section-grid">
                <DateField label="Data iniziale" name="startDate" value={startDate} onChange={setStartDate} required/>
                <SelectField label="Frequenza" icon="↻" name="cadence" value={cadence} onChange={setCadence} required options={[{
                    value: 'MONTHLY',
                    label: 'Ogni mese'
                }, {value: 'EVERY_2_MONTHS', label: 'Ogni 2 mesi'}, {
                    value: 'EVERY_3_MONTHS',
                    label: 'Ogni 3 mesi'
                }, {value: 'EVERY_6_MONTHS', label: 'Ogni 6 mesi'}, {
                    value: 'YEARLY',
                    label: 'Annuale'
                }, {value: 'EVERY_2_YEARS', label: 'Ogni 2 anni'}]}/>
                <FormField label="Giorno accredito" icon="№"><input type="number" name="creditDay" min="1" max="31" value={creditDay} onChange={event => setCreditDay(event.currentTarget.value)} required/></FormField>
                {['YEARLY', 'EVERY_2_YEARS'].includes(cadence) ?
                    <SelectField label="Mese accredito" icon="▦" name="creditMonth" value={creditMonth} onChange={setCreditMonth} required options={monthOptions.map((label, index) => ({
                        value: index + 1,
                        label
                    }))}/> : null}
                <div className="switch-toggle-field switch-inline wide push-down">
                    <div className="switch-toggle-field-label app-form-field-label">
                        <span className="app-form-field-icon" aria-hidden="true">◷</span><span className="app-form-label">Imposta scadenza</span>
                    </div>
                    <label className="switch"><input type="checkbox" checked={hasEndDate} onChange={event => setHasEndDate(event.currentTarget.checked)}/><span className="slider"/></label>
                </div>
                {hasEndDate ?
                    <DateField label="Data di fine" name="endDate" value={endDate} onChange={setEndDate} min={startDate} required/> : null}
            </div>
        </details>

        <details className="form-section full recurring-form-section income-form-section income-document-section recurring-document-section recurring-details-section recurring-income-step-2 app-form-wizard-step app-form-wizard-step-2" open>
            <summary><span>Cliente e dettagli</span><small>Cliente, canale e descrizione</small></summary>
            <div className="form-section-grid recurring-form-section-grid">
                <CustomerAutocomplete customers={customers} initialCustomerId={initial?.customerId} onValueChange={setCustomerName} wizardStepClass="app-form-wizard-step app-form-wizard-step-2"/>
                <SelectField label="Canale di vendita" icon="▣" name="salesChannelId" value={channelId} onChange={setChannelId} required options={channels.map(option => ({
                    value: option.id,
                    label: option.name
                }))}/>
                <DescriptionAutocomplete endpoint="/api/income-descriptions" label="Descrizione" placeholder="Descrizione dell'incasso" initialValue={initial?.description ?? ''} onValueChange={setDescription} required className="full"/>
            </div>
        </details>

        <details className="form-section full recurring-form-section income-form-section recurring-document-section income-amount-section recurring-income-step-3 app-form-wizard-step app-form-wizard-step-3" open>
            <summary><span>Importo e IVA</span><small>Fiscalità, importo e aliquota IVA</small></summary>
            <div className="form-section-grid recurring-form-section-grid">
                <div className="amount-vat-row full recurring-wizard-amount">
                    <div className="recurring-wizard-amount-entry full">
                        <div className="switch-toggle-field recurring-switch-control recurring-fiscal-switch">
                            <div className="switch-toggle-field-label app-form-field-label">
                                <span className="app-form-field-icon">⇆</span><span className="app-form-label">Fiscale</span>
                            </div>
                            <input type="hidden" name="isFiscal" value="false"/><label className="switch"><input type="checkbox" name="isFiscal" value="true" checked={fiscal} onChange={event => setFiscal(event.currentTarget.checked)}/><span className="slider"/></label>
                        </div>
                        <div className="recurring-amount-control flex-grow">
                            <label className="recurring-wizard-amount-field"><span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">€</span><span>Importo IVA inclusa</span></span>
                                <div>
                                    <div className="money-input">
                                        <span>€</span><CurrencyInput ref={amountRef} value={amount} onValueChange={value => {
                                        amountRef.current?.setCustomValidity('');
                                        setAmount(value);
                                    }} required aria-label="Importo entrata ricorrente"/></div>
                                    <input type="hidden" name="amount" value={amount.replace(/\./g, '').replace(',', '.')}/>
                                </div>
                            </label>
                            <div className="app-vat-rate-buttons recurring-vat-buttons-desktop vat-buttons-desktop" aria-label="Aliquota IVA">{['0', '4', '10', '22'].map(value =>
                                <button type="button" key={value} className={vatRate === value ? 'is-selected' : ''} disabled={!fiscal} onClick={() => setVatRate(value)}>{value}%</button>)}</div>
                        </div>
                    </div>
                    <div className="app-vat-rate-buttons recurring-vat-buttons-mobile vat-buttons-mobile" aria-label="Aliquota IVA">{['0', '4', '10', '22'].map(value =>
                        <button type="button" key={value} className={vatRate === value ? 'is-selected' : ''} disabled={!fiscal} onMouseDown={event => event.preventDefault()} onClick={() => setVatRate(value)}>{value}%</button>)}</div>
                    <input type="hidden" name="vatRate" value={fiscal ? vatRate : '0'}/>
                    <div className="app-amount-keypad full" aria-label="Tastiera numerica">{['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace'].map(key =>
                        <button type="button" key={key} aria-label={key === 'backspace' ? 'Cancella ultima cifra' : key} onMouseDown={event => event.preventDefault()} onClick={() => appendAmountKey(key)}>{key === 'backspace' ? '⌫' : key}</button>)}</div>
                </div>
            </div>
        </details>

        <details className="form-section full recurring-form-section income-form-section income-payment-section recurring-payment-section recurring-income-step-4 app-form-wizard-step app-form-wizard-step-4" open>
            <summary><span>Accredito</span><small>Automazione, metodo, banca e competenza</small></summary>
            <div className="form-section-grid recurring-form-section-grid">
                <SelectField label="Periodo di competenza" icon="▦" name="billingPeriodMode" value={billingMode} onChange={setBillingMode} options={[{
                    value: 'SAME_MONTH',
                    label: 'Stesso mese'
                }, {value: 'NEXT_MONTH', label: 'Mese successivo'}, {value: 'CUSTOM_MONTH', label: 'Mese specifico'}]}/>
                {billingMode === 'CUSTOM_MONTH' ?
                    <SelectField label="Mese competenza" icon="▦" name="billingMonth" value={billingMonth} onChange={setBillingMonth} required options={[{
                        value: '',
                        label: 'Seleziona mese',
                        disabled: true
                    }, ...monthOptions.map((label, index) => ({value: index + 1, label}))]}/> : null}
                <div className="app-form-field switch-toggle-field recurring-accrual-toggle switch-inline wide push-down">
                    <div className="switch-toggle-field-label app-form-field-label">
                        <span className="app-form-field-icon">⇆</span><span className="app-form-label">Accredito automatico</span>
                    </div>
                    <label className="switch"><input type="checkbox" name="isAutomaticCredit" checked={automatic} onChange={e => setAutomatic(e.target.checked)}/><span className="slider"/></label>
                </div>
                <SelectField label="Metodo di accredito" icon="▣" name="paymentMethodId" value={methodId} onChange={setMethodId} disabled={!automatic} required={automatic} options={[{
                    value: '',
                    label: 'Seleziona metodo'
                }, ...methods.map(x => ({value: x.id, label: x.name}))]}/>
                <SelectField label="Banca" icon="▥" name="bankId" value={bankId} onChange={setBankId} disabled={!automatic} required={automatic} options={[{
                    value: '',
                    label: 'Seleziona banca'
                }, ...banks.map(x => ({value: x.id, label: x.name}))]}/>
            </div>
        </details>

        <section className="expense-review-step record-review-step full recurring-income-step-5 app-form-wizard-step app-form-wizard-step-5" aria-label="Riepilogo entrata ricorrente">
            <div className="record-review-heading">
                <div><span className="record-review-kicker">Controlla prima di salvare</span>
                    <h3>Riepilogo dell’entrata ricorrente</h3></div>
                <strong>{formatEuro(amountValue)}</strong>
            </div>
            <div className="record-review-grid">
                        <div className="record-review-item"><i aria-hidden="true">↻</i><span>Ricorrenza<strong>{({
                            MONTHLY: 'Ogni mese',
                            EVERY_2_MONTHS: 'Ogni 2 mesi',
                            EVERY_3_MONTHS: 'Ogni 3 mesi',
                            EVERY_6_MONTHS: 'Ogni 6 mesi',
                            YEARLY: 'Annuale',
                            EVERY_2_YEARS: 'Ogni 2 anni'
                        } as Record<string, string>)[cadence]} · giorno {creditDay}</strong></span></div>
                        <div className="record-review-item">
                            <i aria-hidden="true">◷</i><span>Data iniziale<strong>{startDate ? new Date(`${startDate}T12:00:00`).toLocaleDateString('it-IT') : 'Non indicata'}</strong></span>
                        </div>
                        <div className="record-review-item">
                            <i aria-hidden="true">⌛</i><span>Data di fine<strong>{hasEndDate && endDate ? new Date(`${endDate}T12:00:00`).toLocaleDateString('it-IT') : 'Senza scadenza'}</strong></span>
                        </div>
                        <div className="record-review-item wide">
                            <i aria-hidden="true">◎</i><span>Cliente<strong>{customerName || 'Non indicato'}</strong></span>
                        </div>
                        <div className="record-review-item wide">
                            <i aria-hidden="true">≡</i><span>Descrizione<strong>{description || 'Non indicata'}</strong></span>
                        </div>
                        <div className="record-review-item">
                            <i aria-hidden="true">▤</i><span>Fiscale / IVA<strong>{fiscal ? `Sì · ${vatRate}%` : 'No · 0%'}</strong></span>
                        </div>
                        <div className="record-review-item">
                            <i aria-hidden="true">▦</i><span>Competenza<strong>{billingMode === 'SAME_MONTH' ? 'Stesso mese' : billingMode === 'NEXT_MONTH' ? 'Mese successivo' : monthOptions[Number(billingMonth) - 1] || 'Mese specifico'}</strong></span>
                        </div>
                        <div className="record-review-item wide">
                            <i aria-hidden="true">€</i><span>Accredito<strong>{automatic ? `${methods.find(method => String(method.id) === methodId)?.name ?? 'Metodo non indicato'} · ${banks.find(bank => String(bank.id) === bankId)?.name ?? 'Banca non indicata'}` : 'Manuale'}</strong></span>
                        </div>
            </div>
            <label className="card full expense-review-notes expense-review-notes-mobile">
                Note
                <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ''}/>
            </label>
            {editId ? <div className="switch-toggle-field">
                <div className="switch-toggle-field-label"><label>Regola attiva</label></div>
                <label className="switch"><input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true}/><span className="slider"/></label>
            </div> : null}
        </section>

        <MobileFormStickyActions currentStep={step} submitStep={5} onBack={() => setStep(value => Math.max(1, value - 1))} onNext={goNext} onCancel={onCancel} cancelHref={cancelHref} submitLabel="Salva entrata" isSubmitting={submitting} error={error}/>
        <div className="actions-row full form-actions-row form-sticky-actions">{error ?
            <p className="inline-warning full">{error}</p> : null}
            <button className="btn btn-md btn-primary" type="submit" disabled={submitting}>✓ {submitting ? 'Salvataggio...' : 'Salva entrata'}</button>
            {onCancel ? <button className="btn btn-md btn-default" type="button" onClick={onCancel}>× Annulla</button> :
                <a className="btn btn-md btn-default" href={cancelHref}>× Annulla</a>}</div>
    </form>;
}
