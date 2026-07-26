"use client";

import {type FormEvent, useEffect, useMemo, useRef, useState} from "react";
import CustomerAutocomplete from '@/components/CustomerAutocomplete';

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

type Option = { id: number; name: string; icon?: string | null; isFallback?: boolean | null };
type PaymentMethodOption = Option & { kind?: string };
type IncomeEntityOption = { id: number; code: string; name: string; icon?: string | null };
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

function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="money-input">
            <span>€</span>
            <input type="number" step="0.01" min="0" {...props} />
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
    const fallbackBank = banks.find(bank => bank.isFallback) ?? banks.find(bank => bank.name.toLowerCase().includes("altra")) ?? banks[0];
    const defaultPaymentMethod = paymentMethods.find(method => method.name === "Bonifico") ?? paymentMethods[0];
    const initialPaymentMethodId = findOptionId(paymentMethods, initialIncome?.paymentMethodId) || (defaultPaymentMethod ? String(defaultPaymentMethod.id) : "");
    const initialCreditBankId = findOptionId(banks, initialIncome?.creditBankId) || (fallbackBank ? String(fallbackBank.id) : "");
    const initialSalesChannelId = initialIncome?.salesChannelId ? String(initialIncome.salesChannelId) : String(salesChannels[0]?.id ?? "");
    const [amount, setAmount] = useState(normalizeMoney(initialIncome?.amount).replace(".", ","));
    const [paymentMethodId, setPaymentMethodId] = useState(initialPaymentMethodId);
    const [creditBankId, setCreditBankId] = useState(initialCreditBankId);
    const [isCredited, setIsCredited] = useState(initialIncome?.isCredited ?? true);
    const [isFiscal, setIsFiscal] = useState(initialIncome?.isFiscal ?? true);
    const [invoiceStatus, setInvoiceStatus] = useState(initialIncome?.invoiceStatus ?? "NON_INVIATA");
    const [vatRate, setVatRate] = useState(normalizeMoney(initialIncome?.vatRate) || "22");
    const [mobileStep, setMobileStep] = useState(1);
    const formRef = useRef<HTMLFormElement>(null);
    const normalizedAmount = amount.replace(",", ".");
    const amountValue = Number(normalizedAmount || 0);
    const activeVatRate = isFiscal ? Number(vatRate || 0) : 0;
    const netAmount = useMemo(() => activeVatRate > 0 ? amountValue / (1 + activeVatRate / 100) : amountValue, [amountValue, activeVatRate]);

    const selectedPaymentMethod = paymentMethods.find(method => String(method.id) === paymentMethodId);
    const cashPaymentSelected = isCashMethod(selectedPaymentMethod);

    useEffect(() => {
        if (cashPaymentSelected && fallbackBank && creditBankId !== String(fallbackBank.id)) {
            setCreditBankId(String(fallbackBank.id));
        }
    }, [cashPaymentSelected, fallbackBank, creditBankId]);

    function toggleFiscal(nextValue: boolean) {
        setIsFiscal(nextValue);
        if (!nextValue) {
            setVatRate("0");
            setInvoiceStatus("NON_INVIATA");
        }
        else if (vatRate === "0") setVatRate("22");
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
        const normalized = value.replace(".", ",").replace(/[^\d,]/g, "");
        const [integer = "", decimals] = normalized.split(",");
        setAmount(decimals === undefined ? integer.slice(0, 9) : `${integer.slice(0, 9)},${decimals.slice(0, 2)}`);
    }

    function appendAmountKey(key: string) {
        setAmount(current => {
            if (key === "backspace") return current.slice(0, -1);
            if (key === ",") return current.includes(",") ? current : `${current || "0"},`;
            const decimals = current.split(",")[1];
            if (decimals?.length >= 2) return current;
            const next = current === "0" && key !== "0" ? key : `${current}${key}`;
            return next.slice(0, 12);
        });
    }

    function validateMobileStep() {
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
                    <strong>{["Vendita", "Importo", "Cliente", "Pagamento", "Fiscale", "Note"][mobileStep - 1]}</strong>
                </div>
                <div className="expense-wizard-progress" aria-label={`Passaggio ${mobileStep} di 6`}>
                    <span style={{width: `${mobileStep / 6 * 100}%`}}/>
                </div>
            </div>
            {/*<h2 className="full">{title}</h2>*/}

            <details className="form-section full income-form-section income-document-section" open>
                <summary>
                    <span>Documento</span>
                    <small>Dati principali dell'incasso</small>
                </summary>
                <div className="form-section-grid income-form-section-grid">
                    <label className="expense-wizard-step expense-wizard-step-1">
                        Canale di vendita
                        <select name="salesChannelId" defaultValue={initialSalesChannelId} required>
                            {salesChannels.map(option =>
                                <option key={option.id} value={option.id}>{option.icon ? `${option.icon} ` : ''}{option.name}</option>)}
                        </select>
                    </label>

                    <label className="expense-wizard-step expense-wizard-step-1">
                        Data ordine
                        <input type="date" name="orderDate" required defaultValue={toDateInput(initialIncome?.orderDate) || today}/>
                    </label>

                    <CustomerAutocomplete customers={customers} initialCustomerId={initialIncome?.customerId}/>

                    <label className="full expense-wizard-step expense-wizard-step-3">
                        Descrizione
                        <input name="description" defaultValue={initialIncome?.description ?? ""} placeholder="Descrizione dell'incasso"/>
                    </label>

                    <div className="amount-vat-row full income-amount-vat-row expense-wizard-step expense-wizard-step-2 income-wizard-amount">
                        <label className="income-amount-field">
                            Importo IVA inclusa
                            <div className="income-amount-row">
                                <MoneyInput type="text" inputMode="decimal" required value={amount} onChange={(event) => handleAmountChange(event.currentTarget.value)}/>
                                <input type="hidden" name="amount" value={normalizedAmount}/>
                            </div>
                        </label>

                        <label>
                            <span>IVA esclusa</span>
                            <span className="net-amount-inline"><strong>{formatEuro(netAmount)}</strong></span>
                        </label>

                        <div className="expense-wizard-keypad full" aria-label="Tastiera numerica">
                            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "backspace"].map(key => <button type="button" key={key} aria-label={key === "backspace" ? "Cancella ultima cifra" : key} onClick={() => appendAmountKey(key)}>{key === "backspace" ? "⌫" : key}</button>)}
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

                    <div className="income-form-section-credit">
                        <label>Accreditato</label>
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
                            <span>{isCredited ? "Si" : "No"}</span>
                        </label>
                    </div>

                    <div className="income-form-section-invoice-issued">
                        <label>Fattura emessa</label>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={isFiscal && invoiceStatus === "EMESSA"}
                                onChange={(event) => toggleInvoiceIssued(event.currentTarget.checked)}
                            />
                            <span className="slider"/>
                            <span>{isFiscal && invoiceStatus === "EMESSA" ? "Si" : "No"}</span>
                        </label>
                    </div>

                    <label>
                        Data accredito
                        <input type="date" name="creditDate" required defaultValue={toDateInput(initialIncome?.creditDate) || today}/>
                    </label>

                    <label>
                        Metodo di accredito
                        <select name="paymentMethodId" value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.currentTarget.value)} required>
                            {paymentMethods.map(method =>
                                <option key={method.id} value={method.id}>{method.icon ?? '  •  '} {method.name}</option>)}
                        </select>
                    </label>

                    <label>
                        Canale accr.
                        <select name="creditBankId" value={cashPaymentSelected && fallbackBank ? String(fallbackBank.id) : creditBankId} onChange={(event) => setCreditBankId(event.currentTarget.value)} disabled={cashPaymentSelected} required>
                            {banks.map(bank => (
                                <option key={bank.id} value={bank.id}>{bank.icon ?? '  •  '} {bank.name}</option>
                            ))}
                        </select>
                        {cashPaymentSelected && fallbackBank ?
                            <input type="hidden" name="creditBankId" value={fallbackBank.id}/> : null}
                    </label>
                </div>
            </details>

            <details className="form-section full income-form-section income-fiscal-section expense-wizard-step expense-wizard-step-5" open>
                <summary>
                    <span>Fiscale</span>
                    <small>Fiscalità, fattura e aliquota IVA</small>
                </summary>
                <div className="form-section-grid income-form-section-grid income-form-section-fiscal">
                    {/*<div className="toggle-field-wrap">*/}
                    <div className="toggle-field switch-toggle-field fiscal-toggle">
                        <label>Fiscale</label>
                        <input type="hidden" name="isFiscal" value="false"/>
                        <label className="switch">
                            <input
                                type="checkbox"
                                name="isFiscal"
                                value="true"
                                checked={isFiscal}
                                onChange={(event) => toggleFiscal(event.currentTarget.checked)}
                            />
                            <span className="slider"/>
                            <span>{isFiscal ? "Si" : "No"}</span>
                        </label>
                    </div>
                    {/*</div>*/}

                    <label>
                        Stato fattura
                        <select
                            name="invoiceStatus"
                            value={invoiceStatus}
                            disabled={!isFiscal}
                            onChange={(event) => setInvoiceStatus(event.currentTarget.value)}
                        >
                            <option value="NON_INVIATA">Non inviata</option>
                            <option value="EMESSA">Emessa</option>
                        </select>
                        {!isFiscal && <input type="hidden" name="invoiceStatus" value=""/>}
                    </label>

                    <label>
                        IVA
                        <select name="vatRate" value={isFiscal ? vatRate : "0"} onChange={(event) => setVatRate(event.target.value)} disabled={!isFiscal}>
                            {vatRates.map(value => <option key={value} value={value}>{value}%</option>)}
                        </select>
                        {!isFiscal && <input type="hidden" name="vatRate" value="0"/>}
                    </label>

                    <label>
                        Periodo Contabile
                        <input type="month" name="billingPeriod" required defaultValue={toMonthInput(initialIncome)}/>
                    </label>

                </div>
            </details>

            <details className="form-section full income-form-section income-notes-section expense-wizard-step expense-wizard-step-6" open={mobileStep === 6}>
                <summary>
                    <span>Note</span>
                    <small>Note interne opzionali</small>
                </summary>
                <div className="form-section-stack income-form-section-stack">
                    <label className="full">
                        Note
                        <textarea name="notes" rows={3} defaultValue={initialIncome?.notes ?? ""} placeholder="Note interne opzionali"/>
                    </label>
                </div>
            </details>

            <div className="expense-wizard-actions full">
                <div className="expense-wizard-actions-row">
                    {mobileStep > 1 ? <button className="btn btn-md btn-default" type="button" onClick={() => goToMobileStep(mobileStep - 1)}>← Indietro</button> : onCancel ? <button className="btn btn-md btn-default" type="button" onClick={onCancel}>× Annulla</button> : <a className="btn btn-md btn-default" href={cancelHref ?? "/incomes"}>× Annulla</a>}
                    {mobileStep < 6 ? <button className="btn btn-md btn-primary" type="button" onClick={event => { event.preventDefault(); nextMobileStep(); }}>Avanti →</button> : <button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">✓</span> {submitLabel}</button>}
                </div>
            </div>

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
