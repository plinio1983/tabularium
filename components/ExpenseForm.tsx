"use client";

import {type FormEvent, useEffect, useMemo, useRef, useState} from "react";
import {categoryIcon} from "@/lib/expense-ui";
import {DateField, FormField, MonthField, SelectField} from "@/components/FormControls";
import {CurrencyInput} from "@/components/CurrencyInput";
import {applyCurrencyInputKeyWithState, formatCurrencyInput} from "@/lib/currency-input";
import DescriptionAutocomplete from "@/components/DescriptionAutocomplete";
import SupplierCreateModal from "@/components/SupplierCreateModal";
import MobileFormStickyActions from "@/components/MobileFormStickyActions";

type Option = {
    id: number;
    code?: string;
    name: string;
    icon?: string | null;
    isFallback?: boolean | null;
    isPrimary?: boolean;
    systemRole?: string | null;
    isExpenseDefault?: boolean;
    isVatSettlementDefault?: boolean
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
    systemRole?: string | null;
    defaultExpenseCategoryId?: number | null;
};
type PaymentRow = {
    key: number;
    id?: number;
    paymentDate: string;
    paymentMethodId: string;
    bankId: string;
    amount: string;
    amountTouched: boolean;
};

type InitialPayment = {
    id?: number;
    paymentDate?: string | Date | null;
    paymentMethodId?: number | null;
    bankId?: number | null;
    amount?: string | number | { toString(): string } | null;
};

type InitialExpense = {
    id?: number;
    receivedDate?: string | Date | null;
    dueDate?: string | Date | null;
    supplierId?: number | null;
    merchant?: string | null;
    categoryId?: number | null;
    description?: string | null;
    amount?: string | number | { toString(): string } | null;
    vatRate?: string | number | { toString(): string } | null;
    paymentStatus?: string | null;
    month?: number;
    year?: number;
    hasElectronicInvoice?: boolean;
    invoiceStatus?: string | null;
    isDeclared?: boolean;
    isRecurring?: boolean;
    expenseType?: "STANDARD" | "VAT_SETTLEMENT" | "COUNTER";
    payments?: InitialPayment[];
    notes?: string | null;
};

type Props = {
    categories: Option[];
    banks: Option[];
    paymentMethods: Option[];
    suppliers?: SupplierOption[];
    initialExpense?: InitialExpense;
    action?: string;
    title?: string;
    submitLabel?: string;
    onCancel?: () => void;
    onSaved?: () => void;
    cancelHref?: string;
    onSwitchToRecurring?: () => void;
    initialMobileStep?: number;
    openNewPayment?: boolean;
    initialOpenPaymentId?: number;
    focusAttachments?: boolean;
};

function toDateInput(value?: string | Date | null) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

const today = new Date().toISOString().slice(0, 10);

function datePlusDays(days: number) {
    const now = new Date();
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + days));
    return date.toISOString().slice(0, 10);
}

function addDaysToDateInput(value: string, days: number) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return datePlusDays(days);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
}

function monthInputFromDateInput(value: string) {
    const [year, month] = value.split("-");
    return year && month ? `${year}-${month}` : "";
}

export function lastDayOfMonthInput(value: string) {
    const [year, month] = value.split("-").map(Number);
    if (!year || !month) return "";
    const day = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const currentBillingPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
const cashChannel = "Cash";
const cashBankName = "Cassa";

function normalizeMoney(value: unknown) {
    if (value === null || value === undefined) return "";
    return String(value).replace(",", ".");
}

function formatEuro(value: number) {
    return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
    }).format(value || 0);
}

function formatDateInputLabel(value: string) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
}

function emptyPaymentRow(key: number): PaymentRow {
    return {
        key,
        paymentDate: today,
        paymentMethodId: "",
        bankId: "",
        amount: "",
        amountTouched: false,
    };
}

function findOptionId(options: Option[], id?: number | null) {
    if (id && options.some(option => option.id === id)) return String(id);
    return "";
}

function paymentRowFromInitial(
    payment: InitialPayment,
    index: number,
    paymentMethods: Option[],
): PaymentRow {
    return {
        key: payment.id ?? Date.now() + index,
        id: payment.id,
        paymentDate: toDateInput(payment.paymentDate),
        paymentMethodId: findOptionId(paymentMethods, payment.paymentMethodId),
        bankId: payment.bankId ? String(payment.bankId) : "",
        amount: normalizeMoney(payment.amount),
        amountTouched: true,
    };
}

function isPaymentComplete(row: PaymentRow) {
    return Boolean(
        row.paymentDate &&
        row.paymentMethodId &&
        row.bankId &&
        Number(row.amount || 0) > 0
    );
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
            <CurrencyInput ref={inputRef} {...props}/>
        </div>
    );
}

