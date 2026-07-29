"use client";

import {type FormEvent, useEffect, useRef, useState} from "react";
import {categoryIcon} from "@/lib/expense-ui";
import {DateField, FormField, SelectField} from "@/components/FormControls";
import {CurrencyInput} from "@/components/CurrencyInput";
import SupplierCreateModal from "@/components/SupplierCreateModal";
import {applyCurrencyInputKeyWithState, formatCurrencyInput} from "@/lib/currency-input";

type Option = {
    id: number;
    code?: string;
    name: string;
    icon?: string | null;
    isFallback?: boolean | null;
    isPrimary?: boolean;
    kind?: string
};
type SupplierOption = {
    id: number;
    businessName: string;
    alias?: string | null;
    email?: string | null;
    vatNumber?: string | null;
    iban?: string | null;
    pec?: string | null;
    taxCodeSdi?: string | null;
    swift?: string | null;
    internalNotes?: string | null;
};
type InitialRecurringExpense = {
    startDate?: string | Date | null;
    cadence?: string | null;
    dueDay?: number | null;
    dueMonth?: number | null;
    isAutomaticPayment?: boolean | null;
    billingPeriodMode?: string | null;
    billingMonth?: number | null;
    supplierId?: number | null;
    merchant?: string | null;
    categoryId?: number | null;
    description?: string | null;
    amount?: string | number | { toString(): string } | null;
    vatRate?: string | number | { toString(): string } | null;
    isDeclared?: boolean;
    hasElectronicInvoice?: boolean;
    paymentMethodId?: number | null;
    bankId?: number | null;
    notes?: string | null;
};

type Props = {
    categories: Option[];
    banks: Option[];
    paymentMethods: Option[];
    suppliers?: SupplierOption[];
    action?: string;
    initialExpense?: InitialRecurringExpense;
    onCancel?: () => void;
    onSaved?: () => void;
    cancelHref?: string;
    onSwitchToSingle?: () => void;
    onSwitchToVatSettlement?: () => void;
};

const today = new Date().toISOString().slice(0, 10);
const cashChannel = "Cash";
const cashBankName = "Cassa";
const monthOptions = [
    [1, "Gennaio"],
    [2, "Febbraio"],
    [3, "Marzo"],
    [4, "Aprile"],
    [5, "Maggio"],
    [6, "Giugno"],
    [7, "Luglio"],
    [8, "Agosto"],
    [9, "Settembre"],
    [10, "Ottobre"],
    [11, "Novembre"],
    [12, "Dicembre"],
] as const;

function toDateInput(value?: string | Date | null) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function normalizeMoney(value: unknown) {
    if (value === null || value === undefined) return "";
    return String(value).replace(",", ".");
}

function isCashChannel(channel: string) {
    return channel.trim().toLowerCase() === cashChannel.toLowerCase();
}

function MoneyInput({inputRef, ...props}: React.ComponentProps<typeof CurrencyInput> & {
    inputRef?: React.RefObject<HTMLInputElement | null>
}) {
    return (
        <div className="money-input">
            <span>€</span>
            <CurrencyInput ref={inputRef} {...props} />
        </div>
    );
}

