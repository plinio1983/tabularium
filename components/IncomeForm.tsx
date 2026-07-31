"use client";

import {type FormEvent, useEffect, useMemo, useRef, useState} from "react";
import CustomerAutocomplete from '@/components/CustomerAutocomplete';
import {CurrencyInput} from "@/components/CurrencyInput";
import {applyCurrencyInputKeyWithState, formatCurrencyInput} from "@/lib/currency-input";
import {DateField, MonthField, SelectField} from "@/components/FormControls";
import DescriptionAutocomplete from "@/components/DescriptionAutocomplete";
import MobileFormStickyActions from "@/components/MobileFormStickyActions";

type InitialIncome = {
    id?: number;
    customerId?: number | null;
    salesChannelId?: number;
    orderDate?: string | Date | null;
    description?: string | null;
    amount?: string | number | { toString(): string } | null;
    paymentMethodId?: number | null;
    creditBankId?: number | null;
    creditDate?: string | Date | null;
    isCredited?: boolean;
    billingMonth?: number | null;
    billingYear?: number | null;
    isFiscal?: boolean;
    invoiceStatus?: string | null;
    vatRate?: string | number | { toString(): string } | null;
    notes?: string | null;
};

type Option = { id: number; name: string; icon?: string | null; isFallback?: boolean | null; isPrimary?: boolean };
type PaymentMethodOption = Option & { kind?: string; isIncomeDefault?: boolean };
type IncomeEntityOption = { id: number; code: string; name: string; icon?: string | null; isDefault?: boolean; isFallback?: boolean };
type CustomerOption = { id: number; businessName: string; alias?: string | null; systemRole?: string | null };

type Props = {
    initialIncome?: InitialIncome;
    action?: string;
    title?: string;
    submitLabel?: string;
    onCancel?: () => void;
    cancelHref?: string;
    banks: Option[];
    paymentMethods: PaymentMethodOption[];
    salesChannels: IncomeEntityOption[];
    customers: CustomerOption[];
};

const today = new Date().toISOString().slice(0, 10);
const currentMonth = new Date().toISOString().slice(0, 7);
const vatRates = ["0", "4", "10", "22"];

function toDateInput(value?: string | Date | null) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function toMonthInput(income?: InitialIncome) {
    if (income?.billingMonth && income?.billingYear) {
        return `${income.billingYear}-${String(income.billingMonth).padStart(2, "0")}`;
    }
    return currentMonth;
}

function normalizeMoney(value: unknown) {
    if (value === null || value === undefined) return "";
    return String(value).replace(",", ".");
}

function formatEuro(value: number) {
    return new Intl.NumberFormat("it-IT", {style: "currency", currency: "EUR"}).format(value || 0);
}

function MoneyInput({inputRef, ...props}: React.ComponentProps<typeof CurrencyInput> & {
    inputRef?: React.RefObject<HTMLInputElement | null>
}) {
    return (
        <div className="money-input">
            <span>€</span>
            <CurrencyInput ref={inputRef} {...props}/>
        </div>
    );
}

function findOptionId(options: Option[], id?: number | null) {
    if (id && options.some(option => option.id === id)) return String(id);
    return "";
}

function isCashMethod(method?: Option) {
    return method?.name.trim().toLowerCase() === "cash";
}