function SupplierAutocomplete({
                                  suppliers = [],
                                  initialSupplierId,
                                  initialMerchant,
                                  onSupplierSelected,
                                  onSupplierValueChange,
                                  categories = [],
                              }: {
    suppliers?: SupplierOption[];
    initialSupplierId?: number | null;
    initialMerchant?: string | null;
    onSupplierSelected?: (supplier: SupplierOption) => void;
    onSupplierValueChange?: (value: string) => void;
    categories?: Option[];
}) {
    const initial =
        suppliers.find((supplier) => supplier.id === initialSupplierId) ?? null;
    const [query, setQuery] = useState(
        initial?.businessName ?? initialMerchant ?? "",
    );
    const [selected, setSelected] = useState<SupplierOption | null>(initial);
    const [results, setResults] = useState<SupplierOption[]>(
        suppliers.slice(0, 10),
    );
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [showCreate, setShowCreate] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            )
                setIsOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            const params = query.trim()
                ? `?search=${encodeURIComponent(query.trim())}`
                : "";
            const response = await fetch(`/api/suppliers${params}`, {
                signal: controller.signal,
            }).catch(() => null);
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
        setIsOpen(false);
        onSupplierValueChange?.(supplier.businessName);
        onSupplierSelected?.(supplier);
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (!isOpen && ["ArrowDown", "ArrowUp"].includes(event.key))
            setIsOpen(true);
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
        <div className="entity-autocomplete entity-autocomplete-wide app-form-wizard-step app-form-wizard-step-3" ref={containerRef}>
            <input type="hidden" name="supplierId" value={selected?.id ?? ""}/>
            <input
                type="hidden"
                name="merchant"
                value={selected?.businessName ?? query}
            />



            <div className="app-form-field entity-autocomplete-field">
                <label className="app-form-field-label">
                    <span className="app-form-field-icon" aria-hidden="true">◎</span>
                    <span>Esercente</span>
                    <span className="flex flex-grow justify-end">
                        <button
                            type="button"
                            className="btn btn-sm btn-link inline-link-button mr-22"
                            onClick={() => setShowCreate(true)}
                        >
                        ＋ Nuovo
                    </button>
                    </span>
                </label>
            </div>

            {/*<FormField label="Esercente" icon="◎" className="entity-autocomplete-field" htmlFor="expense-supplier-search">*/}
                <div className="entity-autocomplete-input-row">
                    <div className={`app-autocomplete-control ${selected ? "has-selection" : ""}`}>
                        <span className="app-autocomplete-search-icon" aria-hidden="true">⌕</span>
                        <input
                            id="expense-supplier-search"
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                onSupplierValueChange?.(event.target.value);
                                setSelected(null);
                                setIsOpen(true);
                            }}
                            onFocus={() => setIsOpen(true)}
                            onKeyDown={onKeyDown}
                            placeholder="Cerca per ragione sociale o referente"
                            autoComplete="off"
                            role="combobox"
                            aria-expanded={isOpen}
                            aria-autocomplete="list"
                            required
                        />
                        {query ? <button
                            type="button"
                            className="app-autocomplete-clear"
                            aria-label="Cancella fornitore"
                            onClick={() => {
                                setQuery("");
                                onSupplierValueChange?.("");
                                setSelected(null);
                                setResults(suppliers.slice(0, 10));
                                setIsOpen(true);
                            }}
                        >×</button> : null}
                        {isOpen && (
                            <div className="entity-autocomplete-results" role="listbox">
                                {results.length ? (
                                    results.map((supplier, index) => (
                                        <button
                                            type="button"
                                            key={supplier.id}
                                            role="option"
                                            aria-selected={index === activeIndex}
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
                                    <div className="entity-autocomplete-empty">
                                        Nessun fornitore trovato.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {selected ? <div className="app-autocomplete-selection">
                    <span aria-hidden="true">✓</span>
                    <div><strong>{selected.businessName}</strong>{selected.alias ?
                        <small>{selected.alias}</small> : null}</div>
                </div> : null}
            {/*</FormField>*/}

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

export default function ExpenseForm({
                                        categories,
                                        banks,
                                        paymentMethods,
                                        suppliers = [],
                                        initialExpense,
                                        action = "/api/expenses",
                                        title = "Nuova spesa",
                                        submitLabel = "Salva spesa",
                                        onCancel,
                                        onSaved,
                                        cancelHref,
                                        onSwitchToRecurring,
                                        initialMobileStep = 1,
                                        openNewPayment = false,
                                        initialOpenPaymentId,
                                        focusAttachments = false,
                                    }: Props) {
    const [isVatSettlement, setIsVatSettlement] = useState(initialExpense?.expenseType === "VAT_SETTLEMENT");
    const vatSettlementCategory = categories.find(category => category.isVatSettlementDefault);
    const vatSettlementSupplier = suppliers.find(supplier => supplier.systemRole === "VAT_SETTLEMENT");
    const availablePaymentMethods = isVatSettlement
        ? paymentMethods.filter(method => method.systemRole !== "CASH" && !isCashChannel(method.name))
        : paymentMethods;
    const defaultPaymentMethod = availablePaymentMethods.find(method => method.isExpenseDefault) ?? availablePaymentMethods[0];
    const fallbackBank = banks.find(bank => bank.name.toLowerCase() === cashBankName.toLowerCase()) ?? banks.find(bank => bank.isFallback) ?? banks[0];
    const primaryBankIdValue = banks.find(bank => bank.isPrimary)?.id.toString() ?? "";
    const cashBankId = banks.find((bank) => bank.name.toLowerCase() === cashBankName.toLowerCase())?.id;
    const cashBankIdValue = cashBankId ? String(cashBankId) : (fallbackBank ? String(fallbackBank.id) : "");
    const methodName = (methodId: string) => paymentMethods.find(method => String(method.id) === methodId)?.name ?? "";
    const normalizePaymentRow = (row: PaymentRow): PaymentRow =>
        isCashChannel(methodName(row.paymentMethodId)) && cashBankIdValue ? {...row, bankId: cashBankIdValue} : row;
    const [amount, setAmount] = useState(normalizeMoney(initialExpense?.amount).replace(".", ","));
    const initialSupplierDefaultCategoryId = suppliers.find(supplier => supplier.id === initialExpense?.supplierId)?.defaultExpenseCategoryId;
    const [categoryId, setCategoryId] = useState(() => String(
        initialExpense?.categoryId
        ?? (initialExpense?.id ? null : initialSupplierDefaultCategoryId)
        ?? categories[0]?.id
        ?? "",
    ));
    const [vatRate, setVatRate] = useState(normalizeMoney(initialExpense?.vatRate) || "22");
    const [submitError, setSubmitError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mobileStep, setMobileStep] = useState(() => Math.max(1, Math.min(7, initialMobileStep)));
    const [supplierDisplayName, setSupplierDisplayName] = useState(
        suppliers.find(supplier => supplier.id === initialExpense?.supplierId)?.businessName
        ?? initialExpense?.merchant
        ?? "",
    );
    const [description, setDescription] = useState(initialExpense?.description ?? "");
    const [notes, setNotes] = useState(initialExpense?.notes ?? "");
    const [attachmentCount, setAttachmentCount] = useState(0);
    const formRef = useRef<HTMLFormElement>(null);
    const amountRef = useRef<HTMLInputElement>(null);
    const amountKeyStateRef = useRef<{ separatorDigits: 0 | 1 | null }>({separatorDigits: null});
    const didOpenNewPayment = useRef(false);
    const [hasElectronicInvoice, setHasElectronicInvoice] = useState(
        initialExpense?.hasElectronicInvoice ?? true,
    );
    const [isDeclared, setIsDeclared] = useState(
        initialExpense?.isDeclared ?? true,
    );
    const [payments, setPayments] = useState<PaymentRow[]>(
        initialExpense?.payments?.length
            ? initialExpense.payments.map((payment, index) => paymentRowFromInitial(payment, index, paymentMethods)).map(normalizePaymentRow)
            : [],
    );
    const [openPaymentKey, setOpenPaymentKey] = useState<number | null>(() => initialOpenPaymentId ?? null);
    const isPaymentOnlyMode = openNewPayment || initialOpenPaymentId !== undefined;
    const openPaymentRef = useRef<HTMLDivElement | null>(null);
    const attachmentsSectionRef = useRef<HTMLDetailsElement | null>(null);
    const [attachmentError, setAttachmentError] = useState("");
    const initialOrderDate = toDateInput(initialExpense?.receivedDate) || today;
    const initialBillingPeriod =
        initialExpense?.year && initialExpense?.month
            ? `${initialExpense.year}-${String(initialExpense.month).padStart(2, "0")}`
            : currentBillingPeriod;
    const [orderDate, setOrderDate] = useState(initialOrderDate);
    const [billingPeriod, setBillingPeriod] = useState(initialBillingPeriod);
    const [dueDate, setDueDate] = useState(
        initialExpense?.dueDate
            ? toDateInput(initialExpense.dueDate)
            : initialExpense?.id
                ? ""
                : addDaysToDateInput(initialOrderDate, 7),
    );
    useEffect(() => {
        if (!isVatSettlement || !dueDate || orderDate === dueDate) return;
        setOrderDate(dueDate);
    }, [isVatSettlement, dueDate, orderDate]);
    useEffect(() => {
        if (!isVatSettlement || !billingPeriod) return;
        const lastDay = lastDayOfMonthInput(billingPeriod);
        if (!lastDay) return;
        setDueDate(lastDay);
        setOrderDate(lastDay);
    }, [isVatSettlement, billingPeriod]);
    const [invoiceStatus, setInvoiceStatus] = useState(
        initialExpense?.invoiceStatus ?? "IN_ATTESA",
    );
    const [isRecurring, setIsRecurring] = useState(
        initialExpense?.isRecurring ?? false,
    );
    const isExistingExpense = Boolean(initialExpense?.id);
    const canEditExpenseType = !isExistingExpense;

    const normalizedAmount = amount.replace(",", ".");
    const amountValue = Number(normalizedAmount || 0);
    const paidAmountValue = payments.reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0,
    );
    const residual = Math.max(0, amountValue - paidAmountValue);
    const computedPaymentStatus =
        paidAmountValue <= 0
            ? "DA_PAGARE"
            : paidAmountValue >= amountValue && amountValue > 0
                ? "COMPLETATO"
                : "PAGATO_PARZIALMENTE";
    const computedPaymentStatusInfo =
        computedPaymentStatus === "COMPLETATO"
            ? {icon: "✅", label: "Completato", className: "text-ok"}
            : computedPaymentStatus === "PAGATO_PARZIALMENTE"
                ? {icon: "🟡", label: "Pagato parzialmente", className: "text-warning"}
                : {icon: "⚪", label: "Non pagato", className: "text-critical"};
    const selectedCategory = isVatSettlement
        ? vatSettlementCategory
        : categories.find(category => String(category.id) === categoryId);
    const currentSupplierName = isVatSettlement
        ? vatSettlementSupplier?.businessName ?? "Non configurato"
        : supplierDisplayName || "Non indicato";
    const canAddPayment =
        payments.length === 0 || isPaymentComplete(payments[payments.length - 1]);

    const invoiceStatuses = useMemo(
        () => {
            const base = [
                ["IN_ATTESA", "⏳ In attesa"],
                ["PARZIALE", "◐ Fatturato parzialmente"],
                ["RICEVUTA", "✅ Emessa"],
                ["CONTESTAZIONE", "⚠️ Contestazione"],
            ];
            return [["NON_PREVISTA", "Non prevista"], ...base];
        },
        [],
    );
    const currentInvoiceStatusLabel = invoiceStatuses.find(([value]) => value === invoiceStatus)?.[1] ?? invoiceStatus;

    const invoiceNotExpected = !hasElectronicInvoice && !isDeclared;

    useEffect(() => {
        if (!isDeclared) {
            setHasElectronicInvoice(false);
            setInvoiceStatus("NON_PREVISTA");
        }
    }, [isDeclared, invoiceStatus]);

    useEffect(() => {
        if (!hasElectronicInvoice && !isDeclared) {
            setInvoiceStatus("NON_PREVISTA");
        }
    }, [hasElectronicInvoice, isDeclared, invoiceStatus]);

    useEffect(() => {
        if (hasElectronicInvoice && invoiceStatus === "NON_PREVISTA") {
            setInvoiceStatus("IN_ATTESA");
        }
    }, [hasElectronicInvoice, invoiceStatus]);

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

    function updateDeclared(checked: boolean) {
        setIsDeclared(checked);
        if (!checked) {
            setVatRate("0");
            setHasElectronicInvoice(false);
            setInvoiceStatus("NON_PREVISTA");
        } else if (vatRate === "0") {
            setVatRate("22");
        }
    }

    function goToMobileStep(nextStep: number) {
        setMobileStep(Math.max(1, Math.min(7, nextStep)));
        window.requestAnimationFrame(() => formRef.current?.scrollIntoView({behavior: "smooth", block: "start"}));
    }

    function validateMobileStep() {
        if (mobileStep === 2 && amountValue <= 0) {
            amountRef.current?.setCustomValidity("Inserisci un importo maggiore di zero.");
            amountRef.current?.reportValidity();
            amountRef.current?.focus();
            return false;
        }
        const stepElements = Array.from(formRef.current?.querySelectorAll<HTMLElement>(`.app-form-wizard-step-${mobileStep}`) ?? []);
        if (!stepElements.length) return true;
        const fields = stepElements.flatMap(step =>
            Array.from(step.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")),
        );
        const invalid = fields.find(field => !field.disabled && !field.checkValidity());
        if (invalid) {
            invalid.reportValidity();
            invalid.focus();
            return false;
        }
        if (mobileStep === 4 && !canAddPayment) {
            openPaymentRef.current?.scrollIntoView({behavior: "smooth", block: "center"});
            return false;
        }
        return true;
    }

    function nextMobileStep() {
        if (!validateMobileStep()) return;
        goToMobileStep(isVatSettlement && mobileStep === 4 ? 6 : mobileStep + 1);
    }

    function previousMobileStep() {
        goToMobileStep(isVatSettlement && mobileStep === 6 ? 4 : mobileStep - 1);
    }

    function updatePayment(index: number, patch: Partial<PaymentRow>) {
        setPayments((rows) =>
            rows.map((row, i) => {
                if (i !== index) return row;
                const next = {...row, ...patch};
                const nextMethodName = methodName(next.paymentMethodId);
                if ("paymentMethodId" in patch && isCashChannel(nextMethodName) && cashBankIdValue) {
                    next.bankId = cashBankIdValue;
                } else if (
                    "paymentMethodId" in patch
                    && isCashChannel(methodName(row.paymentMethodId))
                    && primaryBankIdValue
                ) {
                    next.bankId = primaryBankIdValue;
                }
                return next;
            }),
        );
    }

    function paymentAvailableAmount(index: number) {
        const otherPayments = payments.reduce(
            (sum, row, rowIndex) => rowIndex === index ? sum : sum + Number(row.amount || 0),
            0,
        );
        return Math.max(0, amountValue - otherPayments);
    }

    function setPaymentPercentage(index: number, percentage: number) {
        const nextAmount = paymentAvailableAmount(index) * percentage / 100;
        updatePayment(index, {
            amount: nextAmount > 0 ? nextAmount.toFixed(2) : "",
            amountTouched: true,
        });
    }

    useEffect(() => {
        if (!openPaymentKey) return;
        window.requestAnimationFrame(() => {
            openPaymentRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        });
    }, [openPaymentKey]);

    useEffect(() => {
        if (!focusAttachments) return;
        window.requestAnimationFrame(() => {
            attachmentsSectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        });
    }, [focusAttachments]);

    function addPaymentRow() {
        if (!canAddPayment) return;
        const key = Date.now();
        const currentPaidAmount = payments.reduce(
            (sum, row) => sum + Number(row.amount || 0),
            0,
        );
        const nextResidual = Math.max(0, amountValue - currentPaidAmount);
        const suggestedAmount = nextResidual > 0 ? nextResidual.toFixed(2) : "";
        setPayments((rows) => [
            ...rows,
            normalizePaymentRow({
                ...emptyPaymentRow(key),
                paymentMethodId: defaultPaymentMethod ? String(defaultPaymentMethod.id) : "",
                bankId: primaryBankIdValue,
                amount: suggestedAmount,
                amountTouched: Boolean(suggestedAmount),
            }),
        ]);
        setOpenPaymentKey(key);
    }

    useEffect(() => {
        if (!openNewPayment || didOpenNewPayment.current) return;
        didOpenNewPayment.current = true;
        addPaymentRow();
    }, [openNewPayment]);

    function removePaymentRow(index: number) {
        const payment = payments[index];
        if (payment?.id && !window.confirm("Eliminare questo pagamento?")) return;
        setPayments((rows) => rows.filter((_, i) => i !== index));
        if (payment?.key === openPaymentKey) setOpenPaymentKey(null);
    }

    function renderPaymentHiddenInputs(payment: PaymentRow) {
        const cashBankLocked = isCashChannel(methodName(payment.paymentMethodId)) && cashBankIdValue;
        return (
            <>
                <input type="hidden" name="paymentId[]" value={payment.id ?? ""}/>
                <input type="hidden" name="paymentDate[]" value={payment.paymentDate}/>
                <input type="hidden" name="paymentMethodId[]" value={payment.paymentMethodId}/>
                <input type="hidden" name="paymentBankId[]" value={cashBankLocked ? cashBankIdValue : payment.bankId}/>
                <input type="hidden" name="paymentAmount[]" value={payment.amount}/>
            </>
        );
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        if (window.matchMedia("(max-width: 900px)").matches) {
            if (isPaymentOnlyMode) {
                if (!validateMobileStep()) {
                    event.preventDefault();
                    return;
                }
            } else if (mobileStep < 6) {
                event.preventDefault();
                nextMobileStep();
                return;
            }
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
                let message = "Impossibile salvare la spesa.";
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
            setSubmitError(error instanceof Error ? error.message : "Impossibile salvare la spesa.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form
            ref={formRef}
            className={`form app-record-form single-expense-form app-form-wizard app-form-wizard-current-${mobileStep}`}
            action={action}
            method="post"
            encType="multipart/form-data"
            onSubmit={handleSubmit}
            data-in-place-submit={onSaved ? "true" : undefined}
        >
            <div className="app-form-wizard-header full">
                <div className="app-form-wizard-heading">
                    <span>{mobileStep === 7
                        ? `Passaggio ${isVatSettlement ? "5bis" : "6bis"}`
                        : `Passaggio ${isVatSettlement && mobileStep === 6 ? 5 : mobileStep} di ${isVatSettlement ? 5 : 6}`}</span>
                    <strong>{["Date", "Importo", "Dettagli", "Pagamenti", "Fattura", "Riepilogo", "Allegati e note"][mobileStep - 1]}</strong>
                </div>
                <div className="app-form-wizard-progress" aria-label={mobileStep === 7 ? `Passaggio ${isVatSettlement ? "5bis" : "6bis"}` : `Passaggio ${isVatSettlement && mobileStep === 6 ? 5 : mobileStep} di ${isVatSettlement ? 5 : 6}`}>
                    <span style={{width: `${isVatSettlement ? Math.min(mobileStep === 6 ? 5 : mobileStep, 5) / 5 * 100 : Math.min(mobileStep, 6) / 6 * 100}%`}}/>
                </div>
            </div>
            {/*<h2 className="full">{title}</h2>*/}

            {/*<div className="form-sticky-summary full">*/}
            {/*  <div>*/}
            {/*    <span className="muted">Residuo</span>*/}
            {/*    <strong className={residual > 0 ? "text-critical" : "text-ok"}>{formatEuro(residual)}</strong>*/}
            {/*  </div>*/}
            {/*  <div>*/}
            {/*    <span className="muted">Stato</span>*/}
            {/*    <strong className={computedPaymentStatusInfo.className}>{computedPaymentStatusInfo.label}</strong>*/}
            {/*  </div>*/}
            {/*</div>*/}

            <div className="entry-type-choice full app-form-wizard-step app-form-wizard-step-1">
                <span className="entry-type-choice-title">Tipo di spesa</span>
                <input type="hidden" name="isRecurring" value={isRecurring ? "true" : "false"}/>
                <input type="hidden" name="expenseType" value={isVatSettlement ? "VAT_SETTLEMENT" : "STANDARD"}/>
                <div className="entry-type-choice-grid" role="radiogroup" aria-label="Tipo di spesa">
                    <button
                        type="button"
                        className={!isRecurring && !isVatSettlement ? "is-selected" : ""}
                        role="radio"
                        aria-checked={!isRecurring && !isVatSettlement}
                        disabled={!canEditExpenseType}
                        onClick={() => {
                            setIsRecurring(false);
                            setIsVatSettlement(false);
                        }}
                    >
                        <span aria-hidden="true">●</span>
                        <strong>Singola</strong>
                        <small>Spesa occasionale</small>
                    </button>
                    <button
                        type="button"
                        disabled={isExistingExpense}
                        onClick={() => window.location.assign("/expenses/counter")}
                    >
                        <span aria-hidden="true">🛍️</span>
                        <strong>Da banco</strong>
                        <small>Acquisto già pagato</small>
                    </button>
                    <button
                        type="button"
                        className={isRecurring ? "is-selected" : ""}
                        role="radio"
                        aria-checked={isRecurring}
                        disabled={isExistingExpense || !onSwitchToRecurring}
                        onClick={() => {
                            setIsVatSettlement(false);
                            setIsRecurring(true);
                            onSwitchToRecurring?.();
                        }}
                    >
                        <span aria-hidden="true">↻</span>
                        <strong>Ricorrente</strong>
                        <small>Spesa periodica</small>
                    </button>
                    <button
                        type="button"
                        className={isVatSettlement ? "is-selected" : ""}
                        role="radio"
                        aria-checked={isVatSettlement}
                        disabled={!canEditExpenseType}
                        onClick={() => {
                            setIsRecurring(false);
                            setIsVatSettlement(true);
                        }}
                    >
                        <span aria-hidden="true">IVA</span>
                        <strong>Saldo IVA</strong>
                        <small>Versamento IVA</small>
                    </button>
                </div>
            </div>

            <details className="form-section full app-form-wizard-split-section expense-wizard-document-section expense-wizard-dates-section" open>
                <summary>
                    <span>Tipo e date</span>
                    <small>Tipologia della spesa e date principali</small>
                </summary>
                <div className="form-section-grid">

                    {isVatSettlement && (!vatSettlementCategory || !vatSettlementSupplier) ?
                        <div className="inline-form-error full app-form-wizard-step app-form-wizard-step-1">
                            Configura la categoria Saldo IVA nelle Impostazioni. Il fornitore di sistema deve essere inizializzato per il workspace.
                        </div> : null}

                    {isVatSettlement ? <MonthField
                        className="app-form-wizard-step app-form-wizard-step-1"
                        label="Periodo contabile"
                        name="billingPeriod"
                        value={billingPeriod}
                        onChange={(value) => {
                            setBillingPeriod(value);
                            const lastDay = lastDayOfMonthInput(value);
                            if (lastDay) {
                                setDueDate(lastDay);
                                setOrderDate(lastDay);
                            }
                        }}
                        required
                        // hint="La scadenza viene impostata all’ultimo giorno del mese."
                    /> : null}

                    {isVatSettlement ? <input type="hidden" name="receivedDate" value={dueDate}/> : <DateField
                        className="app-form-wizard-step app-form-wizard-step-1"
                        label="Data ordine"
                        name="receivedDate"
                        value={orderDate}
                        onChange={(nextOrderDate) => {
                            const nextOrderMonth = monthInputFromDateInput(nextOrderDate);
                            setOrderDate(nextOrderDate);
                            if (nextOrderMonth && (!billingPeriod || billingPeriod < nextOrderMonth)) {
                                setBillingPeriod(nextOrderMonth);
                            }
                            setDueDate(addDaysToDateInput(nextOrderDate, 7));
                        }}
                        required
                    />}
                    <DateField
                        className="app-form-wizard-step app-form-wizard-step-1 expense-due-date-field"
                        label="Data scadenza"
                        name="dueDate"
                        value={dueDate}
                        required={isVatSettlement}
                        onChange={(value) => {
                            setDueDate(value);
                            if (isVatSettlement) setOrderDate(value);
                        }}
                    >
                        <span className="expense-due-date-shortcuts" aria-label="Selezione rapida data scadenza">
                            {[0, 7, 15, 30].map(days => {
                                const value = addDaysToDateInput(isVatSettlement ? today : orderDate, days);
                                return <button
                                    type="button"
                                    key={days}
                                    className={dueDate === value ? "is-selected" : ""}
                                    aria-pressed={dueDate === value}
                                    onClick={() => {
                                        setDueDate(value);
                                        if (isVatSettlement) setOrderDate(value);
                                    }}
                                >{days === 0 ? "Stesso g" : `+${days} gg`}</button>;
                            })}
                        </span>
                    </DateField>
                </div>
            </details>

            <details className="form-section full app-form-wizard-split-section app-form-wizard-details-section" open>
                <summary>
                    <span>Fornitore e dettagli</span>
                    <small>Fornitore, descrizione e categoria della spesa</small>
                </summary>
                <div className="form-section-grid">
                    {isVatSettlement ? <label className="app-form-wizard-step app-form-wizard-step-3">
                        Esercente
                        <input value={vatSettlementSupplier?.businessName ?? "Non configurato"} readOnly/>
                        <input type="hidden" name="supplierId" value={vatSettlementSupplier?.id ?? ""}/>
                        <input type="hidden" name="merchant" value={vatSettlementSupplier?.businessName ?? ""}/>
                    </label> : <SupplierAutocomplete
                        suppliers={suppliers.filter(supplier => !supplier.systemRole)}
                        categories={categories}
                        initialSupplierId={initialExpense?.supplierId ?? null}
                        initialMerchant={initialExpense?.merchant ?? ""}
                        onSupplierValueChange={setSupplierDisplayName}
                        onSupplierSelected={(supplier) => {
                            if (supplier.defaultExpenseCategoryId && categories.some(category => category.id === supplier.defaultExpenseCategoryId)) {
                                setCategoryId(String(supplier.defaultExpenseCategoryId));
                            }
                        }}
                    />}
                    {isVatSettlement ? <label className="app-form-wizard-step app-form-wizard-step-3">
                        Categoria
                        <input value={vatSettlementCategory?.name ?? "Non configurata"} readOnly/>
                        <input type="hidden" name="categoryId" value={vatSettlementCategory?.id ?? ""}/>
                    </label> : <SelectField
                        className="app-form-wizard-step app-form-wizard-step-3 expense-category-field"
                        label="Categoria"
                        icon="◇"
                        name="categoryId"
                        required
                        value={categoryId}
                        onChange={setCategoryId}
                        options={categories.map(c => ({
                            value: c.id,
                            label: c.icon ? `${categoryIcon(c)} ${c.name}` : c.name
                        }))}
                    />}
                    <DescriptionAutocomplete
                        endpoint="/api/expense-descriptions"
                        label="Prodotto/servizio"
                        placeholder="Descrizione libera della spesa"
                        initialValue={initialExpense?.description ?? ""}
                        onValueChange={setDescription}
                        required
                        className="span-2 app-form-wizard-step app-form-wizard-step-3"
                    />
                </div>
            </details>

            <details className="form-section full app-form-wizard-split-section app-form-wizard-amount-section" open>
                <summary>
                    <span>Importo e IVA</span>
                    <small>Imponibile fiscale, importo e aliquota IVA</small>
                </summary>
                <div className="form-section-grid">
                    <div className="amount-vat-row full app-form-wizard-step app-form-wizard-step-2">
                        <div className="expense-wizard-amount-entry">
                            {!isVatSettlement ?
                                <div className="toggle-field switch-toggle-field expense-fiscal-desktop-control">
                                    <div className="switch-toggle-field-label">
                                        <span className="app-form-field-icon">⇆</span>
                                        <label>Fiscale</label>
                                    </div>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            name="isDeclared"
                                            value="true"
                                            checked={isDeclared}
                                            onChange={(event) => updateDeclared(event.currentTarget.checked)}
                                        />
                                        <span className="slider"/>
                                        <span className="text-muted">{isDeclared ? 'Fiscale' : 'Non fiscale'}</span>
                                    </label>
                                </div> : null}
                            {!isVatSettlement ? <label className="app-form-wizard-mobile-switch">
                                <span>Fiscale</span>
                                <span className="switch">
                                    <input
                                        type="checkbox"
                                        checked={isDeclared}
                                        onChange={(event) => updateDeclared(event.currentTarget.checked)}
                                    />
                                    <span className="slider"/>
                                </span>
                                {/*<span className="text-muted">{isDeclared ? 'Detrazione' : 'Non fiscale'}</span>*/}
                            </label> : null}
                            <div className="expense-amount-control">

                                    <label className="expense-wizard-amount-field switch-toggle-field">
                                        <div className="switch-toggle-field-label">
                                            <span className="app-form-field-icon">€</span>
                                            <span>{!isVatSettlement ? "Costo IVA inclusa" : "Importo IVA"}</span>
                                        </div>
                                            <MoneyInput
                                            inputRef={amountRef}
                                            required
                                            value={amount}
                                            onValueChange={handleAmountChange}
                                        />
                                        <input type="hidden" name="amount" value={normalizedAmount}/>

                                    </label>

                                {!isVatSettlement ?
                                    <div className="app-vat-rate-buttons" aria-label="Aliquota IVA">
                                        <label>Aliquota IVA </label>
                                        {["0", "4", "10", "22"].map(rate => <button
                                            type="button"
                                            key={rate}
                                            className={vatRate === rate ? "is-selected" : ""}
                                            disabled={!isDeclared}
                                            onMouseDown={event => event.preventDefault()}
                                            onClick={() => {
                                                setVatRate(rate);
                                                focusAmount();
                                            }}
                                        >{rate}%</button>)}
                                    </div> : null}
                            </div>
                        </div>
                        {!isVatSettlement ?
                            <input type="hidden" name="vatRate" value={isDeclared ? vatRate : "0"}/> : null}
                        <div className="app-amount-keypad full" aria-label="Tastiera numerica">
                            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "backspace"].map(key => <button
                                type="button"
                                key={key}
                                aria-label={key === "backspace" ? "Cancella ultima cifra" : key}
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => appendAmountKey(key)}
                            >{key === "backspace" ? "⌫" : key}</button>)}
                        </div>
                    </div>
                    <input type="hidden" name="paymentStatus" value={computedPaymentStatus}/>
                </div>
            </details>

            {!isVatSettlement ?
                <details className="form-section full app-form-wizard-split-section app-form-wizard-fiscal-section" open>
                    <summary>
                        <span>Fiscale</span>
                        <small>IVA, detrazione e fattura elettronica</small>
                    </summary>
                    <div className="form-section-grid">
                        <div className="toggle-field switch-toggle-field app-form-wizard-step app-form-wizard-step-5 expense-invoice-desktop-control">
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
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setHasElectronicInvoice(checked);
                                        if (checked) updateDeclared(true);
                                    }}
                                />
                                <span className="slider"/>
                                <span className="text-muted">{hasElectronicInvoice ? "Elettronica" : "PDF"}</span>
                            </label>
                        </div>

                        <MonthField
                            className="app-form-wizard-step app-form-wizard-step-5"
                            label="Periodo contabile"
                            name="billingPeriod"
                            value={billingPeriod}
                            onChange={setBillingPeriod}
                            required
                            hint={isVatSettlement ? "Determina il periodo fiscale nel quale conteggiare il saldo IVA." : undefined}
                        />
                    </div>
                    <div className="form-section-grid pt-0">
                        <div className="toggle-field switch-toggle-field app-form-wizard-step app-form-wizard-step-5 expense-invoice-desktop-control">
                            <div className="switch-toggle-field-label">
                                <span className="app-form-field-icon">⇆</span>
                                <label>Fattura emessa</label>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={isDeclared && invoiceStatus === "RICEVUTA"}
                                    disabled={!isDeclared}
                                    onChange={(event) => {
                                        if (event.currentTarget.checked) {
                                            setInvoiceStatus("RICEVUTA");
                                        } else if (invoiceStatus === "RICEVUTA") {
                                            setInvoiceStatus("IN_ATTESA");
                                        }
                                    }}
                                />
                                <span className="slider"/>
                                <span className="text-muted">{isDeclared && invoiceStatus === "RICEVUTA" ? "Emessa" : invoiceStatus === "PARZIALE" ? "Parziale" : "Non inviata"}</span>
                            </label>
                        </div>

                        <div className="expense-invoice-step-row app-form-wizard-step app-form-wizard-step-5">
                            <div className="expense-invoice-switches">
                                <label className="app-form-wizard-mobile-switch app-form-field-label">
                                    <span className="app-form-label">Fattura elettronica</span>
                                    <span className="switch">
                                    <input
                                        type="checkbox"
                                        checked={hasElectronicInvoice}
                                        disabled={!isDeclared}
                                        onChange={(event) => {
                                            const checked = event.currentTarget.checked;
                                            setHasElectronicInvoice(checked);
                                            if (checked) updateDeclared(true);
                                        }}
                                    />
                                    <span className="slider"/>
                                    <span className="text-muted">{hasElectronicInvoice ? 'Elettronica' : 'PDF'}</span>
                                </span>
                                </label>
                                <label className="app-form-wizard-mobile-switch expense-invoice-emitted-switch app-form-field-label">
                                    <span>Fattura emessa</span>
                                    <span className="switch">
                                    <input
                                        type="checkbox"
                                        checked={isDeclared && invoiceStatus === "RICEVUTA"}
                                        disabled={!isDeclared}
                                        onChange={(event) => {
                                            if (event.currentTarget.checked) {
                                                setInvoiceStatus("RICEVUTA");
                                            } else if (invoiceStatus === "RICEVUTA") {
                                                setInvoiceStatus("IN_ATTESA");
                                            }
                                        }}
                                    />
                                    <span className="slider"/>
                                    <span className="text-muted">{isDeclared && invoiceStatus === "RICEVUTA" ? 'Ricevuta' : invoiceStatus === "PARZIALE" ? "Parziale" : 'Non ricevuta'}</span>
                                </span>
                                </label>
                            </div>
                            <div className="expense-invoice-status-field">
                                <SelectField
                                    label="Stato fattura"
                                    icon="▤"
                                    name="invoiceStatus"
                                    value={invoiceStatus}
                                    disabled={invoiceNotExpected}
                                    onChange={setInvoiceStatus}
                                    options={invoiceStatuses.map(([value, label]) => ({
                                        value,
                                        label,
                                        disabled: value === "NON_PREVISTA" && hasElectronicInvoice
                                    }))}
                                />
                                {invoiceNotExpected && <input type="hidden" name="invoiceStatus" value="NON_PREVISTA"/>}
                            </div>
                        </div>
                    </div>
                </details> : <>
                    <input type="hidden" name="vatRate" value="0"/>
                    <input type="hidden" name="isDeclared" value="false"/>
                    <input type="hidden" name="hasElectronicInvoice" value="false"/>
                    <input type="hidden" name="invoiceStatus" value="NON_PREVISTA"/>
                </>}

            <details className="form-section full app-form-wizard-step app-form-wizard-step-4" open>
                <summary>
                    <span>Pagamenti</span>
                    <small>Stato, residuo e movimenti registrati</small>
                </summary>
                <div className="form-section-stack">

                    {/*<div className="field-note payment-note payment-status-note full">*/}
                    {/*    <div>*/}
                    {/*        <span className="muted">Stato &nbsp;</span>*/}
                    {/*        <strong className={computedPaymentStatusInfo.className}>*/}
                    {/*            {computedPaymentStatusInfo.icon} {computedPaymentStatusInfo.label}*/}
                    {/*        </strong>*/}
                    {/*    </div>*/}
                    {/*    <div>*/}
                    {/*        <span className="muted">Residuo &nbsp;</span>*/}
                    {/*        <strong className={residual > 0 ? "text-critical" : "text-ok"}>*/}
                    {/*            {formatEuro(residual)}*/}
                    {/*        </strong>*/}
                    {/*    </div>*/}
                    {/*</div>*/}


                    <div className="section-title">
                        {/*<h3>Pagamenti</h3>*/}
                        <p>Puoi registrare uno o più pagamenti per la stessa spesa.</p>
                    </div>
                    <section className="payments-box full">
                        <div className="section-title">

                            <div className="form-summary full">
                                <div>
                                    <span className="muted">Residuo</span>
                                    <strong
                                        className={residual > 0 ? "text-critical" : "text-ok"}>{formatEuro(residual)}</strong>
                                </div>
                                <div>
                                    <span className="muted">Stato</span>
                                    <strong
                                        className={computedPaymentStatusInfo.className}>{computedPaymentStatusInfo.label}</strong>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-default"
                                    onClick={addPaymentRow}
                                    disabled={!canAddPayment}
                                >
                                    ➕ Aggiungi pagamento
                                </button>
                            </div>
                        </div>
                        {payments.map((payment, index) => {
                            const isOpen = openPaymentKey === payment.key;
                            const cashBankLocked = isCashChannel(methodName(payment.paymentMethodId)) && cashBankIdValue;
                            const paymentMethod = paymentMethods.find(method => String(method.id) === payment.paymentMethodId);
                            const paymentBank = banks.find(bank => String(bank.id) === payment.bankId);

                            if (!isOpen) {
                                return (
                                    <div className="payment-row payment-summary-row" key={payment.key}>
                                        {renderPaymentHiddenInputs(payment)}
                                        <div className="payment-summary-primary">
                                            <span className="payment-summary-kicker">Pagamento effettuato</span>
                                            <strong className="payment-summary-amount">{formatEuro(Number(payment.amount || 0))}</strong>
                                        </div>
                                        <div className="payment-summary-date">
                                            <span>Data pagamento</span>
                                            <strong>{payment.paymentDate ? formatDateInputLabel(payment.paymentDate) : "Data non impostata"}</strong>
                                        </div>
                                        <div className="payment-summary-meta">
                                            <div>
                                                <span>Metodo</span>
                                                <strong>{paymentMethod?.icon ?? "•"} {paymentMethod?.name ?? "Non impostato"}</strong>
                                            </div>
                                            <div>
                                                <span>Banca</span>
                                                <strong>{paymentBank?.icon ?? "•"} {paymentBank?.name ?? "Non impostata"}</strong>
                                            </div>
                                        </div>
                                        <div className="payment-row-actions">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-default"
                                                onClick={() => setOpenPaymentKey(payment.key)}
                                            >
                                                ✎ Modifica
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-danger remove-row"
                                                onClick={() => removePaymentRow(index)}
                                            >
                                                🗑️ Elimina
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    className="payment-row"
                                    key={payment.key}
                                    ref={openPaymentKey === payment.key ? openPaymentRef : null}
                                >
                                    <input type="hidden" name="paymentId[]" value={payment.id ?? ""}/>
                                    <DateField
                                        className="payment-date-field"
                                        label="Data pagamento"
                                        name="paymentDate[]"
                                        value={payment.paymentDate}
                                        onChange={(value) => updatePayment(index, {paymentDate: value})}
                                    />
                                    <label className="payment-amount-field">
                                        <div className="switch-toggle-field-label">
                                            <span className="app-form-field-icon">€</span>
                                            &nbsp;&nbsp;&nbsp;
                                            <span>Importo pagamento</span>
                                        </div>

                                        <MoneyInput
                                            value={payment.amount}
                                            onValueChange={(value) =>
                                                updatePayment(index, {
                                                    amount: value.replace(",", "."),
                                                    amountTouched: true,
                                                })
                                            }
                                        />
                                        <input type="hidden" name="paymentAmount[]" value={payment.amount}/>
                                        <span className="payment-amount-shortcuts" aria-label="Impostazione rapida importo pagamento">
                                            {[25, 50, 75, 100].map(percentage => {
                                                const suggestedAmount = paymentAvailableAmount(index) * percentage / 100;
                                                const selected = suggestedAmount > 0
                                                    && Math.abs(Number(payment.amount || 0) - suggestedAmount) < 0.005;
                                                return <button
                                                    type="button"
                                                    key={percentage}
                                                    className={selected ? "is-selected" : ""}
                                                    aria-pressed={selected}
                                                    onClick={() => setPaymentPercentage(index, percentage)}
                                                >
                                                    {percentage}%
                                                </button>;
                                            })}
                                        </span>
                                    </label>
                                    <div className="payment-select-field">
                                        <span className="payment-select-label"><i aria-hidden="true">▣</i> Canale pagamento</span>
                                        <div className="payment-select-control">
                                            <select
                                                name="paymentMethodId[]"
                                                value={payment.paymentMethodId}
                                                onChange={(event) => updatePayment(index, {paymentMethodId: event.currentTarget.value})}
                                            >
                                                <option value="">Seleziona metodo</option>
                                                {availablePaymentMethods.map(method =>
                                                    <option key={method.id} value={method.id}>{method.icon ?? "  •  "} {method.name}</option>)}
                                            </select>
                                            <span className="payment-select-caret" aria-hidden="true">⌄</span>
                                        </div>
                                    </div>
                                    <div className="payment-select-field">
                                        <span className="payment-select-label"><i aria-hidden="true">▥</i> Banca pagamento</span>
                                        {cashBankLocked ?
                                            <input type="hidden" name="paymentBankId[]" value={cashBankIdValue}/> : null}
                                        <div className="payment-select-control">
                                            <select
                                                name={cashBankLocked ? undefined : "paymentBankId[]"}
                                                value={cashBankLocked ? cashBankIdValue : payment.bankId}
                                                disabled={Boolean(cashBankLocked)}
                                                onChange={(event) => updatePayment(index, {bankId: event.currentTarget.value})}
                                            >
                                                <option value="">-</option>
                                                {banks.map((bank) => (
                                                    <option key={bank.id} value={bank.id}>
                                                        {bank.icon ?? "  •  "} {bank.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <span className="payment-select-caret" aria-hidden="true">⌄</span>
                                        </div>
                                    </div>
                                    <div className="payment-edit-actions">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-danger remove-row"
                                            onClick={() => removePaymentRow(index)}
                                        >
                                            🗑️ Rimuovi
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-primary payment-collapse-action"
                                            disabled={!isPaymentComplete(normalizePaymentRow(payment))}
                                            onClick={() => setOpenPaymentKey(null)}
                                        >
                                            ✓ Ok
                                        </button>
                                        {/*<button*/}
                                        {/*    type="button"*/}
                                        {/*    className="btn btn-sm btn-default"*/}
                                        {/*    onClick={() => payment.id ? setOpenPaymentKey(null) : removePaymentRow(index)}*/}
                                        {/*>*/}
                                        {/*    × Annulla*/}
                                        {/*</button>*/}
                                    </div>
                                </div>
                            );
                        })}

                        {!canAddPayment && (
                            <div className="flex">
                                <p className="inline-warning">
                                    Per aggiungere un altro pagamento, completa prima l’ultima riga.
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </details>

            <section className="expense-review-step full app-form-wizard-step app-form-wizard-step-6" aria-label="Riepilogo spesa">
                <div className="record-review-heading">
                    <div>
                        <span className="record-review-kicker">Controlla prima di salvare</span>
                        <h3>Riepilogo della spesa</h3>
                    </div>
                    <strong>{formatEuro(amountValue)}</strong>
                </div>
                <div className="record-review-grid">
                    {!isVatSettlement ? <div className="record-review-item"><i aria-hidden="true">◷</i><span>Data ordine<strong>{formatDateInputLabel(orderDate)}</strong></span>
                    </div> : null}
                    <div className="record-review-item">
                        <i aria-hidden="true">◷</i><span>Scadenza<strong>{dueDate ? formatDateInputLabel(dueDate) : "Non indicata"}</strong></span>
                    </div>
                    <div className="record-review-item wide">
                        <i aria-hidden="true">◎</i><span>Fornitore<strong>{currentSupplierName}</strong></span></div>
                    <div className="record-review-item wide">
                        <i aria-hidden="true">≡</i><span>Descrizione<strong>{description || "Non indicata"}</strong></span>
                    </div>
                    <div className="record-review-item wide">
                        <i aria-hidden="true">◇</i><span>Categoria<strong>{selectedCategory ? `${selectedCategory.icon ? `${categoryIcon(selectedCategory)} ` : ""}${selectedCategory.name}` : "Non indicata"}</strong></span>
                    </div>
                    <div className="record-review-item">
                        <i aria-hidden="true">▦</i><span>Periodo contabile<strong>{billingPeriod || "Non indicato"}</strong></span>
                    </div>
                    <div className="record-review-item">
                        <i aria-hidden="true">%</i><span>Fiscale / IVA<strong>{isDeclared ? `Sì · ${vatRate}%` : "No · 0%"}</strong></span>
                    </div>
                    <div className="record-review-item wide">
                        <i aria-hidden="true">▤</i><span>Fattura elettronica<strong>{hasElectronicInvoice ? `Sì · ${currentInvoiceStatusLabel}` : `No · ${currentInvoiceStatusLabel}`}</strong></span>
                    </div>
                    <div className="record-review-item">
                        <i aria-hidden="true">€</i><span>Pagamenti<strong>{payments.length ? `${payments.length} · ${formatEuro(paidAmountValue)}` : "Nessun pagamento"}</strong></span>
                    </div>
                    <div className="record-review-item">
                        <i aria-hidden="true">=</i><span>Residuo<strong className={residual > 0 ? "text-critical" : "text-ok"}>{formatEuro(residual)}</strong></span>
                    </div>
                </div>
                <button className="btn btn-md btn-default expense-review-attachments-button" type="button" onClick={() => goToMobileStep(7)}>
                    <span className="btn-icon">＋</span>
                    <span><strong>Allegati e note</strong><small>{attachmentCount ? `${attachmentCount} allegati selezionati` : notes ? "Note inserite" : "Aggiungi informazioni opzionali"}</small></span>
                    <span aria-hidden="true">→</span>
                </button>
            </section>

            <details ref={attachmentsSectionRef} className="form-section full app-form-wizard-step app-form-wizard-step-7" open={mobileStep === 7}>
                <summary>
                    <span>Allegati e note</span>
                    <small>File, XML, P7M e note interne</small>
                </summary>
                <div className="form-section-stack">

                    <label className="card attachment-row-wrap">
                        <div className="attachment-row-title">
                            Allegati &nbsp;
                            <small className="text-warning">PDF, immagini, XML, P7M</small>
                            <div>

                            </div>
                        </div>
                        <div className="flex attachment-row">
                            <input
                                type="file"
                                name="attachments"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.xml,.p7m"
                                multiple
                                onChange={(e) => {
                                    const count = e.target.files?.length ?? 0;
                                    setAttachmentCount(count);
                                    setAttachmentError(count > 5 ? "Puoi caricare massimo 5 allegati." : "");
                                }}
                            />
                            <div className="field-note attachments-note">
                                Limite allegati &nbsp;<br/>
                                <strong>5 file</strong>
                            </div>
                        </div>
                    </label>

                    {attachmentError && (
                        <p className="inline-warning full">{attachmentError}</p>
                    )}
                    <label className="card full">
                        Note
                        <textarea
                            name="notes"
                            rows={3}
                            placeholder="Note interne opzionali"
                            value={notes}
                            onChange={event => setNotes(event.currentTarget.value)}
                        />
                    </label>
                </div>
            </details>

            <MobileFormStickyActions
                currentStep={isPaymentOnlyMode ? 1 : mobileStep}
                submitStep={isPaymentOnlyMode ? 1 : 6}
                onBack={previousMobileStep}
                onNext={nextMobileStep}
                onCancel={onCancel}
                cancelHref={cancelHref ?? "/expenses"}
                backLabel={mobileStep === 7 ? "Riepilogo" : "Indietro"}
                submitLabel={isPaymentOnlyMode ? "Salva pagamento" : submitLabel}
                isSubmitting={isSubmitting}
                submitDisabled={Boolean(attachmentError)}
                error={submitError}
            />

            <div className="actions-row full form-actions-row form-sticky-actions">
                {submitError ? <p className="inline-warning full">{submitError}</p> : null}
                <button className="btn btn-md btn-primary" type="submit" disabled={isSubmitting}>
                    <span className="btn-icon">✓</span> {isSubmitting ? "Salvataggio..." : submitLabel}
                </button>
                {onCancel ? (
                    <button className="btn btn-md btn-default" type="button" onClick={onCancel}><span
                        className="btn-icon">×</span> Annulla</button>
                ) : (
                    <a className="btn btn-md btn-default" href={cancelHref ?? "/expenses"}><span
                        className="btn-icon">×</span> Annulla</a>
                )}
            </div>
        </form>
    );
}
