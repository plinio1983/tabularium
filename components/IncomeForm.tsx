"use client";

import {type FormEvent, useCallback, useEffect, useMemo, useRef, useState} from "react";
import CustomerAutocomplete from '@/components/CustomerAutocomplete';
import {CurrencyInput} from "@/components/CurrencyInput";
import {applyCurrencyInputKeyWithState, formatCurrencyInput} from "@/lib/currency-input";
import {DateField, MonthField, SelectField} from "@/components/FormControls";
import DescriptionAutocomplete from "@/components/DescriptionAutocomplete";
import MobileFormStickyActions from "@/components/MobileFormStickyActions";
import {incomeCreditState} from '@/lib/income-status';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {dateInputInTimeZone, monthInputInTimeZone} from '@/lib/company-time';
import AttachmentFormSection, {type FormAttachment} from '@/components/AttachmentFormSection';

type InitialIncome = {
    id?: number;
    customerId?: number | null;
    salesChannelId?: number;
    orderDate?: string | Date | null;
    dueDate?: string | Date | null;
    description?: string | null;
    amount?: string | number | { toString(): string } | null;
    paymentMethodId?: number | null;
    creditBankId?: number | null;
    creditDate?: string | Date | null;
    isCredited?: boolean;
    credits?: InitialCredit[];
    billingMonth?: number | null;
    billingYear?: number | null;
    isFiscal?: boolean;
    invoiceStatus?: string | null;
    vatRate?: string | number | { toString(): string } | null;
    notes?: string | null;
    attachments?: FormAttachment[];
};

type InitialCredit = {
    id?: number;
    creditDate?: string | Date | null;
    paymentMethodId?: number | null;
    bankId?: number | null;
    amount?: string | number | { toString(): string } | null;
};

type CreditRow = {
    key: number;
    id?: number;
    creditDate: string;
    paymentMethodId: string;
    bankId: string;
    amount: string;
};

type Option = { id: number; name: string; icon?: string | null; isFallback?: boolean | null; isPrimary?: boolean };
type PaymentMethodOption = Option & { kind?: string; isIncomeDefault?: boolean };
type IncomeEntityOption = {
    id: number;
    code: string;
    name: string;
    icon?: string | null;
    isDefault?: boolean;
    isFallback?: boolean
};
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
    onSwitchToRecurring?: () => void;
    initialMobileStep?: number;
    openNewCredit?: boolean;
    focusAttachments?: boolean;
};

const vatRates = ["0", "4", "10", "22"];