function SupplierAutocomplete({
                                  suppliers = [],
                                  initialSupplierId,
                                  initialMerchant,
                                  onValueChange,
                                  categories = [],
                              }: {
    suppliers?: SupplierOption[];
    initialSupplierId?: number | null;
    initialMerchant?: string | null;
    onValueChange?: (value: string) => void;
    categories?: Option[];
}) {
    const initial = suppliers.find((supplier) => supplier.id === initialSupplierId) ?? null;
    const [query, setQuery] = useState(initial?.businessName ?? initialMerchant ?? "");
    const [selected, setSelected] = useState<SupplierOption | null>(initial);
    const [results, setResults] = useState<SupplierOption[]>(suppliers.slice(0, 10));
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [showCreate, setShowCreate] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            const params = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : "";
            const response = await fetch(`/api/suppliers${params}`, {signal: controller.signal}).catch(() => null);
            if (!response?.ok) return;
            const data = await response.json();
            setResults(Array.isArray(data) ? data : []);
            setActiveIndex(0);
        }, 180);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [query]);

    function selectSupplier(supplier: SupplierOption) {
        setSelected(supplier);
        setQuery(supplier.businessName);
        onValueChange?.(supplier.businessName);
        setIsOpen(false);
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (!isOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) setIsOpen(true);
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, results.length - 1));
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
        }
        if (event.key === "Enter" && isOpen && results[activeIndex]) {
            event.preventDefault();
            selectSupplier(results[activeIndex]);
        }
        if (event.key === "Escape") setIsOpen(false);
    }

    return (
        <div className="supplier-picker supplier-picker-wide expense-wizard-step expense-wizard-step-3" ref={containerRef}>
            <input type="hidden" name="supplierId" value={selected?.id ?? ""}/>
            <input type="hidden" name="merchant" value={selected?.businessName ?? query}/>
            <label className="recurring-supplier-field">
        <span className="app-form-field-label">
          <span className="app-form-field-icon" aria-hidden="true">◎</span>
          <span>Esercente/Fornitore</span>
        </span>
                <div className="supplier-input-row">
                    <input
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            onValueChange?.(event.target.value);
                            setSelected(null);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={onKeyDown}
                        placeholder="Cerca per ragione sociale o referente"
                        autoComplete="off"
                        required
                    />
                    <button
                        type="button"
                        className="btn btn-sm btn-link inline-link-button"
                        onClick={() => setShowCreate(true)}
                    >
                        ＋ Nuovo
                    </button>
                </div>
            </label>

            {isOpen && (
                <div className="supplier-results" role="listbox">
                    {results.length ? (
                        results.map((supplier, index) => (
                            <button
                                type="button"
                                key={supplier.id}
                                className={index === activeIndex ? "active" : ""}
                                onMouseEnter={() => setActiveIndex(index)}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectSupplier(supplier);
                                }}
                            >
                                <strong>{supplier.businessName}</strong>
                                {supplier.alias && <small>Referente: {supplier.alias}</small>}
                            </button>
                        ))
                    ) : (
                        <div className="empty-supplier-result">Nessun esercente/fornitore trovato.</div>
                    )}
                </div>
            )}

            <SupplierCreateModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                categories={categories}
                initialBusinessName={query}
                context="nested"
                onCreated={(supplier) => {
                    setResults((current) => [
                        supplier,
                        ...current.filter((item) => item.id !== supplier.id),
                    ]);
                    selectSupplier(supplier);
                }}
            />
        </div>
    );
}

function ProductServiceAutocomplete({initialValue = "", onValueChange}: {
    initialValue?: string | null;
    onValueChange?: (value: string) => void
}) {
    const [query, setQuery] = useState(initialValue ?? "");
    const [results, setResults] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLLabelElement>(null);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            const params = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : "";
            const response = await fetch(`/api/expense-descriptions${params}`, {signal: controller.signal}).catch(() => null);
            if (!response?.ok) return;
            const data = await response.json();
            setResults(Array.isArray(data) ? data : []);
            setActiveIndex(0);
        }, 180);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [query]);

    function selectSuggestion(value: string) {
        setQuery(value);
        onValueChange?.(value);
        setIsOpen(false);
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (!isOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) setIsOpen(true);
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, results.length - 1));
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
        }
        if (event.key === "Enter" && isOpen && results[activeIndex]) {
            event.preventDefault();
            selectSuggestion(results[activeIndex]);
        }
        if (event.key === "Escape") setIsOpen(false);
    }

    return (
        <div className="app-form-field full">
            <label className="span-2 product-suggestion-picker app-form-field-label" ref={containerRef}>
                Prodotto/servizio
            </label>
            <input
                name="description"
                className="span-2"
                required
                placeholder="Descrizione libera della spesa ricorrente"
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    onValueChange?.(event.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={onKeyDown}
                autoComplete="off"
            />
            {isOpen && results.length > 0 && (
                <div className="suggestion-results" role="listbox">
                    {results.map((value, index) => (
                        <button
                            type="button"
                            key={`${value}-${index}`}
                            className={index === activeIndex ? "active" : ""}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                selectSuggestion(value);
                            }}
                        >
                            {value}
                        </button>
                    ))}
                </div>
            )}

        </div>
    );
}

