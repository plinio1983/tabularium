"use client";

import {type FormEvent, type ReactNode, useEffect, useRef, useState} from "react";
import {categoryIcon} from "@/lib/expense-ui";
import {DateField, FormField, SelectField} from "@/components/FormControls";
import {CurrencyInput} from "@/components/CurrencyInput";
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {dateInputInTimeZone, zonedCalendarParts} from '@/lib/company-time';
import SupplierCreateModal from "@/components/SupplierCreateModal";
import {applyCurrencyInputKeyWithState, formatCurrencyInput, resetCurrencyInput} from "@/lib/currency-input";
import MobileFormStickyActions from "@/components/MobileFormStickyActions";
import ExpenseTypeChoice from "@/components/ExpenseTypeChoice";
import {resolveSupplierDefaultVatRate} from '@/lib/supplier-defaults';
import {formatItalianCompactDate} from '@/lib/date-format';

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
    defaultExpenseCategoryId?: number | null;
    defaultVatRate?: string | number | {toString(): string} | null;
};
type EmployeeOption = { id: number; firstName: string; lastName: string; employeeCode?: string | null; status: "ACTIVE" | "INACTIVE" };
type TaxAuthorityOption = { id: number; name: string; shortName?: string | null; isActive?: boolean };
type InitialRecurringExpense = {
    id?: number | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    archivedAt?: string | Date | null;
    cadence?: string | null;
    dueDay?: number | null;
    dueMonth?: number | null;
    generationTiming?: string | null;
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
    expenseType?: "STANDARD" | "TAX_CONTRIBUTION" | "PAYROLL";
    taxAuthorityId?: number | null;
    employeeId?: number | null;
    payrollNetAmount?: string | number | { toString(): string } | null;
    payrollExtraCompensation?: string | number | { toString(): string } | null;
    payrollGrossAmount?: string | number | { toString(): string } | null;
    payrollEmployerCost?: string | number | { toString(): string } | null;
    payrollPeriodMode?: string | null;
    payrollPeriodMonthOffset?: number | null;
    payrollPeriodStartDay?: number | null;
    payrollPeriodEndDay?: number | null;
    affectsFiscalProfit?: boolean;
};

type Props = {
    categories: Option[];
    banks: Option[];
    paymentMethods: Option[];
    suppliers?: SupplierOption[];
    employees?: EmployeeOption[];
    action?: string;
    initialExpense?: InitialRecurringExpense;
    onCancel?: () => void;
    onSaved?: () => void;
    cancelHref?: string;
    onSwitchToSingle?: () => void;
    onSwitchToVatSettlement?: () => void;
    onSwitchToTaxContribution?: () => void;
    onSwitchToPayroll?: () => void;
    mobileStepOffset?: number;
    onBackToType?: () => void;
    hideMobileActions?: boolean;
    recurrenceControl?: ReactNode;
};

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
const generationTimingOptions = [
    {value: "FIRST_OF_MONTH", label: "Il primo del mese"},
    {value: "DAYS_7_BEFORE", label: "7 giorni prima della scadenza"},
    {value: "DAYS_10_BEFORE", label: "10 giorni prima della scadenza"},
    {value: "DAYS_15_BEFORE", label: "15 giorni prima della scadenza"},
    {value: "DAYS_30_BEFORE", label: "30 giorni prima della scadenza"},
    {value: "ON_DUE_DATE", label: "Il giorno di scadenza"},
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
            <CurrencyInput ref={inputRef} clearable {...props} />
        </div>
    );
}