function toDateInput(value?: string | Date | null) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function addDaysToDateInput(value: string, days: number, fallbackToday: string) {
    const [year, month, day] = value.split("-").map(Number);
    const base = year && month && day
        ? new Date(Date.UTC(year, month - 1, day))
        : new Date(`${fallbackToday}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + days);
    return base.toISOString().slice(0, 10);
}

function toMonthInput(income: InitialIncome | undefined, currentMonth: string) {
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

function formatDateInputLabel(value: string) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatCreditDateLabel(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    const parts = new Intl.DateTimeFormat("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).formatToParts(new Date(year, month - 1, day, 12));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
    const monthLabel = part("month").replace(".", "");
    return `${part("day")} ${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${part("year")}`;
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

function isCreditComplete(credit: CreditRow) {
    return Boolean(credit.creditDate && credit.paymentMethodId && credit.bankId && Number(credit.amount || 0) > 0);
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
                                       onSwitchToRecurring,
                                       initialMobileStep = 1,
                                       openNewCredit = false,
                                       focusAttachments = false,
                                   }: Props) {
    const timeZone = useCompanyTimeZone();
    const today = dateInputInTimeZone(timeZone);
    const currentMonth = monthInputInTimeZone(timeZone);
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
    const [dueDate, setDueDate] = useState(toDateInput(initialIncome?.dueDate) || toDateInput(initialIncome?.orderDate) || today);
    const [billingPeriod, setBillingPeriod] = useState(toMonthInput(initialIncome, currentMonth));
    const [description, setDescription] = useState(initialIncome?.description ?? "");
    const [notes, setNotes] = useState(initialIncome?.notes ?? "");
    const [customerName, setCustomerName] = useState(
        customers.find(customer => customer.id === initialIncome?.customerId)?.businessName ?? "",
    );
    const [credits, setCredits] = useState<CreditRow[]>(() => {
        if (initialIncome?.credits?.length) return initialIncome.credits.map((credit, index) => ({
            key: credit.id ?? Date.now() + index,
            id: credit.id,
            creditDate: toDateInput(credit.creditDate) || today,
            paymentMethodId: findOptionId(paymentMethods, credit.paymentMethodId) || initialPaymentMethodId,
            bankId: findOptionId(banks, credit.bankId) || initialCreditBankId,
            amount: normalizeMoney(credit.amount),
        }));
        if (initialIncome?.isCredited) return [{
            key: initialIncome.id ?? Date.now(),
            creditDate: toDateInput(initialIncome.creditDate) || today,
            paymentMethodId: initialPaymentMethodId,
            bankId: initialCreditBankId,
            amount: normalizeMoney(initialIncome.amount),
        }];
        return [];
    });
    const [openCreditKey, setOpenCreditKey] = useState<number | null>(null);
    const [isFiscal, setIsFiscal] = useState(initialIncome?.isFiscal ?? true);
    const [invoiceStatus, setInvoiceStatus] = useState(initialIncome?.invoiceStatus ?? "NON_INVIATA");
    const [vatRate, setVatRate] = useState(normalizeMoney(initialIncome?.vatRate) || "22");
    const [mobileStep, setMobileStep] = useState(() => Math.max(1, Math.min(7, initialMobileStep)));
    const [attachmentCount, setAttachmentCount] = useState(initialIncome?.attachments?.length ?? 0);
    const [attachmentError, setAttachmentError] = useState("");
    const formRef = useRef<HTMLFormElement>(null);
    const amountRef = useRef<HTMLInputElement>(null);
    const openCreditRef = useRef<HTMLDivElement | null>(null);
    const didOpenNewCredit = useRef(false);
    const amountKeyStateRef = useRef<{ separatorDigits: 0 | 1 | null }>({separatorDigits: null});
    const normalizedAmount = amount.replace(",", ".");
    const amountValue = Number(normalizedAmount || 0);
    const activeVatRate = isFiscal ? Number(vatRate || 0) : 0;
    const netAmount = useMemo(() => activeVatRate > 0 ? amountValue / (1 + activeVatRate / 100) : amountValue, [amountValue, activeVatRate]);

    const creditedAmount = credits.reduce((sum, credit) => sum + Number(credit.amount || 0), 0);
    const creditResidual = Math.max(0, amountValue - creditedAmount);
    const creditState = incomeCreditState({amount: amountValue, credits, dueDate}, new Date(), timeZone);
    const isCredited = creditState === 'ACCREDITATO';
    const creditStatusLabel = {
        ACCREDITATO: 'Accreditato',
        PARZIALE: 'Accreditato parzialmente',
        DA_ACCREDITARE: 'Da accreditare',
        SCADUTO: 'Scaduto'
    }[creditState];
    const canAddCredit = !isCredited && openCreditKey === null && credits.every(isCreditComplete) && creditResidual > 0.005;
    const isCreditOnlyMode = openNewCredit;
    const updateAttachmentState = useCallback((count: number, error: string) => {
        setAttachmentCount(count);
        setAttachmentError(error);
    }, []);

    function updateCredit(index: number, patch: Partial<CreditRow>) {
        setCredits(rows => rows.map((credit, rowIndex) => {
            if (rowIndex !== index) return credit;
            const next = {...credit, ...patch};
            if ("paymentMethodId" in patch) {
                const nextMethod = paymentMethods.find(method => String(method.id) === next.paymentMethodId);
                const previousMethod = paymentMethods.find(method => String(method.id) === credit.paymentMethodId);
                if (isCashMethod(nextMethod) && cashBank) next.bankId = String(cashBank.id);
                else if (isCashMethod(previousMethod) && primaryBank) next.bankId = String(primaryBank.id);
            }
            return next;
        }));
    }

    function creditAvailableAmount(index?: number) {
        const otherCredits = credits.reduce((sum, credit, rowIndex) => rowIndex === index ? sum : sum + Number(credit.amount || 0), 0);
        return Math.max(0, amountValue - otherCredits);
    }

    function addCredit() {
        if (!canAddCredit) return;
        const key = Date.now();
        const available = creditAvailableAmount();
        setCredits(rows => [...rows, {
            key,
            creditDate: today,
            paymentMethodId: initialPaymentMethodId,
            bankId: initialCreditBankId,
            amount: available > 0 ? available.toFixed(2) : "",
        }]);
        setOpenCreditKey(key);
    }

    useEffect(() => {
        if (!openNewCredit || didOpenNewCredit.current) return;
        didOpenNewCredit.current = true;
        addCredit();
    }, [openNewCredit]);

    useEffect(() => {
        if (!openCreditKey) return;
        window.requestAnimationFrame(() => {
            openCreditRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        });
    }, [openCreditKey]);

    function removeCredit(index: number) {
        const credit = credits[index];
        if (credit?.id && !window.confirm("Eliminare questo accredito?")) return;
        setCredits(rows => rows.filter((_, rowIndex) => rowIndex !== index));
        if (credit?.key === openCreditKey) setOpenCreditKey(null);
    }

    function setCreditPercentage(index: number, percentage: number) {
        const value = creditAvailableAmount(index) * percentage / 100;
        updateCredit(index, {amount: value > 0 ? value.toFixed(2) : ""});
    }

    function renderCreditHiddenInputs(credit: CreditRow) {
        const method = paymentMethods.find(item => String(item.id) === credit.paymentMethodId);
        const bankId = isCashMethod(method) && cashBank ? String(cashBank.id) : credit.bankId;
        return <>
            <input type="hidden" name="creditId[]" value={credit.id ?? ""}/>
            <input type="hidden" name="creditDate[]" value={credit.creditDate}/>
            <input type="hidden" name="creditPaymentMethodId[]" value={credit.paymentMethodId}/>
            <input type="hidden" name="creditBankId[]" value={bankId}/>
            <input type="hidden" name="creditAmount[]" value={credit.amount}/>
        </>;
    }

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
        const elements = Array.from(formRef.current?.querySelectorAll<HTMLElement>(`.app-form-wizard-step-${mobileStep}`) ?? []);
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
        setMobileStep(Math.max(1, Math.min(7, step)));
        window.requestAnimationFrame(() => formRef.current?.scrollIntoView({behavior: "smooth", block: "start"}));
    }

    function nextMobileStep() {
        if (validateMobileStep()) goToMobileStep(mobileStep + 1);
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        if (window.matchMedia("(max-width: 900px)").matches) {
            if (isCreditOnlyMode) {
                if (!credits.every(isCreditComplete)) event.preventDefault();
            } else if (mobileStep < 6) {
                event.preventDefault();
                nextMobileStep();
            }
        }
    }

    return (
        <form ref={formRef} className={`card form income-form app-record-form app-form-wizard income-mobile-wizard app-form-wizard-current-${mobileStep}`} action={action} method="post" encType="multipart/form-data" onSubmit={handleSubmit}>
            <div className="app-form-wizard-header full">
                <div className="app-form-wizard-heading">
                    <span>Passaggio {mobileStep} di 7</span>
                    <strong>{["Vendita", "Importo", "Cliente", "Accredito", "Fattura", "Riepilogo", "Allegati"][mobileStep - 1]}</strong>
                </div>
                <div className="app-form-wizard-progress" aria-label={`Passaggio ${mobileStep} di 7`}>
                    <span style={{width: `${mobileStep / 7 * 100}%`}}/>
                </div>
            </div>
            {/*<h2 className="full">{title}</h2>*/}

            <div className="entry-type-choice full app-form-wizard-step app-form-wizard-step-1">
                <span className="entry-type-choice-title">Tipo di incasso</span>
                <div className="entry-type-choice-grid" role="radiogroup" aria-label="Tipo di incasso">
                    <button type="button" className="is-selected" role="radio" aria-checked="true">
                        <span aria-hidden="true">●</span>
                        <strong>Incasso <br/>singolo</strong>
                        <small>Entrata occasionale</small>
                    </button>
                    <button type="button" role="radio" aria-checked="false" disabled={Boolean(initialIncome?.id) || !onSwitchToRecurring}
                            onClick={onSwitchToRecurring}>
                        <span aria-hidden="true">↻</span>
                        <strong>Entrata <br/>ricorrente</strong>
                        <small>Configura ricorrenza</small>
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
                    <DateField className="app-form-wizard-step app-form-wizard-step-1" label="Data ordine" name="orderDate" value={orderDate} onChange={setOrderDate} required/>

                    <DateField className="app-form-wizard-step app-form-wizard-step-1" label="Data scadenza" name="dueDate" value={dueDate} onChange={setDueDate} required>
                        <span className="app-due-date-shortcuts" aria-label="Selezione rapida data scadenza">
                            {[0, 7, 15, 30].map(days => {
                                const value = addDaysToDateInput(orderDate, days, today);
                                return <button type="button" key={days} className={dueDate === value ? "is-selected" : ""}
                                               aria-pressed={dueDate === value} onClick={() => setDueDate(value)}>
                                    {days === 0 ? "Stesso g" : `+${days} gg`}
                                </button>;
                            })}
                        </span>
                    </DateField>

                    <CustomerAutocomplete customers={customers} initialCustomerId={initialIncome?.customerId} onValueChange={setCustomerName}/>

                    <SelectField className="app-form-wizard-step app-form-wizard-step-3" label="Canale di vendita" icon="▣" name="salesChannelId" value={salesChannelId} onChange={setSalesChannelId} required options={salesChannels.map(option => ({
                        value: option.id,
                        label: `${option.icon ?? "•"} ${option.name}`
                    }))}/>

                    <DescriptionAutocomplete endpoint="/api/income-descriptions" label="Descrizione"
                                             placeholder="Descrizione dell'incasso"
                                             initialValue={initialIncome?.description ?? ""}
                                             onValueChange={setDescription}
                                             className="full app-form-wizard-step app-form-wizard-step-3"/>

                </div>
            </details>

            <details className="form-section full income-form-section income-amount-section" open>
                <summary>
                    <span>Importo e IVA</span>
                    <small>Fiscalità, importo e aliquota IVA</small>
                </summary>
                <div className="form-section-grid income-form-section-grid">
                    <div className="amount-vat-row full income-amount-vat-row app-form-wizard-step app-form-wizard-step-2 income-wizard-amount">
                        <div className="income-wizard-amount-entry">
                            <div className="app-form-field-label income-switch-control income-fiscal-switch switch-toggle-field ">
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
                                    <div className="app-form-field-label">
                                        <span className="app-form-field-icon">€</span>
                                        <label className="app-form-label">
                                            <span className="hidden-sm-down">Importo IVA inclusa</span>
                                            <span className="hidden-sm-up">Importo</span>
                                        </label>
                                    </div>
                                    {/*<div>Importo <span className="hidden-sp">IVA inclusa</span></div>*/}
                                    <div className="income-amount-row">
                                        <MoneyInput inputRef={amountRef} required value={amount} onValueChange={handleAmountChange}/>
                                        <input type="hidden" name="amount" value={normalizedAmount}/>
                                    </div>
                                </label>
                                <div className="app-vat-rate-buttons income-vat-buttons vat-buttons-desktop" aria-label="Aliquota IVA">
                                    {vatRates.map(value =>
                                        <button type="button" key={value} className={vatRate === value ? "is-selected" : ""} disabled={!isFiscal} onMouseDown={event => event.preventDefault()} onClick={() => {
                                            setVatRate(value);
                                            focusAmount();
                                        }}>{value}%</button>)}
                                </div>
                            </div>
                        </div>

                        <div className="app-vat-rate-buttons income-vat-buttons vat-buttons-mobile align-center" aria-label="Aliquota IVA">
                            <div className="hidden-sp">
                                <label className="ml-12">IVA</label>
                            </div>
                            {vatRates.map(value =>
                                <button type="button" key={value} className={vatRate === value ? "is-selected" : ""} disabled={!isFiscal} onMouseDown={event => event.preventDefault()} onClick={() => {
                                    setVatRate(value);
                                    focusAmount();
                                }}>{value}%</button>)}
                        </div>

                        <input type="hidden" name="vatRate" value={isFiscal ? vatRate : "0"}/>

                        <div className="app-amount-keypad full" aria-label="Tastiera numerica">
                            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "backspace"].map(key =>
                                <button type="button" key={key} aria-label={key === "backspace" ? "Cancella ultima cifra" : key} onMouseDown={event => event.preventDefault()} onClick={() => appendAmountKey(key)}>{key === "backspace" ? "⌫" : key}</button>)}
                        </div>
                    </div>
                </div>
            </details>

            <details className="form-section full income-form-section income-payment-section app-form-wizard-step app-form-wizard-step-4" open>
                <summary>
                    <span>Accrediti</span>
                    <small>Importi, date e conti di destinazione</small>
                </summary>
                <div className="form-section-stack">
                    <section className="payments-box income-credits-box full">
                        <div className="form-summary full">
                            <div><span className="muted">Accreditato</span><strong>{formatEuro(creditedAmount)}</strong>
                            </div>
                            <div>
                                <span className="muted">Residuo</span><strong className={creditResidual > 0 ? "text-critical" : "text-ok"}>{formatEuro(creditResidual)}</strong>
                            </div>
                            <div>
                                <span className="muted">Stato</span><strong className={isCredited ? "text-ok" : creditState === 'PARZIALE' ? "text-warning" : "text-critical"}>{creditStatusLabel}</strong>
                            </div>
                            <button type="button" className="btn btn-sm btn-default" disabled={!canAddCredit}
                                    onClick={addCredit}>
                                ➕ Aggiungi accredito
                            </button>
                        </div>

                        {credits.map((credit, index) => {
                            const isOpen = openCreditKey === credit.key;
                            const method = paymentMethods.find(item => String(item.id) === credit.paymentMethodId);
                            const cashSelected = isCashMethod(method);
                            const bankId = cashSelected && cashBank ? String(cashBank.id) : credit.bankId;
                            const bank = banks.find(item => String(item.id) === bankId);
                            if (!isOpen) return <div className="payment-row payment-summary-row" key={credit.key}>
                                {renderCreditHiddenInputs(credit)}
                                <div className="payment-summary-primary">
                                    <span className="payment-summary-kicker">Accredito registrato</span>
                                    <strong className="payment-summary-amount">{formatEuro(Number(credit.amount || 0))}</strong>
                                </div>
                                <div className="payment-summary-date">
                                    <span>Data accredito</span><strong>{credit.creditDate ? formatCreditDateLabel(credit.creditDate) : "Non impostata"}</strong>
                                </div>
                                <div className="payment-summary-meta">
                                    <div>
                                        <span>Metodo</span><strong>{method?.icon ?? "•"} {method?.name ?? "Non impostato"}</strong>
                                    </div>
                                    <div>
                                        <span>Banca</span><strong>{bank?.icon ?? "•"} {bank?.name ?? "Non impostata"}</strong>
                                    </div>
                                </div>
                                <div className="payment-row-actions">
                                    <button type="button" className="btn btn-sm btn-default" onClick={() => setOpenCreditKey(credit.key)}>✎ Modifica</button>
                                    <button type="button" className="btn btn-sm btn-danger remove-row" onClick={() => removeCredit(index)}>🗑️ Elimina</button>
                                </div>
                            </div>;

                            return <div className="payment-row" key={credit.key} ref={openCreditRef}>
                                <input type="hidden" name="creditId[]" value={credit.id ?? ""}/>
                                <DateField className="payment-date-field" label="Data accredito" name="creditDate[]" value={credit.creditDate} onChange={value => updateCredit(index, {creditDate: value})} required/>
                                <label className="payment-amount-field">
                                    <span className="app-form-field-label">
                                        <span className="app-form-field-icon" aria-hidden="true">€</span>
                                        <span>Importo accredito</span>
                                    </span>
                                    <MoneyInput required value={credit.amount} onValueChange={value => updateCredit(index, {amount: value.replace(',', '.')})}/>
                                    <input type="hidden" name="creditAmount[]" value={credit.amount}/>
                                    <span className="payment-amount-shortcuts" aria-label="Impostazione rapida importo accredito">
                                        {[25, 50, 75, 100].map(percentage => <button type="button" key={percentage}
                                                                                     className={Math.abs(Number(credit.amount || 0) - creditAvailableAmount(index) * percentage / 100) < 0.005 ? "is-selected" : ""}
                                                                                     onClick={() => setCreditPercentage(index, percentage)}>{percentage}%</button>)}
                                    </span>
                                </label>
                                <div className="payment-select-field">
                                    <span className="payment-select-label"><i aria-hidden="true">▣</i> Metodo di accredito</span>
                                    <div className="payment-select-control">
                                        <select name="creditPaymentMethodId[]" value={credit.paymentMethodId} required onChange={event => updateCredit(index, {paymentMethodId: event.currentTarget.value})}>
                                            <option value="">Seleziona metodo</option>
                                            {paymentMethods.map(item =>
                                                <option key={item.id} value={item.id}>{item.icon ?? "•"} {item.name}</option>)}
                                        </select><span className="payment-select-caret" aria-hidden="true">⌄</span>
                                    </div>
                                </div>
                                <div className="payment-select-field">
                                    <span className="payment-select-label"><i aria-hidden="true">▥</i> Banca di accredito</span>
                                    {cashSelected && cashBank ?
                                        <input type="hidden" name="creditBankId[]" value={cashBank.id}/> : null}
                                    <div className="payment-select-control">
                                        <select name={cashSelected && cashBank ? undefined : "creditBankId[]"} value={bankId} disabled={cashSelected && Boolean(cashBank)} required onChange={event => updateCredit(index, {bankId: event.currentTarget.value})}>
                                            <option value="">Seleziona banca</option>
                                            {banks.map(item =>
                                                <option key={item.id} value={item.id}>{item.icon ?? "•"} {item.name}</option>)}
                                        </select><span className="payment-select-caret" aria-hidden="true">⌄</span>
                                    </div>
                                </div>
                                <div className="payment-edit-actions">
                                    <button type="button" className="btn btn-sm btn-danger remove-row" onClick={() => removeCredit(index)}>🗑️ Rimuovi</button>
                                    <button type="button" className="btn btn-sm btn-primary payment-collapse-action" disabled={!isCreditComplete({
                                        ...credit,
                                        bankId
                                    })} onClick={() => setOpenCreditKey(null)}>&nbsp;&nbsp;✓ Ok&nbsp;&nbsp;
                                    </button>
                                </div>
                            </div>;
                        })}

                        {credits.length && !canAddCredit && creditResidual > 0.005 ?
                            <p className="inline-warning">Completa l’accredito aperto prima di aggiungerne un altro.</p> : null}
                    </section>
                </div>
            </details>

            <details className="form-section full income-form-section income-fiscal-section app-form-wizard-step app-form-wizard-step-5" open>
                <summary>
                    <span>Fattura</span>
                    <small>Stato fattura e periodo contabile</small>
                </summary>
                <div className="form-section-grid income-form-section-grid income-form-section-fiscal">
                    <MonthField label="Periodo contabile" name="billingPeriod" value={billingPeriod} onChange={setBillingPeriod} required/>
                    <div className="app-form-field-label switch-toggle-field hidden-md-down">
                        <div className="switch-toggle-field-label app-form-field-label">
                            <span className="app-form-field-icon">⇆</span>
                            <span className="app-form-label">Fattura emessa</span>
                        </div>
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
                    <div className="app-form-field-label switch-toggle-field switch-inline wide hidden-md-up">
                        <div className="switch-toggle-field-label app-form-field-label">
                            <span className="app-form-field-icon">⇆</span>
                            <span className="app-form-label">Fattura emessa</span>
                        </div>
                        <label className="switch">
                            <small className="text-muted">{isFiscal && invoiceStatus === "EMESSA" ? "Emessa" : invoiceStatus === "PARZIALE" ? "Parziale" : "Non inviata"}</small>
                            <input
                                type="checkbox"
                                checked={isFiscal && invoiceStatus === "EMESSA"}
                                onChange={(event) => toggleInvoiceIssued(event.currentTarget.checked)}
                            />
                            <span className="slider"/>
                        </label>
                    </div>
                    {/*<div className="toggle-field-wrap">*/}
                    <div className="flex-grow">
                        <SelectField label="Stato fattura" icon="▤" name="invoiceStatus" value={invoiceStatus} disabled={!isFiscal} onChange={setInvoiceStatus} options={[
                            {value: "NON_INVIATA", label: "Non inviata"},
                            {value: "PARZIALE", label: "Fatturato parzialmente"},
                            {value: "EMESSA", label: "Emessa"},
                        ]}/>
                        {!isFiscal && <input type="hidden" name="invoiceStatus" value=""/>}
                    </div>

                </div>
            </details>

            <section className="expense-review-step record-review-step full app-form-wizard-step app-form-wizard-step-6" aria-label="Riepilogo incasso">
                <div className="record-review-heading">
                    <div><span className="record-review-kicker">Controlla prima di salvare</span>
                        <h3>Riepilogo dell’incasso</h3></div>
                    <strong>{formatEuro(amountValue)}</strong>
                </div>
                <div className="record-review-grid">
                            <div className="record-review-item">
                                <i aria-hidden="true">◷</i><span>Data ordine<strong>{formatDateInputLabel(orderDate) || "Non indicata"}</strong></span>
                            </div>
                            <div className="record-review-item">
                                <i aria-hidden="true">◷</i><span>Scadenza<strong>{formatDateInputLabel(dueDate) || "Non indicata"}</strong></span>
                            </div>
                            <div className="record-review-item wide">
                                <i aria-hidden="true">◎</i><span>Cliente<strong>{customerName || "Non indicato"}</strong></span>
                            </div>
                            <div className="record-review-item wide">
                                <i aria-hidden="true">≡</i><span>Descrizione<strong>{description || "Non indicata"}</strong></span>
                            </div>
                            <div className="record-review-item wide">
                                <i aria-hidden="true">▣</i><span>Canale di vendita<strong>{salesChannels.find(channel => String(channel.id) === salesChannelId)?.name ?? "Non indicato"}</strong></span>
                            </div>
                            <div className="record-review-item">
                                <i aria-hidden="true">▦</i><span>Periodo contabile<strong>{billingPeriod || "Non indicato"}</strong></span>
                            </div>
                            <div className="record-review-item">
                                <i aria-hidden="true">%</i><span>Fiscale / IVA<strong>{isFiscal ? `Sì · ${vatRate}%` : "No · 0%"}</strong></span>
                            </div>
                            <div className="record-review-item wide">
                                <i aria-hidden="true">▤</i><span>Stato fattura<strong>{!isFiscal ? "Non prevista" : invoiceStatus === "EMESSA" ? "Emessa" : invoiceStatus === "PARZIALE" ? "Fatturata parzialmente" : "Non inviata"}</strong></span>
                            </div>
                            <div className="record-review-item">
                                <i aria-hidden="true">€</i><span>Accrediti<strong>{credits.length ? `${credits.length} · ${formatEuro(creditedAmount)}` : "Nessun accredito"}</strong></span>
                            </div>
                            <div className="record-review-item">
                                <i aria-hidden="true">=</i><span>Residuo<strong className={creditResidual > 0 ? "text-critical" : "text-ok"}>{formatEuro(creditResidual)}</strong></span>
                            </div>
                </div>
                <button className="btn btn-md btn-default expense-review-attachments-button" type="button" onClick={() => goToMobileStep(7)}>
                    <span className="btn-icon">＋</span><span><strong>Allegati</strong><small>{attachmentCount ? `${attachmentCount} allegati selezionati` : "Aggiungi allegati opzionali"}</small></span><span aria-hidden="true">→</span>
                </button>
                <label className="card full expense-review-notes expense-review-notes-mobile">
                    Note
                    <textarea name="notes" rows={3} value={notes} onChange={event => setNotes(event.currentTarget.value)} placeholder="Note interne opzionali"/>
                </label>
            </section>

            <AttachmentFormSection initialAttachments={initialIncome?.attachments} onStateChange={updateAttachmentState} focusOnMount={focusAttachments}/>

            <MobileFormStickyActions
                currentStep={isCreditOnlyMode ? 1 : mobileStep}
                submitStep={isCreditOnlyMode ? 1 : 6}
                onBack={() => goToMobileStep(mobileStep - 1)}
                onNext={nextMobileStep}
                onCancel={onCancel}
                cancelHref={cancelHref ?? "/incomes"}
                submitLabel={isCreditOnlyMode ? "Salva accredito" : submitLabel}
                submitDisabled={Boolean(attachmentError)}
                error={attachmentError}
                backLabel={mobileStep === 7 ? "Riepilogo" : "Indietro"}
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