export default function RecurringExpenseForm({
                                                 categories,
                                                 banks,
                                                 paymentMethods,
                                                 suppliers = [],
                                                 action = "/api/recurring-expenses",
                                                 initialExpense,
                                                 onCancel,
                                                 onSaved,
                                                 cancelHref,
                                                 onSwitchToSingle,
                                                 onSwitchToVatSettlement,
                                             }: Props) {
    const initialPaymentMethodId = initialExpense?.paymentMethodId && paymentMethods.some(method => method.id === initialExpense.paymentMethodId)
        ? String(initialExpense.paymentMethodId)
        : "";
    const cashBankIdValue = banks.find(bank => bank.name.trim().toLowerCase() === cashBankName.toLowerCase())?.id.toString()
        ?? banks.find(bank => bank.isFallback)?.id.toString()
        ?? "";
    const initialSelectedPaymentMethodName = paymentMethods.find(method => String(method.id) === initialPaymentMethodId)?.name ?? "";
    const initialBankId = isCashChannel(initialSelectedPaymentMethodName) && cashBankIdValue
        ? cashBankIdValue
        : initialExpense?.bankId?.toString() ?? banks.find(bank => bank.isPrimary)?.id.toString() ?? "";
    const [cadence, setCadence] = useState(initialExpense?.cadence ?? "MONTHLY");
    const [billingPeriodMode, setBillingPeriodMode] = useState(initialExpense?.billingPeriodMode ?? "SAME_MONTH");
    const [billingMonth, setBillingMonth] = useState(String(initialExpense?.billingMonth ?? new Date().getMonth() + 1));
    const [isDeclared, setIsDeclared] = useState(initialExpense?.isDeclared ?? true);
    const [hasElectronicInvoice, setHasElectronicInvoice] = useState(initialExpense?.hasElectronicInvoice ?? true);
    const [isAutomaticAccrual, setIsAutomaticAccrual] = useState(Boolean(initialExpense?.isAutomaticPayment));
    const [paymentMethodId, setPaymentMethodId] = useState(initialPaymentMethodId);
    const [bankId, setBankId] = useState(initialBankId);
    const [submitError, setSubmitError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mobileStep, setMobileStep] = useState(1);
    const [amount, setAmount] = useState(normalizeMoney(initialExpense?.amount).replace(".", ","));
    const [vatRate, setVatRate] = useState(normalizeMoney(initialExpense?.vatRate) || "22");
    const [startDate, setStartDate] = useState(toDateInput(initialExpense?.startDate) || today);
    const [dueDay, setDueDay] = useState(String(initialExpense?.dueDay ?? 1));
    const [dueMonth, setDueMonth] = useState(String(initialExpense?.dueMonth ?? new Date().getMonth() + 1));
    const [categoryId, setCategoryId] = useState(String(initialExpense?.categoryId ?? ""));
    const [supplierName, setSupplierName] = useState(
        suppliers.find(supplier => supplier.id === initialExpense?.supplierId)?.businessName ?? initialExpense?.merchant ?? "",
    );
    const [description, setDescription] = useState(initialExpense?.description ?? "");
    const [notes, setNotes] = useState(initialExpense?.notes ?? "");
    const formRef = useRef<HTMLFormElement>(null);
    const amountRef = useRef<HTMLInputElement>(null);
    const amountKeyStateRef = useRef<{ separatorDigits: 0 | 1 | null }>({separatorDigits: null});
    const selectedPaymentMethodName = paymentMethods.find(method => String(method.id) === paymentMethodId)?.name ?? "";
    const cashBankLocked = isAutomaticAccrual && isCashChannel(selectedPaymentMethodName) && Boolean(cashBankIdValue);
    const isYearly = cadence === "YEARLY" || cadence === "EVERY_2_YEARS";
    const normalizedAmount = amount.replace(",", ".");

    useEffect(() => {
        if (!isDeclared) {
            setBillingPeriodMode("SAME_MONTH");
            setHasElectronicInvoice(false);
            setVatRate("0");
        }
    }, [isDeclared]);

    function updateDeclared(checked: boolean) {
        setIsDeclared(checked);
        if (!checked) {
            setHasElectronicInvoice(false);
            setVatRate("0");
        } else if (vatRate === "0") {
            setVatRate("22");
        }
    }

    function handleAmountChange(value: string) {
        setAmount(formatCurrencyInput(value));
    }

    function appendAmountKey(key: string) {
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

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        if (window.matchMedia("(max-width: 900px)").matches && mobileStep < 6) {
            event.preventDefault();
            nextMobileStep();
            return;
        }
        if (!onSaved) return;
        event.preventDefault();
        setSubmitError("");
        setIsSubmitting(true);

        try {
            const response = await fetch(action, {
                method: "POST",
                body: new FormData(event.currentTarget),
                headers: {
                    Accept: "application/json",
                    "X-Requested-With": "fetch",
                },
            });
            if (!response.ok) {
                let message = "Impossibile salvare la spesa ricorrente.";
                try {
                    const payload = await response.json();
                    message = payload?.error || message;
                } catch {
                    // Non-JSON responses keep the generic message.
                }
                throw new Error(message);
            }
            onSaved();
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : "Impossibile salvare la spesa ricorrente.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form ref={formRef} className={`card form expense-form recurring-expense-form expense-mobile-wizard recurring-mobile-wizard expense-mobile-step-${mobileStep}`} action={action} method="post" onSubmit={handleSubmit} data-in-place-submit={onSaved ? "true" : undefined}>
            <div className="expense-wizard-header full">
                <div className="expense-wizard-heading">
                    <span>Passaggio {mobileStep} di 6</span>
                    <strong>{["Ricorrenza", "Importo", "Dettagli", "Fatturazione", "Pagamento", "Note"][mobileStep - 1]}</strong>
                </div>
                <div className="expense-wizard-progress" aria-label={`Passaggio ${mobileStep} di 6`}>
                    <span style={{width: `${mobileStep / 6 * 100}%`}}/>
                </div>
            </div>

            <div className="expense-type-choice full expense-wizard-step expense-wizard-step-1">
                <span className="expense-type-choice-title">Tipo di spesa</span>
                <div className="expense-type-choice-grid" role="radiogroup" aria-label="Tipo di spesa">
                    <button type="button" role="radio" aria-checked={false} disabled={!onSwitchToSingle} onClick={onSwitchToSingle}>
                        <span aria-hidden="true">●</span>
                        <strong>Singola</strong>
                        <small>Spesa occasionale</small>
                    </button>
                    <button type="button" className="is-selected" role="radio" aria-checked>
                        <span aria-hidden="true">↻</span>
                        <strong>Ricorrente</strong>
                        <small>Spesa periodica</small>
                    </button>
                    <button type="button" role="radio" aria-checked={false} disabled={!onSwitchToVatSettlement} onClick={onSwitchToVatSettlement}>
                        <span aria-hidden="true">IVA</span>
                        <strong>Saldo IVA</strong>
                        <small>Versamento IVA</small>
                    </button>
                </div>
            </div>

            <details className="form-section full recurring-form-section recurring-document-section recurring-dates-section" open>
                <summary>
                    <span>Ricorrenza e scadenza</span>
                    <small>Data iniziale, cadenza e giorno previsto</small>
                </summary>
                <div className="form-section-grid recurring-form-section-grid">
                    <DateField className="expense-wizard-step expense-wizard-step-1" label="Data inizio" name="startDate" value={startDate} onChange={setStartDate} required/>

                    <SelectField
                        className="expense-wizard-step expense-wizard-step-1"
                        label="Cadenza"
                        icon="↻"
                        name="cadence"
                        value={cadence}
                        onChange={setCadence}
                        required
                        options={[
                            {value: "MONTHLY", label: "Ogni mese"},
                            {value: "EVERY_2_MONTHS", label: "Ogni 2 mesi"},
                            {value: "EVERY_3_MONTHS", label: "Ogni 3 mesi"},
                            {value: "EVERY_6_MONTHS", label: "Ogni 6 mesi"},
                            {value: "YEARLY", label: "Annuale"},
                            {value: "EVERY_2_YEARS", label: "Ogni 2 anni"},
                        ]}
                    />

                    {isYearly ? (
                        <>
                            <FormField className="expense-wizard-step expense-wizard-step-1" label="Giorno scadenza" icon="№">
                                <input type="number" name="dueDay" min="1" max="31" value={dueDay} onChange={event => setDueDay(event.currentTarget.value)} required/>
                            </FormField>
                            <SelectField className="expense-wizard-step expense-wizard-step-1" label="Mese scadenza" icon="▦" name="dueMonth" value={dueMonth} onChange={setDueMonth} required options={monthOptions.map(([value, label]) => ({
                                value,
                                label
                            }))}/>
                        </>
                    ) : (
                        <FormField className="expense-wizard-step expense-wizard-step-1" label="Giorno del mese" icon="№">
                            <input type="number" name="dueDay" min="1" max="31" value={dueDay} onChange={event => setDueDay(event.currentTarget.value)} required/>
                        </FormField>
                    )}
                </div>
            </details>

            <details className="form-section full recurring-form-section recurring-document-section recurring-details-section" open>
                <summary>
                    <span>Fornitore e dettagli</span>
                    <small>Fornitore, categoria e descrizione della spesa</small>
                </summary>
                <div className="form-section-grid recurring-form-section-grid">
                    <SupplierAutocomplete suppliers={suppliers} initialSupplierId={initialExpense?.supplierId ?? null} initialMerchant={initialExpense?.merchant ?? ""} onValueChange={setSupplierName} categories={categories}/>

                    <SelectField className="expense-wizard-step expense-wizard-step-3" label="Categoria" icon="◇" name="categoryId" required value={categoryId} onChange={setCategoryId} options={[
                        {value: "", label: "Seleziona categoria", disabled: true},
                        ...categories.map(category => ({
                            value: category.id,
                            label: category.icon ? `${categoryIcon(category)} ${category.name}` : category.name
                        }))
                    ]}/>

                    <ProductServiceAutocomplete initialValue={initialExpense?.description ?? ""} onValueChange={setDescription}/>
                </div>
            </details>

            <details className="form-section full recurring-form-section recurring-document-section recurring-amount-section" open>
                <summary>
                    <span>Importo e IVA</span>
                    <small>Fiscalità, importo e aliquota IVA</small>
                </summary>
                <div className="form-section-grid recurring-form-section-grid">
                    <div className="amount-vat-row expense-wizard-step expense-wizard-step-2 recurring-wizard-amount">
                        <div className="recurring-wizard-amount-entry full">
                            <div className="toggle-field switch-toggle-field recurring-switch-control recurring-fiscal-switch">
                                <div className="switch-toggle-field-label">
                                    <span className="app-form-field-icon">⇆</span>
                                <label>Fiscale</label>
                                </div>
                                    <label className="switch">
                                    <input type="checkbox" name="isDeclared" value="true" checked={isDeclared} onChange={event => {
                                        updateDeclared(event.currentTarget.checked);
                                        focusAmount();
                                    }}/>
                                    <span className="slider"/>
                                    {/*<span className="text-muted ml-12 hidden-mobile">{isDeclared ? "Fiscale" : "Non Dichiarato"}</span>*/}
                                </label>
                            </div>
                            <div className="recurring-amount-control flex-grow">
                                <label className="recurring-wizard-amount-field">Costo IVA inclusa<MoneyInput inputRef={amountRef} value={amount} onValueChange={handleAmountChange} required/><input type="hidden" name="amount" value={normalizedAmount}/></label>
                                <div className="expense-wizard-vat-buttons recurring-vat-buttons-desktop" aria-label="Selezione rapida IVA">
                                    {["0", "4", "10", "22"].map(rate =>
                                        <button type="button" key={rate} className={vatRate === rate ? "is-selected" : ""} disabled={!isDeclared} onMouseDown={event => event.preventDefault()} onClick={() => {
                                            setVatRate(rate);
                                            focusAmount();
                                        }}>{rate}%</button>)}
                                </div>
                            </div>
                        </div>
                        <div className="expense-wizard-vat-buttons recurring-vat-buttons-mobile" aria-label="Selezione rapida IVA">
                            {["0", "4", "10", "22"].map(rate =>
                                <button type="button" key={rate} className={vatRate === rate ? "is-selected" : ""} disabled={!isDeclared} onMouseDown={event => event.preventDefault()} onClick={() => {
                                    setVatRate(rate);
                                    focusAmount();
                                }}>{rate}%</button>)}
                        </div>
                        <input type="hidden" name="vatRate" value={isDeclared ? vatRate : "0"}/>
                        <div className="expense-wizard-keypad full" aria-label="Tastiera numerica">
                            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "backspace"].map(key =>
                                <button type="button" key={key} aria-label={key === "backspace" ? "Cancella ultima cifra" : key} onMouseDown={event => event.preventDefault()} onClick={() => appendAmountKey(key)}>{key === "backspace" ? "⌫" : key}</button>)}
                        </div>
                    </div>
                </div>
            </details>

            <details className="form-section full recurring-form-section recurring-fiscal-section expense-wizard-step expense-wizard-step-4" open>
                <summary>
                    <span>Fatturazione</span>
                    <small>Fattura elettronica e periodo fatturazione</small>
                </summary>
                <div className="form-section-grid recurring-form-section-grid">
                    <div className="toggle-field switch-toggle-field recurring-switch-control recurring-invoice-switch">
                        <div className="switch-toggle-field-label">
                            <span className="app-form-field-icon">⇆</span>
                            <label>Fattura elettronica</label>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                name="hasElectronicInvoice"
                                value="true"
                                checked={hasElectronicInvoice}
                                disabled={!isDeclared}
                                onChange={(e) => setHasElectronicInvoice(e.currentTarget.checked)}
                            />
                            <span className="slider"/>
                            <span className="text-muted ml-12">{hasElectronicInvoice ? "Elettronica" : "PDF"}</span>
                        </label>
                    </div>

                    <SelectField label="Periodo fatturazione" icon="▦" name="billingPeriodMode" value={billingPeriodMode} disabled={!isDeclared} onChange={setBillingPeriodMode} options={[
                        {value: "SAME_MONTH", label: "Stesso mese"},
                        {value: "NEXT_MONTH", label: "Mese successivo"},
                        {value: "CUSTOM_MONTH", label: "Imposta mese"},
                    ]}/>
                    {!isDeclared && <input type="hidden" name="billingPeriodMode" value="SAME_MONTH"/>}
                    {billingPeriodMode === "CUSTOM_MONTH" && isDeclared ?
                        <SelectField label="Mese contabile" icon="▦" name="billingMonth" value={billingMonth} onChange={setBillingMonth} options={monthOptions.map(([value, label]) => ({
                            value,
                            label
                        }))}/> : null}
                </div>
            </details>

            <details className="form-section full recurring-form-section recurring-payment-section expense-wizard-step expense-wizard-step-5" open>
                <summary>
                    <span>Pagamento</span>
                    <small>Automazione, canale e banca</small>
                </summary>
                <div className="form-section-grid recurring-form-section-grid">
                    <div className="toggle-field switch-toggle-field recurring-switch-control recurring-accrual-toggle">
                        <div className="switch-toggle-field-label">
                            <span className="app-form-field-icon">⇆</span>
                            <label> Pagamento automatico</label>
                            <input type="hidden" name="isAutomaticPayment" value={isAutomaticAccrual ? "true" : "false"}/>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={isAutomaticAccrual}
                                onChange={(event) => setIsAutomaticAccrual(event.currentTarget.checked)}
                            />
                            <span className="slider"/>
                            <span className="text-muted ml-12">{isAutomaticAccrual ? "Automatico" : "Manuale"}</span>
                        </label>
                    </div>

                    <SelectField label="Canale di pagamento" icon="▣" name="paymentMethodId" value={paymentMethodId} disabled={!isAutomaticAccrual} required={isAutomaticAccrual}
                                 onChange={(nextPaymentMethodId) => {
                                     const nextPaymentMethodName = paymentMethods.find(method => String(method.id) === nextPaymentMethodId)?.name ?? "";
                                     setPaymentMethodId(nextPaymentMethodId);
                                     if (isCashChannel(nextPaymentMethodName) && cashBankIdValue) {
                                         setBankId(cashBankIdValue);
                                     } else if (isCashChannel(selectedPaymentMethodName)) {
                                         setBankId(banks.find(bank => bank.isPrimary)?.id.toString() ?? "");
                                     }
                                 }}
                                 options={[{
                                     value: "",
                                     label: "Seleziona canale"
                                 }, ...paymentMethods.map(method => ({
                                     value: method.id,
                                     label: `${method.icon ?? '•'} ${method.name}`
                                 }))]}
                    />
                    {cashBankLocked ? <input type="hidden" name="bankId" value={cashBankIdValue}/> : null}
                    <SelectField label="Banca" icon="▥" name="bankId" value={cashBankLocked ? cashBankIdValue : bankId} disabled={!isAutomaticAccrual || cashBankLocked} required={isAutomaticAccrual && !cashBankLocked} onChange={setBankId}
                                 options={[{value: "", label: "Seleziona banca"}, ...banks.map(bank => ({
                                     value: bank.id,
                                     label: `${bank.icon ?? '•'} ${bank.name}`
                                 }))]}
                    />
                </div>
            </details>

            <details className="form-section full recurring-form-section recurring-notes-section expense-wizard-step expense-wizard-step-6" open={mobileStep === 6}>
                <summary>
                    <span>Note</span>
                    <small>Note interne opzionali</small>
                </summary>
                <div className="form-section-stack">
                    <section className="recurring-review-summary" aria-label="Riepilogo spesa ricorrente">
                        <div className="expense-review-heading">
                            <div><span className="expense-review-kicker">Controlla prima di salvare</span>
                                <h3>Riepilogo della ricorrenza</h3></div>
                            <strong>€ {Number(normalizedAmount || 0).toLocaleString("it-IT", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })}</strong>
                        </div>
                        <div className="expense-review-grid">
                            <div className="expense-review-item">
                                <i aria-hidden="true">◷</i><span>Data inizio<strong>{startDate ? new Date(`${startDate}T12:00:00`).toLocaleDateString("it-IT") : "Non indicata"}</strong></span>
                            </div>
                            <div className="expense-review-item"><i aria-hidden="true">↻</i><span>Ricorrenza<strong>{({
                                MONTHLY: "Ogni mese",
                                EVERY_2_MONTHS: "Ogni 2 mesi",
                                EVERY_3_MONTHS: "Ogni 3 mesi",
                                EVERY_6_MONTHS: "Ogni 6 mesi",
                                YEARLY: "Annuale",
                                EVERY_2_YEARS: "Ogni 2 anni"
                            } as Record<string, string>)[cadence]} · giorno {dueDay}{isYearly ? ` ${monthOptions.find(([value]) => String(value) === dueMonth)?.[1] ?? ""}` : ""}</strong></span>
                            </div>
                            <div className="expense-review-item wide">
                                <i aria-hidden="true">◎</i><span>Fornitore<strong>{supplierName || "Non indicato"}</strong></span>
                            </div>
                            <div className="expense-review-item wide">
                                <i aria-hidden="true">◇</i><span>Categoria<strong>{categories.find(category => String(category.id) === categoryId)?.name ?? "Non indicata"}</strong></span>
                            </div>
                            <div className="expense-review-item wide">
                                <i aria-hidden="true">≡</i><span>Descrizione<strong>{description || "Non indicata"}</strong></span>
                            </div>
                            <div className="expense-review-item">
                                <i aria-hidden="true">%</i><span>Fiscale / IVA<strong>{isDeclared ? `Sì · ${vatRate}%` : "No · 0%"}</strong></span>
                            </div>
                            <div className="expense-review-item">
                                <i aria-hidden="true">▤</i><span>Fatturazione<strong>{hasElectronicInvoice ? "Fattura elettronica" : "Senza fattura elettronica"}</strong></span>
                            </div>
                            <div className="expense-review-item wide">
                                <i aria-hidden="true">€</i><span>Pagamento<strong>{isAutomaticAccrual ? `${selectedPaymentMethodName || "Canale non indicato"} · ${banks.find(bank => String(bank.id) === bankId)?.name ?? "Banca non indicata"}` : "Manuale"}</strong></span>
                            </div>
                        </div>
                    </section>
                    <label className="full">Note<textarea name="notes" rows={3} value={notes} onChange={event => setNotes(event.currentTarget.value)}/></label>
                </div>
            </details>

            <div className="expense-wizard-actions full">
                {submitError ? <p className="inline-warning full">{submitError}</p> : null}
                <div className="expense-wizard-actions-row">
                    {mobileStep > 1 ?
                        <button className="btn btn-md btn-default" type="button" onClick={() => goToMobileStep(mobileStep - 1)}>← Indietro</button> : onCancel ?
                            <button className="btn btn-md btn-default" type="button" onClick={onCancel}>× Annulla</button> : cancelHref ?
                                <a className="btn btn-md btn-default" href={cancelHref}>× Annulla</a> : <span/>}
                    {mobileStep < 6 ? <button className="btn btn-md btn-primary" type="button" onClick={event => {
                            event.preventDefault();
                            nextMobileStep();
                        }}>Avanti →</button> :
                        <button className="btn btn-md btn-primary" type="submit" disabled={isSubmitting}>
                            <span className="btn-icon">✓</span> {isSubmitting ? "Salvataggio..." : "Salva spesa"}
                        </button>}
                </div>
            </div>

            <div className="actions-row full form-actions-row form-sticky-actions">
                {submitError ? <p className="inline-warning full">{submitError}</p> : null}
                <button className="btn btn-md btn-primary" type="submit" disabled={isSubmitting}>
                    <span className="btn-icon">✓</span> {isSubmitting ? "Salvataggio..." : "Salva spesa"}</button>
                {onCancel ? (
                    <button type="button" className="btn btn-md btn-default" onClick={onCancel}>
                        <span className="btn-icon">×</span> Annulla</button>
                ) : cancelHref ? (
                    <a className="btn btn-md btn-default" href={cancelHref}><span className="btn-icon">×</span> Annulla</a>
                ) : null}
            </div>
        </form>
    );
}