function SupplierAutocomplete({
                                  suppliers = [],
                                  initialSupplierId,
                                  initialMerchant,
                                  onValueChange,
                                  onSupplierSelected,
                                  categories = [],
                              }: {
    suppliers?: SupplierOption[];
    initialSupplierId?: number | null;
    initialMerchant?: string | null;
    onValueChange?: (value: string) => void;
    onSupplierSelected?: (supplier: SupplierOption) => void;
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
        onSupplierSelected?.(supplier);
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
        <div className="entity-autocomplete entity-autocomplete-wide" ref={containerRef}>
            <input type="hidden" name="supplierId" value={selected?.id ?? ""}/>
            <input type="hidden" name="merchant" value={selected?.businessName ?? query}/>
            <div className="app-form-field-label entity-autocomplete-heading">
                <label className="entity-autocomplete-label" htmlFor="recurring-expense-supplier-search">
                    <span className="app-form-field-icon" aria-hidden="true">◎</span>
                    <span>Esercente/Fornitore</span>
                </label>
                <button
                    type="button"
                    className="btn btn-sm btn-link entity-autocomplete-create mr-22"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setShowCreate(true);
                    }}
                >
                    ＋ Nuovo
                </button>
            </div>
            <div className="entity-autocomplete-input-row">
                    <input
                        id="recurring-expense-supplier-search"
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
            </div>

            {isOpen && (
                <div className="entity-autocomplete-results" role="listbox">
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
                        <div className="entity-autocomplete-empty">Nessun esercente/fornitore trovato.</div>
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
                                                 onSwitchToTaxContribution,
                                                 onSwitchToPayroll,
                                                 mobileStepOffset = 0,
                                                 onBackToType,
                                                 hideMobileActions = false,
                                                 employees = [],
                                                 recurrenceControl,
                                             }: Props) {
    const isExistingExpense = Boolean(initialExpense?.id);
    const timeZone = useCompanyTimeZone();
    const today = dateInputInTimeZone(timeZone);
    const currentMonth = zonedCalendarParts(new Date(), timeZone)?.month ?? 1;
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
    const [expenseType, setExpenseType] = useState<"STANDARD" | "TAX_CONTRIBUTION" | "PAYROLL">(initialExpense?.expenseType ?? "STANDARD");
    const isTaxContribution = expenseType === "TAX_CONTRIBUTION";
    const isPayroll = expenseType === "PAYROLL";
    const [taxAuthorities, setTaxAuthorities] = useState<TaxAuthorityOption[]>([]);
    const [taxAuthorityId, setTaxAuthorityId] = useState(String(initialExpense?.taxAuthorityId ?? ""));
    const [employeeId, setEmployeeId] = useState(String(initialExpense?.employeeId ?? ""));
    const [payrollNetAmount, setPayrollNetAmount] = useState(normalizeMoney(initialExpense?.payrollNetAmount ?? initialExpense?.amount).replace(".", ","));
    const [payrollExtraCompensation, setPayrollExtraCompensation] = useState(normalizeMoney(initialExpense?.payrollExtraCompensation).replace(".", ","));
    const [payrollGrossAmount, setPayrollGrossAmount] = useState(normalizeMoney(initialExpense?.payrollGrossAmount).replace(".", ","));
    const [payrollEmployerCost, setPayrollEmployerCost] = useState(normalizeMoney(initialExpense?.payrollEmployerCost).replace(".", ","));
    const [payrollPeriodMode, setPayrollPeriodMode] = useState(initialExpense?.payrollPeriodMode ?? "FULL_MONTH");
    const [payrollPeriodMonthOffset, setPayrollPeriodMonthOffset] = useState(String(initialExpense?.payrollPeriodMonthOffset ?? -1));
    const [payrollPeriodStartDay, setPayrollPeriodStartDay] = useState(String(initialExpense?.payrollPeriodStartDay ?? 1));
    const [payrollPeriodEndDay, setPayrollPeriodEndDay] = useState(String(initialExpense?.payrollPeriodEndDay ?? 31));
    const [affectsFiscalProfit, setAffectsFiscalProfit] = useState(initialExpense?.affectsFiscalProfit ?? (isTaxContribution || isPayroll));
    const [billingPeriodMode, setBillingPeriodMode] = useState(initialExpense?.billingPeriodMode ?? "SAME_MONTH");
    const [billingMonth, setBillingMonth] = useState(String(initialExpense?.billingMonth ?? currentMonth));
    const [isDeclared, setIsDeclared] = useState(initialExpense?.isDeclared ?? true);
    const [hasElectronicInvoice, setHasElectronicInvoice] = useState(initialExpense?.hasElectronicInvoice ?? true);
    const [isAutomaticAccrual, setIsAutomaticAccrual] = useState(Boolean(initialExpense?.isAutomaticPayment));
    const [paymentMethodId, setPaymentMethodId] = useState(initialPaymentMethodId);
    const [bankId, setBankId] = useState(initialBankId);
    const [submitError, setSubmitError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mobileStep, setMobileStep] = useState(1);
    const initialSupplier = suppliers.find(supplier => supplier.id === initialExpense?.supplierId);
    const fallbackCategoryId = categories.find(category => category.code === "DEFAULT")?.id;
    const [amount, setAmount] = useState(normalizeMoney(initialExpense?.amount).replace(".", ","));
    const [vatRate, setVatRate] = useState(
        initialExpense?.vatRate != null
            ? normalizeMoney(initialExpense.vatRate)
            : initialSupplier?.defaultVatRate != null
                ? normalizeMoney(initialSupplier.defaultVatRate)
                : "22",
    );
    const [startDate, setStartDate] = useState(toDateInput(initialExpense?.startDate) || today);
    const [hasEndDate, setHasEndDate] = useState(Boolean(initialExpense?.endDate));
    const [endDate, setEndDate] = useState(toDateInput(initialExpense?.endDate));
    const [dueDay, setDueDay] = useState(String(Math.min(30, initialExpense?.dueDay ?? 1)));
    const [dueMonth, setDueMonth] = useState(String(initialExpense?.dueMonth ?? currentMonth));
    const [generationTiming, setGenerationTiming] = useState(initialExpense?.generationTiming ?? "FIRST_OF_MONTH");
    const [categoryId, setCategoryId] = useState(String(
        initialExpense?.categoryId
        ?? initialSupplier?.defaultExpenseCategoryId
        ?? fallbackCategoryId
        ?? ""
    ));
    const [supplierName, setSupplierName] = useState(
        suppliers.find(supplier => supplier.id === initialExpense?.supplierId)?.businessName ?? initialExpense?.merchant ?? "",
    );
    const [description, setDescription] = useState(initialExpense?.description ?? (initialExpense?.expenseType === "PAYROLL" ? "Competenze" : ""));
    const [notes, setNotes] = useState(initialExpense?.notes ?? "");
    const formRef = useRef<HTMLFormElement>(null);
    const amountRef = useRef<HTMLInputElement>(null);
    const amountKeyStateRef = useRef<{ separatorDigits: 0 | 1 | null }>({separatorDigits: null});
    const vatRateTouchedRef = useRef(false);
    const selectedPaymentMethodName = paymentMethods.find(method => String(method.id) === paymentMethodId)?.name ?? "";
    const cashBankLocked = isAutomaticAccrual && isCashChannel(selectedPaymentMethodName) && Boolean(cashBankIdValue);
    const isYearly = cadence === "YEARLY" || cadence === "EVERY_2_YEARS";
    const normalizedPayrollNet = payrollNetAmount.replace(",", ".");
    const normalizedPayrollExtra = payrollExtraCompensation.replace(",", ".");
    const normalizedAmount = isPayroll ? (Number(normalizedPayrollNet || 0) + Number(normalizedPayrollExtra || 0)).toFixed(2) : amount.replace(",", ".");
    const amountValue = Number(normalizedAmount || 0);
    const activeVatRate = isDeclared ? Number(vatRate || 0) : 0;
    const netAmount = activeVatRate > 0 ? amountValue / (1 + activeVatRate / 100) : amountValue;

    useEffect(() => {
        if (!isTaxContribution) return;
        fetch('/api/tax-authorities', {cache: 'no-store'})
            .then(response => response.ok ? response.json() : [])
            .then((records: TaxAuthorityOption[]) => setTaxAuthorities(records))
            .catch(() => setTaxAuthorities([]));
    }, [isTaxContribution]);

    useEffect(() => {
        if (!isTaxContribution && !isPayroll) return;
        setIsDeclared(false);
        setHasElectronicInvoice(false);
        setVatRate("0");
        setBillingPeriodMode("SAME_MONTH");
        setAffectsFiscalProfit(true);
        if (isPayroll && !description.trim()) setDescription("Competenze");
    }, [description, isPayroll, isTaxContribution]);

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
        amountRef.current?.setCustomValidity("");
    }

    function appendAmountKey(key: string) {
        setAmount(current => applyCurrencyInputKeyWithState(current, key, amountKeyStateRef.current));
        amountRef.current?.setCustomValidity("");
        focusAmount();
    }

    function focusAmount() {
        window.requestAnimationFrame(() => amountRef.current?.focus({preventScroll: true}));
    }

    useEffect(() => {
        if (mobileStep === 2 && window.matchMedia("(max-width: 900px)").matches) focusAmount();
    }, [mobileStep]);

    function validateMobileStep() {
        if (mobileStep === 2 && (!Number.isFinite(amountValue) || amountValue <= 0)) {
            amountRef.current?.setCustomValidity("Inserisci un importo maggiore di zero.");
            amountRef.current?.reportValidity();
            amountRef.current?.focus();
            return false;
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
        setMobileStep(Math.max(1, Math.min(6, step)));
        window.requestAnimationFrame(() => {
            const scrollContainer = formRef.current?.closest<HTMLElement>(".modal-card");
            if (scrollContainer) scrollContainer.scrollTo({top: 0, behavior: "auto"});
            window.scrollTo({top: 0, behavior: "auto"});
        });
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
        <form ref={formRef} className={`form app-record-form recurring-record-form recurring-expense-form app-form-wizard recurring-form-wizard app-form-wizard-current-${mobileStep} ${mobileStepOffset ? "expense-type-step-external" : ""}`} action={action} method="post" onSubmit={handleSubmit} data-in-place-submit={onSaved ? "true" : undefined}>
            <div className="app-form-wizard-header full">
                <div className="app-form-wizard-heading">
                    <span>Passaggio {mobileStep + mobileStepOffset} di {6 + mobileStepOffset}</span>
                    <strong>
                        <span>{["Ricorrenza", "Importo", "Dettagli", "Fatturazione", "Pagamento", "Note"][mobileStep - 1]}</span>
                    </strong>
                </div>
                <div className="app-form-wizard-progress" aria-label={`Passaggio ${mobileStep + mobileStepOffset} di ${6 + mobileStepOffset}`}>
                    <span style={{width: `${(mobileStep + mobileStepOffset) / (6 + mobileStepOffset) * 100}%`}}/>
                </div>
            </div>

            <input type="hidden" name="expenseType" value={expenseType}/>
            <ExpenseTypeChoice
                selected={isTaxContribution ? "tax" : isPayroll ? "payroll" : "single"}
                className="app-form-wizard-step app-form-wizard-step-1"
                disabled={isExistingExpense}
                onSelect={type => {
                    if (type === "single") setExpenseType("STANDARD");
                    if (type === "tax") setExpenseType("TAX_CONTRIBUTION");
                    if (type === "payroll") setExpenseType("PAYROLL");
                }}
                disabledTypes={[
                    "vat",
                    "recurring",
                ]}
                onSelectCounter={undefined}
            />
            {recurrenceControl}

            <details className="form-section full recurring-form-section recurring-document-section recurring-dates-section" open>
                <summary>
                    <span>Ricorrenza e scadenza</span>
                    <small>Data iniziale, cadenza e giorno previsto</small>
                </summary>
                <div className="form-section-grid recurring-form-section-grid">
                    <DateField className="app-form-wizard-step app-form-wizard-step-1" label="Data inizio" name="startDate" value={startDate} onChange={setStartDate} required/>

                    <SelectField
                        className="app-form-wizard-step app-form-wizard-step-1"
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
                            <SelectField className="app-form-wizard-step app-form-wizard-step-1" label="Giorno scadenza" icon="№" name="dueDay" value={dueDay} onChange={setDueDay} required options={Array.from({length: 30}, (_, index) => ({
                                value: index + 1,
                                label: String(index + 1)
                            }))}/>
                            <SelectField className="app-form-wizard-step app-form-wizard-step-1" label="Mese scadenza" icon="▦" name="dueMonth" value={dueMonth} onChange={setDueMonth} required options={monthOptions.map(([value, label]) => ({
                                value,
                                label
                            }))}/>
                        </>
                    ) : (
                        <SelectField className="app-form-wizard-step app-form-wizard-step-1" label="Giorno del mese" icon="№" name="dueDay" value={dueDay} onChange={setDueDay} required options={Array.from({length: 30}, (_, index) => ({
                            value: index + 1,
                            label: String(index + 1)
                        }))}/>
                    )}
                    <SelectField
                        className="app-form-wizard-step app-form-wizard-step-1"
                        label="Generazione spesa"
                        icon="◷"
                        name="generationTiming"
                        value={generationTiming}
                        onChange={setGenerationTiming}
                        required
                        options={[...generationTimingOptions]}
                    />
                    <div className="app-form-field app-form-wizard-step app-form-wizard-step-1 switch-toggle-field switch-inline wide push-down">
                        <div className="switch-toggle-field-label app-form-field-label">
                            <span className="app-form-field-icon" aria-hidden="true">◷</span><span className="app-form-label">Imposta scadenza</span>
                        </div>
                        <label className="switch"><input type="checkbox" checked={hasEndDate} onChange={event => setHasEndDate(event.currentTarget.checked)}/><span className="slider"/></label>
                    </div>
                    {hasEndDate ?
                        <DateField className="app-form-wizard-step app-form-wizard-step-1" label="Data di fine" name="endDate" value={endDate} onChange={setEndDate} min={startDate} required/> : null}
                </div>
            </details>

            <details className="form-section full recurring-form-section recurring-document-section recurring-details-section app-form-wizard-step app-form-wizard-step-3" open>
                <summary>
                    <span>{isPayroll ? "Dipendente e competenza" : isTaxContribution ? "Ente e dettagli" : "Fornitore e dettagli"}</span>
                    <small>Dati specifici, categoria e descrizione della spesa</small>
                </summary>
                <div className="form-section-grid recurring-form-section-grid">
                    {!isTaxContribution && !isPayroll ? <SupplierAutocomplete suppliers={suppliers} initialSupplierId={initialExpense?.supplierId ?? null} initialMerchant={initialExpense?.merchant ?? ""} onValueChange={setSupplierName} categories={categories} onSupplierSelected={supplier => {
                        if (supplier.defaultExpenseCategoryId && categories.some(category => category.id === supplier.defaultExpenseCategoryId)) {
                            setCategoryId(String(supplier.defaultExpenseCategoryId));
                        }
                        if (!vatRateTouchedRef.current && isDeclared && supplier.defaultVatRate != null) {
                            setVatRate(current => resolveSupplierDefaultVatRate({
                                currentVatRate: current,
                                supplierDefaultVatRate: supplier.defaultVatRate,
                                vatRateTouched: vatRateTouchedRef.current,
                                isFiscal: isDeclared,
                            }));
                        }
                    }}/> : null}

                    {isTaxContribution ? <SelectField label="Ente fiscale" icon="⌂" name="taxAuthorityId" required value={taxAuthorityId} onChange={setTaxAuthorityId} options={[
                        {value: "", label: "Seleziona ente fiscale", disabled: true},
                        ...taxAuthorities.filter(item => item.isActive !== false || String(item.id) === taxAuthorityId).map(item => ({value: item.id, label: item.shortName ? `${item.shortName} · ${item.name}` : item.name}))
                    ]}/> : null}

                    {isPayroll ? <SelectField label="Dipendente" icon="♙" name="employeeId" required value={employeeId} onChange={setEmployeeId} options={[
                        {value: "", label: "Seleziona dipendente", disabled: true},
                        ...employees.filter(item => item.status === "ACTIVE" || String(item.id) === employeeId).map(item => ({value: item.id, label: `${item.lastName} ${item.firstName}${item.employeeCode ? ` · ${item.employeeCode}` : ""}`}))
                    ]}/> : null}

                    <SelectField label="Categoria" icon="◇" name="categoryId" required value={categoryId} onChange={setCategoryId} options={[
                        {value: "", label: "Seleziona categoria", disabled: true},
                        ...categories.map(category => ({
                            value: category.id,
                            label: category.icon ? `${categoryIcon(category)} ${category.name}` : category.name
                        }))
                    ]}/>

                    <ProductServiceAutocomplete initialValue={initialExpense?.description ?? (isPayroll ? "Competenze" : "")} onValueChange={setDescription}/>

                    {isPayroll ? <>
                        <SelectField label="Mese di competenza" icon="▦" name="payrollPeriodMonthOffset" value={payrollPeriodMonthOffset} onChange={setPayrollPeriodMonthOffset} options={[
                            {value: -1, label: "Mese precedente"},
                            {value: 0, label: "Stesso mese contabile"},
                        ]}/>
                        <SelectField label="Durata competenza" icon="↔" name="payrollPeriodMode" value={payrollPeriodMode} onChange={setPayrollPeriodMode} options={[
                            {value: "FULL_MONTH", label: "Intero mese"},
                            {value: "DAY_RANGE", label: "Intervallo di giorni"},
                        ]}/>
                        {payrollPeriodMode === "DAY_RANGE" ? <>
                            <FormField label="Dal giorno" icon="№"><input type="number" name="payrollPeriodStartDay" min="1" max="31" required value={payrollPeriodStartDay} onChange={event => setPayrollPeriodStartDay(event.currentTarget.value)}/></FormField>
                            <FormField label="Al giorno" icon="№"><input type="number" name="payrollPeriodEndDay" min="1" max="31" required value={payrollPeriodEndDay} onChange={event => setPayrollPeriodEndDay(event.currentTarget.value)}/></FormField>
                        </> : null}
                    </> : null}
                </div>
            </details>

            <details className="form-section full recurring-form-section recurring-document-section recurring-amount-section" open>
                <summary>
                    <span>{isPayroll ? "Importi busta paga" : isTaxContribution ? "Importo imposta" : "Importo e IVA"}</span>
                    <small>{isPayroll ? "Netto, compensi e costo aziendale" : "Fiscalità e importo della spesa"}</small>
                </summary>
                <div className="form-section-grid recurring-form-section-grid">
                    <div className="amount-vat-row app-form-wizard-step app-form-wizard-step-2 recurring-wizard-amount">
                        <div className="recurring-wizard-amount-entry full">
                            {!isTaxContribution && !isPayroll ? <div className="switch-toggle-field recurring-switch-control recurring-fiscal-switch">
                                <div className="app-form-field-label switch-toggle-field-label">
                                    <span className="app-form-field-icon">⇆</span>
                                    <span>Fiscale</span>
                                </div>
                                <label className="switch">
                                    <input type="checkbox" name="isDeclared" value="true" checked={isDeclared} onChange={event => {
                                        updateDeclared(event.currentTarget.checked);
                                        focusAmount();
                                    }}/>
                                    <span className="slider"/>
                                    <small className="text-muted hidden-md-down">{isDeclared ? "Fiscale" : "Non Fiscale"}</small>
                                </label>
                            </div> : null}
                            <div className="recurring-amount-control flex-grow">
                                <label className="recurring-wizard-amount-field">
                                    <div className="app-form-field-label switch-toggle-field-label">
                                        <span className="app-form-field-icon">€</span>
                                        <span>{isPayroll ? "Netto da pagare" : "Costo IVA inclusa"}</span>
                                        {!isPayroll && !isTaxContribution ? <span className="recurring-expense-amount-vat-excluded" aria-live="polite">
                                            <strong>€ {netAmount.toLocaleString("it-IT", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}</strong>
                                        </span> : null}
                                    </div>
                                    <MoneyInput inputRef={amountRef} value={isPayroll ? payrollNetAmount : amount} onValueChange={isPayroll ? value => setPayrollNetAmount(formatCurrencyInput(value)) : handleAmountChange}
                                                onClear={() => resetCurrencyInput(amountKeyStateRef.current)} required suppressSoftKeyboard/>
                                    <input type="hidden" name="amount" value={normalizedAmount}/>
                                    {isPayroll ? <input type="hidden" name="payrollNetAmount" value={normalizedPayrollNet}/> : null}
                                </label>
                                {!isTaxContribution && !isPayroll ? <div className="app-vat-rate-buttons recurring-vat-buttons-desktop vat-buttons-desktop" aria-label="Selezione rapida IVA">
                                    {["0", "4", "10", "22"].map(rate =>
                                        <button type="button" key={rate} className={vatRate === rate ? "is-selected" : ""} disabled={!isDeclared} onMouseDown={event => event.preventDefault()} onClick={() => {
                                            vatRateTouchedRef.current = true;
                                            setVatRate(rate);
                                            focusAmount();
                                        }}>{rate}%</button>)}
                                </div> : null}
                            </div>
                        </div>
                        {!isTaxContribution && !isPayroll ? <div className="app-vat-rate-buttons recurring-vat-buttons-mobile vat-buttons-mobile" aria-label="Selezione rapida IVA">
                            {["0", "4", "10", "22"].map(rate =>
                                <button type="button" key={rate} className={vatRate === rate ? "is-selected" : ""} disabled={!isDeclared} onMouseDown={event => event.preventDefault()} onClick={() => {
                                    vatRateTouchedRef.current = true;
                                    setVatRate(rate);
                                    focusAmount();
                                }}>{rate}%</button>)}
                        </div> : null}
                        <input type="hidden" name="vatRate" value={isDeclared ? vatRate : "0"}/>
                        {isTaxContribution || isPayroll ? <input type="hidden" name="isDeclared" value="false"/> : null}
                        {isTaxContribution || isPayroll ? <input type="hidden" name="affectsFiscalProfit" value={affectsFiscalProfit ? "true" : "false"}/> : null}
                        {isPayroll ? <div className="form-section-grid full payroll-money-fields">
                            <FormField label="Compensi extra" icon="+"><MoneyInput name="payrollExtraCompensation" value={payrollExtraCompensation} onValueChange={setPayrollExtraCompensation}/></FormField>
                            <FormField label="Lordo cedolino" icon="€"><MoneyInput name="payrollGrossAmount" value={payrollGrossAmount} onValueChange={setPayrollGrossAmount}/></FormField>
                            <FormField label="Costo complessivo aziendale" icon="€"><MoneyInput name="payrollEmployerCost" value={payrollEmployerCost} onValueChange={setPayrollEmployerCost}/></FormField>
                        </div> : null}
                        <div className="app-amount-keypad full" aria-label="Tastiera numerica">
                            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "backspace"].map(key =>
                                <button type="button" key={key} aria-label={key === "backspace" ? "Cancella ultima cifra" : key} onMouseDown={event => event.preventDefault()} onClick={() => appendAmountKey(key)}>{key === "backspace" ? "⌫" : key}</button>)}
                        </div>
                    </div>
                </div>
            </details>

            {!isTaxContribution && !isPayroll ? <details className="form-section full recurring-form-section recurring-fiscal-section app-form-wizard-step app-form-wizard-step-4" open>
                <summary>
                    <span>Fatturazione</span>
                    <small>Fattura elettronica e periodo fatturazione</small>
                </summary>

                <div className="form-section-grid recurring-form-section-grid">
                    <div className="switch-toggle-field recurring-switch-control recurring-invoice-switch hidden-md-down">
                        <div className="app-form-field-label switch-toggle-field-label">
                            <span className="app-form-field-icon">⇆</span>
                            <span>Fattura elettronica</span>
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
                            <small className="text-muted">{hasElectronicInvoice ? "Elettronica" : "PDF"}</small>
                        </label>
                    </div>

                    <div className="switch-toggle-field switch-inline wide push-down recurring-switch-control recurring-invoice-switch hidden-md-up">
                        <div className="app-form-field-label switch-toggle-field-label">
                            <span className="app-form-field-icon">⇆</span>
                            <span>Fatt. elettronica</span>
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
                            {/*<small className="text-muted ml-12">{hasElectronicInvoice ? "Elettronica" : "PDF"}</small>*/}
                        </label>
                    </div>

                    <SelectField label="Periodo fatturazione" className="recurring-billing-period-field" icon="▦" name="billingPeriodMode" value={billingPeriodMode} disabled={!isDeclared} onChange={setBillingPeriodMode} options={[
                        {value: "SAME_MONTH", label: "Stesso mese"},
                        {value: "NEXT_MONTH", label: "Mese successivo"},
                        {value: "CUSTOM_MONTH", label: "Imposta mese"},
                    ]}/>
                    {!isDeclared && <input type="hidden" name="billingPeriodMode" value="SAME_MONTH"/>}
                    {billingPeriodMode === "CUSTOM_MONTH" && isDeclared ?
                        <SelectField label="Mese contabile" className="recurring-billing-month-field" icon="▦" name="billingMonth" value={billingMonth} onChange={setBillingMonth} options={monthOptions.map(([value, label]) => ({
                            value,
                            label
                        }))}/> : null}
                </div>
            </details> : null}

            <details className="form-section full recurring-form-section recurring-payment-section app-form-wizard-step app-form-wizard-step-5" open>
                <summary>
                    <span>Pagamento</span>
                    <small>Automazione, canale e banca</small>
                </summary>
                <div className="form-section-grid recurring-form-section-grid">
                    <div className="switch-toggle-field recurring-switch-control recurring-accrual-toggle hidden-md-down">
                        <div className="app-form-field-label switch-toggle-field-label">
                            <span className="app-form-field-icon">⇆</span>
                            <span>Pagam. autom.</span>
                            <input type="hidden" name="isAutomaticPayment" value={isAutomaticAccrual ? "true" : "false"}/>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={isAutomaticAccrual}
                                onChange={(event) => setIsAutomaticAccrual(event.currentTarget.checked)}
                            />
                            <span className="slider"/>
                            <small className="text-muted">{isAutomaticAccrual ? "Automatico" : "Manuale"}</small>
                        </label>
                    </div>

                    <div className="switch-toggle-field switch-inline wide recurring-switch-control recurring-accrual-toggle hidden-md-up full">
                        <div className="app-form-field-label switch-toggle-field-label">
                            <span className="app-form-field-icon">⇆</span>
                            <span>Pag. automatico</span>
                            <input type="hidden" name="isAutomaticPayment" value={isAutomaticAccrual ? "true" : "false"}/>
                        </div>
                        <label className="switch">
                            <small className="text-muted">{isAutomaticAccrual ? "Automatico" : "Manuale"}</small>
                            <input
                                type="checkbox"
                                checked={isAutomaticAccrual}
                                onChange={(event) => setIsAutomaticAccrual(event.currentTarget.checked)}
                            />
                            <span className="slider"/>
                        </label>
                    </div>

                    <SelectField label="Canale di pagamento" className="flex-grow" icon="▣" name="paymentMethodId" value={paymentMethodId} disabled={!isAutomaticAccrual} required={isAutomaticAccrual}
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
                    <SelectField label="Banca" className="flex-grow" icon="▥" name="bankId" value={cashBankLocked ? cashBankIdValue : bankId} disabled={!isAutomaticAccrual || cashBankLocked} required={isAutomaticAccrual && !cashBankLocked} onChange={setBankId}
                                 options={[{value: "", label: "Seleziona banca"}, ...banks.map(bank => ({
                                     value: bank.id,
                                     label: `${bank.icon ?? '•'} ${bank.name}`
                                 }))]}
                    />
                </div>
            </details>

            <details className="form-section full recurring-form-section recurring-notes-section app-form-wizard-step app-form-wizard-step-6" open={mobileStep === 6}>
                <summary>
                    <span>Note</span>
                    <small>Note interne opzionali</small>
                </summary>
                <div className="form-section-stack">
                    <section className="recurring-review-summary record-review-step" aria-label="Riepilogo spesa ricorrente">
                        <div className="record-review-heading">
                            <div><span className="record-review-kicker">Controlla prima di salvare</span>
                                <h3>Riepilogo della ricorrenza</h3></div>
                            <strong>€ {Number(normalizedAmount || 0).toLocaleString("it-IT", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })}</strong>
                        </div>
                        <div className="record-review-grid">
                            <div className="record-review-item">
                                <i aria-hidden="true">◷</i><span>Data inizio<strong>{startDate ? formatItalianCompactDate(startDate) : "Non indicata"}</strong></span>
                            </div>
                            <div className="record-review-item">
                                <i aria-hidden="true">⌛</i><span>Data di fine<strong>{hasEndDate && endDate ? formatItalianCompactDate(endDate) : "Senza scadenza"}</strong></span>
                            </div>
                            <div className="record-review-item"><i aria-hidden="true">↻</i><span>Ricorrenza<strong>{({
                                MONTHLY: "Ogni mese",
                                EVERY_2_MONTHS: "Ogni 2 mesi",
                                EVERY_3_MONTHS: "Ogni 3 mesi",
                                EVERY_6_MONTHS: "Ogni 6 mesi",
                                YEARLY: "Annuale",
                                EVERY_2_YEARS: "Ogni 2 anni"
                            } as Record<string, string>)[cadence]} · giorno {dueDay}{isYearly ? ` ${monthOptions.find(([value]) => String(value) === dueMonth)?.[1] ?? ""}` : ""}</strong></span>
                            </div>
                            <div className="record-review-item">
                                <i aria-hidden="true">◷</i><span>Generazione<strong>{generationTimingOptions.find(option => option.value === generationTiming)?.label ?? "Il primo del mese"}</strong></span>
                            </div>
                            <div className="record-review-item wide">
                                <i aria-hidden="true">◎</i><span>Fornitore<strong>{supplierName || "Non indicato"}</strong></span>
                            </div>
                            <div className="record-review-item wide">
                                <i aria-hidden="true">◇</i><span>Categoria<strong>{categories.find(category => String(category.id) === categoryId)?.name ?? "Non indicata"}</strong></span>
                            </div>
                            <div className="record-review-item wide">
                                <i aria-hidden="true">≡</i><span>Descrizione<strong>{description || "Non indicata"}</strong></span>
                            </div>
                            <div className="record-review-item">
                                <i aria-hidden="true">%</i><span>Fiscale / IVA<strong>{isDeclared ? `Sì · ${vatRate}%` : "No · 0%"}</strong></span>
                            </div>
                            <div className="record-review-item">
                                <i aria-hidden="true">▤</i><span>Fatturazione<strong>{hasElectronicInvoice ? "Fattura elettronica" : "Senza fattura elettronica"}</strong></span>
                            </div>
                            <div className="record-review-item wide">
                                <i aria-hidden="true">€</i><span>Pagamento<strong>{isAutomaticAccrual ? `${selectedPaymentMethodName || "Canale non indicato"} · ${banks.find(bank => String(bank.id) === bankId)?.name ?? "Banca non indicata"}` : "Manuale"}</strong></span>
                            </div>
                        </div>
                    </section>
                    <label className="full">Note<textarea name="notes" rows={3} value={notes} onChange={event => setNotes(event.currentTarget.value)}/></label>
                </div>
            </details>

            {!hideMobileActions ? <MobileFormStickyActions
                currentStep={mobileStep + (onBackToType ? mobileStepOffset : 0)}
                submitStep={6 + (onBackToType ? mobileStepOffset : 0)}
                onBack={() => mobileStep === 1 && onBackToType ? onBackToType() : goToMobileStep(mobileStep - 1)}
                onNext={nextMobileStep}
                onCancel={onCancel}
                cancelHref={cancelHref}
                submitLabel="Salva spesa"
                isSubmitting={isSubmitting}
                nextDisabled={mobileStep === 2 && (!Number.isFinite(amountValue) || amountValue <= 0)}
                error={submitError}
            /> : null}

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