export default function IncomeForm({
                                       initialIncome,
                                       action = "/api/incomes",
                                       title = "Nuovo incasso",
                                       submitLabel = "Salva incasso",
                                       onCancel,
                                       cancelHref,
                                       banks,
                                       paymentMethods,
                                       salesChannels,
                                       customers,
                                   }: Props) {
    const cashBank = banks.find(bank => bank.isFallback) ?? banks.find(bank => bank.name.trim().toLowerCase() === "cassa");
    const primaryBank = banks.find(bank => bank.isPrimary);
    const defaultBank = primaryBank ?? banks.find(bank => !bank.isFallback) ?? banks[0];
    const defaultPaymentMethod = paymentMethods.find(method => method.isIncomeDefault) ?? paymentMethods[0];
    const initialPaymentMethodId = findOptionId(paymentMethods, initialIncome?.paymentMethodId) || (defaultPaymentMethod ? String(defaultPaymentMethod.id) : "");
    const initialCreditBankId = findOptionId(banks, initialIncome?.creditBankId) || (defaultBank ? String(defaultBank.id) : "");
    const defaultSalesChannel = salesChannels.find(channel => channel.isDefault)
        ?? salesChannels.find(channel => !channel.isFallback)
        ?? salesChannels.find(channel => channel.isFallback);
    const initialSalesChannelId = initialIncome?.salesChannelId ? String(initialIncome.salesChannelId) : String(defaultSalesChannel?.id ?? "");
    const [amount, setAmount] = useState(normalizeMoney(initialIncome?.amount).replace(".", ","));
    const [salesChannelId, setSalesChannelId] = useState(initialSalesChannelId);
    const [orderDate, setOrderDate] = useState(toDateInput(initialIncome?.orderDate) || today);
    const [creditDate, setCreditDate] = useState(toDateInput(initialIncome?.creditDate) || today);
    const [billingPeriod, setBillingPeriod] = useState(toMonthInput(initialIncome));
    const [description, setDescription] = useState(initialIncome?.description ?? "");
    const [notes, setNotes] = useState(initialIncome?.notes ?? "");
    const [customerName, setCustomerName] = useState(
        customers.find(customer => customer.id === initialIncome?.customerId)?.businessName ?? "",
    );
    const [paymentMethodId, setPaymentMethodId] = useState(initialPaymentMethodId);
    const [creditBankId, setCreditBankId] = useState(initialCreditBankId);
    const [isCredited, setIsCredited] = useState(initialIncome?.isCredited ?? true);
    const [isFiscal, setIsFiscal] = useState(initialIncome?.isFiscal ?? true);
    const [invoiceStatus, setInvoiceStatus] = useState(initialIncome?.invoiceStatus ?? "NON_INVIATA");
    const [vatRate, setVatRate] = useState(normalizeMoney(initialIncome?.vatRate) || "22");
    const [mobileStep, setMobileStep] = useState(1);
    const formRef = useRef<HTMLFormElement>(null);
    const amountRef = useRef<HTMLInputElement>(null);
    const amountKeyStateRef = useRef<{ separatorDigits: 0 | 1 | null }>({separatorDigits: null});
    const normalizedAmount = amount.replace(",", ".");
    const amountValue = Number(normalizedAmount || 0);
    const activeVatRate = isFiscal ? Number(vatRate || 0) : 0;
    const netAmount = useMemo(() => activeVatRate > 0 ? amountValue / (1 + activeVatRate / 100) : amountValue, [amountValue, activeVatRate]);

    const selectedPaymentMethod = paymentMethods.find(method => String(method.id) === paymentMethodId);
    const cashPaymentSelected = isCashMethod(selectedPaymentMethod);
    const previousCashSelection = useRef(cashPaymentSelected);

    useEffect(() => {
        if (cashPaymentSelected && cashBank && creditBankId !== String(cashBank.id)) {
            setCreditBankId(String(cashBank.id));
        } else if (!cashPaymentSelected && previousCashSelection.current && primaryBank) {
            setCreditBankId(String(primaryBank.id));
        }
        previousCashSelection.current = cashPaymentSelected;
    }, [cashPaymentSelected, cashBank, primaryBank, creditBankId]);

    function toggleFiscal(nextValue: boolean) {
        setIsFiscal(nextValue);
        if (!nextValue) {
            setVatRate("0");
            setInvoiceStatus("NON_INVIATA");
        } else if (vatRate === "0") setVatRate("22");
    }

    function toggleInvoiceIssued(nextValue: boolean) {
        if (nextValue) {
            toggleFiscal(true);
            setInvoiceStatus("EMESSA");
        } else {
            setInvoiceStatus("NON_INVIATA");
        }
    }

    function handleAmountChange(value: string) {
        amountRef.current?.setCustomValidity("");
        setAmount(formatCurrencyInput(value));
    }

    function appendAmountKey(key: string) {
        amountRef.current?.setCustomValidity("");
        setAmount(current => applyCurrencyInputKeyWithState(current, key, amountKeyStateRef.current));
        focusAmount();
    }

    function focusAmount() {
        window.requestAnimationFrame(() => amountRef.current?.focus({preventScroll: true}));
    }

    useEffect(() => {
        if (mobileStep === 2 && window.matchMedia("(max-width: 900px)").matches) focusAmount();
    }, [mobileStep]);

    function validateMobileStep() {
        if (mobileStep === 2) {
            const amountIsValid = Number.isFinite(amountValue) && amountValue > 0;
            amountRef.current?.setCustomValidity(amountIsValid ? "" : "Inserisci un importo maggiore di zero.");
            if (!amountIsValid) {
                amountRef.current?.reportValidity();
                focusAmount();
                return false;
            }
        }
        const elements = Array.from(formRef.current?.querySelectorAll<HTMLElement>(`.expense-wizard-step-${mobileStep}`) ?? []);
        const fields = elements.flatMap(element =>
            Array.from(element.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")),
        );
        const invalid = fields.find(field => !field.disabled && !field.checkValidity());
        if (!invalid) return true;
        invalid.reportValidity();
        invalid.focus();
        return false;
    }

    function goToMobileStep(step: number) {
        setMobileStep(Math.max(1, Math.min(6, step)));
        window.requestAnimationFrame(() => formRef.current?.scrollIntoView({behavior: "smooth", block: "start"}));
    }

    function nextMobileStep() {
        if (validateMobileStep()) goToMobileStep(mobileStep + 1);
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        if (window.matchMedia("(max-width: 900px)").matches && mobileStep < 6) {
            event.preventDefault();
            nextMobileStep();
        }
    }

    return (
        <form ref={formRef} className={`card form income-form expense-form expense-mobile-wizard income-mobile-wizard expense-mobile-step-${mobileStep}`} action={action} method="post" onSubmit={handleSubmit}>
            <div className="expense-wizard-header full">
                <div className="expense-wizard-heading">
                    <span>Passaggio {mobileStep} di 6</span>
                    <strong>{["Vendita", "Importo", "Cliente", "Accredito", "Fattura", "Riepilogo"][mobileStep - 1]}</strong>
                </div>
                <div className="expense-wizard-progress" aria-label={`Passaggio ${mobileStep} di 6`}>
                    <span style={{width: `${mobileStep / 6 * 100}%`}}/>
                </div>
            </div>
            {/*<h2 className="full">{title}</h2>*/}

            <div className="expense-type-choice full expense-wizard-step expense-wizard-step-1">
                <span className="expense-type-choice-title">Tipo di incasso</span>
                <div className="expense-type-choice-grid" role="radiogroup" aria-label="Tipo di incasso">
                    <button type="button" className="is-selected" role="radio" aria-checked="true">
                        <span aria-hidden="true">●</span>
                        <strong>Incasso <br/>singolo</strong>
                        <small>Entrata occasionale</small>
                    </button>
                    <button type="button" role="radio" aria-checked="false" disabled
                            title="Gli incassi ricorrenti non sono ancora disponibili">
                        <span aria-hidden="true">↻</span>
                        <strong>Entrata <br/>ricorrente</strong>
                        <small>Prossimamente</small>
                    </button>
                    <button type="button" role="radio" aria-checked="false" disabled={Boolean(initialIncome?.id)}
                            onClick={() => window.location.assign("/incomes/cash-register")}>
                        <span aria-hidden="true">🧮</span>
                        <strong>Incasso da Banco</strong>
                        <small>Inserimento scontrini</small>
                    </button>
                </div>
            </div>

            <details className="form-section full income-form-section income-document-section" open>
                <summary>
                    <span>Documento</span>
                    <small>Dati principali dell'incasso</small>
                </summary>
                <div className="form-section-grid income-form-section-grid">
                    <SelectField className="expense-wizard-step expense-wizard-step-1" label="Canale di vendita" icon="▣" name="salesChannelId" value={salesChannelId} onChange={setSalesChannelId} required options={salesChannels.map(option => ({
                        value: option.id,
                        label: `${option.icon ?? "•"} ${option.name}`
                    }))}/>

                    <DateField className="expense-wizard-step expense-wizard-step-1" label="Data ordine" name="orderDate" value={orderDate} onChange={setOrderDate} required/>

                    <CustomerAutocomplete customers={customers} initialCustomerId={initialIncome?.customerId} onValueChange={setCustomerName}/>

                    <DescriptionAutocomplete endpoint="/api/income-descriptions" label="Descrizione"
                                             placeholder="Descrizione dell'incasso"
                                             initialValue={initialIncome?.description ?? ""}
                                             onValueChange={setDescription}
                                             className="full expense-wizard-step expense-wizard-step-3"/>

                </div>
            </details>

            <details className="form-section full income-form-section income-amount-section" open>
                <summary>
                    <span>Importo e IVA</span>
                    <small>Fiscalità, importo e aliquota IVA</small>
                </summary>
                <div className="form-section-grid income-form-section-grid">
                    <div className="amount-vat-row full income-amount-vat-row expense-wizard-step expense-wizard-step-2 income-wizard-amount">
                        <div className="income-wizard-amount-entry">
                            <div className="app-form-field-label toggle-field switch-toggle-field income-switch-control income-fiscal-switch">
                                <div className="switch-toggle-field-label gap-4">
                                    <span className="app-form-field-icon">⇆</span>
                                    <span className="app-form-label">Fiscale</span>
                                </div>
                                <input type="hidden" name="isFiscal" value="false"/>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        name="isFiscal"
                                        value="true"
                                        checked={isFiscal}
                                        onChange={(event) => {
                                            toggleFiscal(event.currentTarget.checked);
                                            focusAmount();
                                        }}
                                    />
                                    <span className="slider"/>
                                    {/*<span className="text-muted">{isFiscal ? "Fiscale" : "Non fiscale"}</span>*/}
                                </label>
                            </div>
                            <div className="income-amount-control">
                                <div className="income-amount-vat-excluded" aria-live="polite">
                                    {/*<small className="text-muted">I.E.</small>*/}
                                    <strong>{formatEuro(netAmount)}</strong>
                                </div>
                                <label className="income-amount-field">
                                    <div>Importo <span className="hidden-sp">IVA inclusa</span></div>
                                    <div className="income-amount-row">
                                        <MoneyInput inputRef={amountRef} required value={amount} onValueChange={handleAmountChange}/>
                                        <input type="hidden" name="amount" value={normalizedAmount}/>
                                    </div>
                                </label>
                                <div className="expense-wizard-vat-buttons income-vat-buttons align-center" aria-label="Aliquota IVA">
                                    <div className="hidden-sp">
                                        <label className="ml-12">IVA</label>
                                    </div>
                                    {vatRates.map(value =>
                                        <button type="button" key={value} className={vatRate === value ? "is-selected" : ""} disabled={!isFiscal} onMouseDown={event => event.preventDefault()} onClick={() => {
                                            setVatRate(value);
                                            focusAmount();
                                        }}>{value}%</button>)}
                                </div>
                            </div>
                        </div>

                        <input type="hidden" name="vatRate" value={isFiscal ? vatRate : "0"}/>

                        <div className="expense-wizard-keypad full" aria-label="Tastiera numerica">
                            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "backspace"].map(key =>
                                <button type="button" key={key} aria-label={key === "backspace" ? "Cancella ultima cifra" : key} onMouseDown={event => event.preventDefault()} onClick={() => appendAmountKey(key)}>{key === "backspace" ? "⌫" : key}</button>)}
                        </div>

                    </div>
                </div>
            </details>

            <details className="form-section full income-form-section income-payment-section expense-wizard-step expense-wizard-step-4" open>
                <summary>
                    <span>Pagamento</span>
                    <small>Metodo, accredito e conto di destinazione</small>
                </summary>
                <div className="form-section-grid income-form-section-grid">

                    <div className="app-form-field-label toggle-field-label switch-toggle-field income-switch-control income-form-section-credit">
                        <div className="switch-toggle-field-label">
                            <span className="app-form-field-icon">⇆</span>
                            <span className="app-form-label">Accreditato</span>
                        </div>
                        <input type="hidden" name="isCredited" value="false"/>
                        <label className="switch">
                            <input
                                type="checkbox"
                                name="isCredited"
                                value="true"
                                checked={isCredited}
                                onChange={(event) => setIsCredited(event.currentTarget.checked)}
                            />
                            <span className="slider"/>
                            <small className="text-muted">{isCredited ? "Accreditato" : "Non accreditato"}</small>
                        </label>
                    </div>

                    <DateField className="income-payment-field-wide" label="Data accredito" name="creditDate" value={creditDate} onChange={setCreditDate} required/>

                    <SelectField className="income-payment-field-wide" label="Metodo di accredito" icon="▣" name="paymentMethodId" value={paymentMethodId} onChange={setPaymentMethodId} required options={paymentMethods.map(method => ({
                        value: method.id,
                        label: `${method.icon ?? "•"} ${method.name}`
                    }))}/>

                    <SelectField className="income-payment-field-wide" label="Canale accredito" icon="▥" name="creditBankId" value={cashPaymentSelected && cashBank ? String(cashBank.id) : creditBankId} onChange={setCreditBankId} disabled={cashPaymentSelected} required options={banks.map(bank => ({
                        value: bank.id,
                        label: `${bank.icon ?? "•"} ${bank.name}`
                    }))}/>
                    {cashPaymentSelected && cashBank ?
                        <input type="hidden" name="creditBankId" value={cashBank.id}/> : null}

                </div>
            </details>

            <details className="form-section full income-form-section income-fiscal-section expense-wizard-step expense-wizard-step-5" open>
                <summary>
                    <span>Fattura</span>
                    <small>Stato fattura e periodo contabile</small>
                </summary>
                <div className="form-section-grid income-form-section-grid income-form-section-fiscal">
                    <MonthField label="Periodo contabile" name="billingPeriod" value={billingPeriod} onChange={setBillingPeriod} required/>
                    <div className="app-form-field-label toggle-field switch-toggle-field income-switch-control income-form-section-invoice-issued">

                        <div className="switch-toggle-field-label">
                            <span className="app-form-field-icon">⇆</span>
                            <span className="app-form-label">Fattura emessa</span>
                        </div>
                        {/*<label className="app-form-label">Fattura emessa</label>*/}
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={isFiscal && invoiceStatus === "EMESSA"}
                                onChange={(event) => toggleInvoiceIssued(event.currentTarget.checked)}
                            />
                            <span className="slider"/>
                            <small className="text-muted">{isFiscal && invoiceStatus === "EMESSA" ? "Emessa" : invoiceStatus === "PARZIALE" ? "Parziale" : "Non inviata"}</small>
                        </label>
                    </div>
                    {/*<div className="toggle-field-wrap">*/}
                    <div>
                        <SelectField label="Stato fattura" icon="▤" name="invoiceStatus" value={invoiceStatus} disabled={!isFiscal} onChange={setInvoiceStatus} options={[
                            {value: "NON_INVIATA", label: "Non inviata"},
                            {value: "PARZIALE", label: "Fatturato parzialmente"},
                            {value: "EMESSA", label: "Emessa"},
                        ]}/>
                        {!isFiscal && <input type="hidden" name="invoiceStatus" value=""/>}
                    </div>

                </div>
            </details>

            <details className="form-section full income-form-section income-notes-section expense-wizard-step expense-wizard-step-6" open={mobileStep === 6}>
                <summary>
                    <span>Riepilogo e note</span>
                    <small>Controllo finale e note interne</small>
                </summary>
                <div className="form-section-stack income-form-section-stack">
                    <section className="recurring-review-summary income-review-summary" aria-label="Riepilogo incasso">
                        <div className="expense-review-heading">
                            <div><span className="expense-review-kicker">Controlla prima di salvare</span>
                                <h3>Riepilogo dell’incasso</h3></div>
                            <strong>{formatEuro(amountValue)}</strong>
                        </div>
                        <div className="expense-review-grid">
                            <div className="expense-review-item">
                                <i aria-hidden="true">▣</i><span>Canale di vendita<strong>{salesChannels.find(channel => String(channel.id) === salesChannelId)?.name ?? "Non indicato"}</strong></span>
                            </div>
                            <div className="expense-review-item">
                                <i aria-hidden="true">◷</i><span>Data ordine<strong>{orderDate ? new Date(`${orderDate}T12:00:00`).toLocaleDateString("it-IT") : "Non indicata"}</strong></span>
                            </div>
                            <div className="expense-review-item wide">
                                <i aria-hidden="true">◎</i><span>Cliente<strong>{customerName || "Non indicato"}</strong></span>
                            </div>
                            <div className="expense-review-item wide">
                                <i aria-hidden="true">≡</i><span>Descrizione<strong>{description || "Non indicata"}</strong></span>
                            </div>
                            <div className="expense-review-item">
                                <i aria-hidden="true">▤</i><span>Fiscale / IVA<strong>{isFiscal ? `Sì · ${vatRate}%` : "No · 0%"}</strong></span>
                            </div>
                            <div className="expense-review-item">
                                <i aria-hidden="true">▦</i><span>Periodo contabile<strong>{billingPeriod || "Non indicato"}</strong></span>
                            </div>
                            <div className="expense-review-item wide">
                                <i aria-hidden="true">€</i><span>Accredito<strong>{paymentMethods.find(method => String(method.id) === paymentMethodId)?.name ?? "Metodo non indicato"} · {banks.find(bank => String(bank.id) === (cashPaymentSelected && cashBank ? String(cashBank.id) : creditBankId))?.name ?? "Canale non indicato"} · {isCredited ? "Accreditato" : "Da accreditare"}</strong></span>
                            </div>
                        </div>
                    </section>
                    <label className="full">
                        Note
                        <textarea name="notes" rows={3} value={notes} onChange={event => setNotes(event.currentTarget.value)} placeholder="Note interne opzionali"/>
                    </label>
                </div>
            </details>

            <MobileFormStickyActions
                currentStep={mobileStep}
                submitStep={6}
                onBack={() => goToMobileStep(mobileStep - 1)}
                onNext={nextMobileStep}
                onCancel={onCancel}
                cancelHref={cancelHref ?? "/incomes"}
                submitLabel={submitLabel}
            />

            <div className="actions-row full form-actions-row form-sticky-actions">
                <button className="btn btn-md btn-primary" type="submit">
                    <span className="btn-icon">✓</span> {submitLabel}</button>
                {onCancel ? (
                    <button className="btn btn-md btn-default" type="button" onClick={onCancel}>
                        <span className="btn-icon">×</span> Annulla</button>
                ) : (
                    <a className="btn btn-md btn-default" href={cancelHref ?? "/incomes"}><span className="btn-icon">×</span> Annulla</a>
                )}
            </div>
        </form>
    );
}
