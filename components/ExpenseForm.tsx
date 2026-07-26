"use client";

import {type FormEvent, useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {categoryIcon} from "@/lib/expense-ui";

type Option = { id: number; code?: string; name: string; icon?: string | null; isFallback?: boolean | null; systemRole?: string | null; isVatSettlementDefault?: boolean };
type SupplierOption = {
    id: number;
    businessName: string;
    alias?: string | null;
    email?: string | null;
    vatNumber?: string | null;
    iban?: string | null;
    pec?: string | null;
    taxCodeSdi?: string | null;
    internalNotes?: string | null;
    systemRole?: string | null;
};
type PaymentRow = {
    key: number;
    id?: number;
    paymentDate: string;
    paymentMethodId: string;
    bankId: string;
    amount: string;
    paidBy: "HERBAL_MARKET" | "ALTRO_OPERATORE";
    amountTouched: boolean;
};

type InitialPayment = {
    id?: number;
    paymentDate?: string | Date | null;
    paymentMethodId?: number | null;
    bankId?: number | null;
    amount?: string | number | { toString(): string } | null;
    paidBy?: "HERBAL_MARKET" | "ALTRO_OPERATORE";
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
    expenseType?: "STANDARD" | "VAT_SETTLEMENT";
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
};

function toDateInput(value?: string | Date | null) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

const today = new Date().toISOString().slice(0, 10);

function datePlusDays(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

function addDaysToDateInput(value: string, days: number) {
    const date = value ? new Date(`${value}T00:00:00`) : new Date();
    if (Number.isNaN(date.getTime())) return datePlusDays(days);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

function monthInputFromDateInput(value: string) {
    const [year, month] = value.split("-");
    return year && month ? `${year}-${month}` : "";
}

const currentBillingPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
const defaultChannel = "Bonifico";
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
        paidBy: "HERBAL_MARKET",
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
        paidBy: payment.paidBy ?? "HERBAL_MARKET",
        amountTouched: true,
    };
}

function isPaymentComplete(row: PaymentRow) {
    return Boolean(
        row.paymentDate &&
        row.paymentMethodId &&
        row.bankId &&
        Number(row.amount || 0) > 0 &&
        row.paidBy,
    );
}

function isCashChannel(channel: string) {
    return channel.trim().toLowerCase() === cashChannel.toLowerCase();
}

function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="money-input">
            <span>€</span>
            <input type="number" step="0.01" min="0" {...props} />
        </div>
    );
}

function SupplierAutocomplete({
                                  suppliers = [],
                                  initialSupplierId,
                                  initialMerchant,
                              }: {
    suppliers?: SupplierOption[];
    initialSupplierId?: number | null;
    initialMerchant?: string | null;
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
    const [createData, setCreateData] = useState({
        businessName: "",
        email: "",
        vatNumber: "",
        iban: "",
        pec: "",
        taxCodeSdi: "",
        alias: "",
        internalNotes: "",
    });
    const [isSaving, setIsSaving] = useState(false);
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

    async function createSupplier() {
        if (!createData.businessName.trim()) return;
        setIsSaving(true);
        const response = await fetch("/api/suppliers", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(createData),
        });
        setIsSaving(false);
        if (!response.ok) return;
        const supplier = await response.json();
        setResults((current) => [
            supplier,
            ...current.filter((item) => item.id !== supplier.id),
        ]);
        selectSupplier(supplier);
        setCreateData({
            businessName: "",
            email: "",
            vatNumber: "",
            iban: "",
            pec: "",
            taxCodeSdi: "",
            alias: "",
            internalNotes: "",
        });
        setShowCreate(false);
    }

    return (
        <div className="supplier-picker supplier-picker-wide expense-wizard-step expense-wizard-step-3" ref={containerRef}>
            <input type="hidden" name="supplierId" value={selected?.id ?? ""}/>
            <input
                type="hidden"
                name="merchant"
                value={selected?.businessName ?? query}
            />
            <label>
                Esercente
                <div className="supplier-input-row">
                    <input
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setSelected(null);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={onKeyDown}
                        placeholder="Cerca per ragione sociale o alias"
                        autoComplete="off"
                        required
                    />
                    <button
                        type="button"
                        className="btn btn-sm btn-link inline-link-button"
                        onClick={() => {
                            setCreateData((data) => ({...data, businessName: query}));
                            setShowCreate(true);
                        }}
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
                                {supplier.alias && <small>Alias: {supplier.alias}</small>}
                            </button>
                        ))
                    ) : (
                        <div className="empty-supplier-result">
                            Nessun fornitore trovato.
                        </div>
                    )}
                </div>
            )}
            {showCreate && createPortal(
                <div
                    className="modal-backdrop nested-form-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Nuovo esercente o fornitore"
                    onMouseDown={(event) => {
                        event.stopPropagation();
                        if (event.target === event.currentTarget) setShowCreate(false);
                    }}
                >
                    <div className="modal-card" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="modal-title">
                            <h3>➕ Nuovo esercente/fornitore</h3>
                            <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setShowCreate(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="modal-form-grid">
                            <label>
                                Ragione Sociale
                                <input
                                    value={createData.businessName}
                                    onChange={(e) =>
                                        setCreateData((d) => ({
                                            ...d,
                                            businessName: e.target.value,
                                        }))
                                    }
                                    required
                                />
                            </label>
                            <label>
                                Email
                                <input
                                    value={createData.email}
                                    onChange={(e) =>
                                        setCreateData((d) => ({...d, email: e.target.value}))
                                    }
                                />
                            </label>
                            <label>
                                P.IVA
                                <input
                                    value={createData.vatNumber}
                                    onChange={(e) =>
                                        setCreateData((d) => ({...d, vatNumber: e.target.value}))
                                    }
                                />
                            </label>
                            <label>
                                IBAN
                                <input
                                    value={createData.iban}
                                    onChange={(e) =>
                                        setCreateData((d) => ({...d, iban: e.target.value}))
                                    }
                                />
                            </label>
                            <label>
                                PEC
                                <input
                                    value={createData.pec}
                                    onChange={(e) =>
                                        setCreateData((d) => ({...d, pec: e.target.value}))
                                    }
                                />
                            </label>
                            <label>
                                Codice SDI/Fiscale
                                <input
                                    value={createData.taxCodeSdi}
                                    onChange={(e) =>
                                        setCreateData((d) => ({...d, taxCodeSdi: e.target.value}))
                                    }
                                />
                            </label>
                            <label>
                                Alias
                                <input
                                    value={createData.alias}
                                    onChange={(e) =>
                                        setCreateData((d) => ({...d, alias: e.target.value}))
                                    }
                                />
                            </label>
                            <label className="full">
                                Note interne
                                <textarea
                                    rows={3}
                                    value={createData.internalNotes}
                                    onChange={(e) =>
                                        setCreateData((d) => ({
                                            ...d,
                                            internalNotes: e.target.value,
                                        }))
                                    }
                                />
                            </label>
                        </div>
                        <div className="actions-row right-actions">
                            <button
                                type="button"
                                className="btn btn-sm btn-default"
                                onClick={() => setShowCreate(false)}
                            >
                                ✕ Annulla
                            </button>
                            <button
                                type="button"
                                className="btn btn-md btn-primary"
                                disabled={isSaving}
                                onClick={createSupplier}
                            >
                                ✓ Salva e seleziona
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}

function ProductServiceAutocomplete({
                                        initialValue = "",
                                    }: {
    initialValue?: string | null;
}) {
    const [query, setQuery] = useState(initialValue ?? "");
    const [results, setResults] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLLabelElement>(null);

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
            const response = await fetch(`/api/expense-descriptions${params}`, {
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

    function selectSuggestion(value: string) {
        setQuery(value);
        setIsOpen(false);
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
            selectSuggestion(results[activeIndex]);
        }
        if (event.key === "Escape") setIsOpen(false);
    }

    return (
        <label
            className="span-2 product-suggestion-picker expense-wizard-step expense-wizard-step-3"
            ref={containerRef}
        >
            Prodotto/servizio
            <input
                name="description"
                required
                placeholder="Descrizione libera della spesa"
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
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
        </label>
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
}: Props) {
    const [isVatSettlement, setIsVatSettlement] = useState(initialExpense?.expenseType === "VAT_SETTLEMENT");
    const vatSettlementCategory = categories.find(category => category.isVatSettlementDefault);
    const vatSettlementSupplier = suppliers.find(supplier => supplier.systemRole === "VAT_SETTLEMENT");
    const availablePaymentMethods = isVatSettlement
        ? paymentMethods.filter(method => method.systemRole !== "CASH" && !isCashChannel(method.name))
        : paymentMethods;
    const defaultPaymentMethod = availablePaymentMethods.find(method => method.name === defaultChannel) ?? availablePaymentMethods[0];
    const fallbackBank = banks.find(bank => bank.name.toLowerCase() === cashBankName.toLowerCase()) ?? banks.find(bank => bank.isFallback) ?? banks[0];
    const cashBankId = banks.find((bank) => bank.name.toLowerCase() === cashBankName.toLowerCase())?.id;
    const cashBankIdValue = cashBankId ? String(cashBankId) : (fallbackBank ? String(fallbackBank.id) : "");
    const methodName = (methodId: string) => paymentMethods.find(method => String(method.id) === methodId)?.name ?? "";
    const normalizePaymentRow = (row: PaymentRow): PaymentRow =>
        isCashChannel(methodName(row.paymentMethodId)) && cashBankIdValue ? {...row, bankId: cashBankIdValue} : row;
    const [amount, setAmount] = useState(normalizeMoney(initialExpense?.amount).replace(".", ","));
    const [vatRate, setVatRate] = useState(normalizeMoney(initialExpense?.vatRate) || "22");
    const [submitError, setSubmitError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mobileStep, setMobileStep] = useState(() => Math.max(1, Math.min(6, initialMobileStep)));
    const formRef = useRef<HTMLFormElement>(null);
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
    const [openPaymentKey, setOpenPaymentKey] = useState<number | null>(null);
    const openPaymentRef = useRef<HTMLDivElement | null>(null);
    const [attachmentError, setAttachmentError] = useState("");
    const initialOrderDate = toDateInput(initialExpense?.receivedDate) || today;
    const initialBillingPeriod =
        initialExpense?.year && initialExpense?.month
            ? `${initialExpense.year}-${String(initialExpense.month).padStart(2, "0")}`
            : currentBillingPeriod;
    const [orderDate, setOrderDate] = useState(initialOrderDate);
    const [billingPeriod, setBillingPeriod] = useState(initialBillingPeriod);
    const [dueDate, setDueDate] = useState(
        initialExpense ? toDateInput(initialExpense.dueDate) : addDaysToDateInput(initialOrderDate, 7),
    );
    const [invoiceStatus, setInvoiceStatus] = useState(
        initialExpense?.invoiceStatus ?? "IN_ATTESA",
    );
    const [isRecurring, setIsRecurring] = useState(
        initialExpense?.isRecurring ?? false,
    );
    const isExistingExpense = Boolean(initialExpense?.id);
    const canEditRecurringFlag = !isExistingExpense || Boolean(initialExpense?.isRecurring);
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
    const canAddPayment =
        payments.length === 0 || isPaymentComplete(payments[payments.length - 1]);

    const invoiceStatuses = useMemo(
        () => {
            const base = [
                ["IN_ATTESA", "⏳ In attesa"],
                ["RICEVUTA", "✅ Emessa"],
                ["CONTESTAZIONE", "⚠️ Contestazione"],
            ];
            return [["NON_PREVISTA", "Non prevista"], ...base];
        },
        [],
    );

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

    function goToMobileStep(nextStep: number) {
        setMobileStep(Math.max(1, Math.min(6, nextStep)));
        window.requestAnimationFrame(() => formRef.current?.scrollIntoView({behavior: "smooth", block: "start"}));
    }

    function validateMobileStep() {
        const stepElements = Array.from(formRef.current?.querySelectorAll<HTMLElement>(`.expense-wizard-step-${mobileStep}`) ?? []);
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
        if (validateMobileStep()) goToMobileStep(mobileStep + 1);
    }

    function updatePayment(index: number, patch: Partial<PaymentRow>) {
        setPayments((rows) =>
            rows.map((row, i) => {
                if (i !== index) return row;
                const next = {...row, ...patch};
                const nextMethodName = methodName(next.paymentMethodId);
                if ("paymentMethodId" in patch && isCashChannel(nextMethodName) && cashBankIdValue) {
                    next.bankId = cashBankIdValue;
                }
                return next;
            }),
        );
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
            {
                ...emptyPaymentRow(key),
                paymentMethodId: defaultPaymentMethod ? String(defaultPaymentMethod.id) : "",
                amount: suggestedAmount,
                amountTouched: Boolean(suggestedAmount),
            },
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
                <input type="hidden" name="paymentPaidBy[]" value={payment.paidBy}/>
            </>
        );
    }

    function paymentSummary(payment: PaymentRow) {
        const bankName = banks.find((bank) => String(bank.id) === payment.bankId)?.name ?? "-";
        return [
            payment.paymentDate ? formatDateInputLabel(payment.paymentDate) : "Data non impostata",
            `${paymentMethods.find(method => String(method.id) === payment.paymentMethodId)?.icon ?? "  •  "} ${methodName(payment.paymentMethodId) || "Canale non impostato"}`,
            bankName,
            formatEuro(Number(payment.amount || 0)),
            payment.paidBy === "ALTRO_OPERATORE" ? "Altro Operatore" : "Herbal Market",
        ].join(" · ");
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
            className={`card form expense-form expense-mobile-wizard expense-mobile-step-${mobileStep}`}
            action={action}
            method="post"
            encType="multipart/form-data"
            onSubmit={handleSubmit}
            data-in-place-submit={onSaved ? "true" : undefined}
        >
            <div className="expense-wizard-header full">
                <div className="expense-wizard-heading">
                    <span>Passaggio {mobileStep} di 6</span>
                    <strong>{["Date", "Importo", "Dettagli", "Pagamenti", "Fattura", "Allegati e note"][mobileStep - 1]}</strong>
                </div>
                <div className="expense-wizard-progress" aria-label={`Passaggio ${mobileStep} di 6`}>
                    <span style={{width: `${mobileStep / 6 * 100}%`}}/>
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

            <details className="form-section full expense-wizard-split-section expense-wizard-document-section" open>
                <summary>
                    <span>Documento</span>
                    <small>Dati principali della spesa</small>
                </summary>
                <div className="form-section-grid">

                    <div className="expense-type-choice full expense-wizard-step expense-wizard-step-1">
                        <span className="expense-type-choice-title">Tipo di spesa</span>
                        <input type="hidden" name="isRecurring" value={isRecurring ? "true" : "false"}/>
                        <input type="hidden" name="expenseType" value={isVatSettlement ? "VAT_SETTLEMENT" : "STANDARD"}/>
                        <div className="expense-type-choice-grid" role="radiogroup" aria-label="Tipo di spesa">
                            <button type="button" className={!isRecurring && !isVatSettlement ? "is-selected" : ""} role="radio" aria-checked={!isRecurring && !isVatSettlement}>
                                <span aria-hidden="true">●</span>
                                <strong>Singola</strong>
                                <small>Spesa occasionale</small>
                            </button>
                            <button type="button" className={isRecurring ? "is-selected" : ""} role="radio" aria-checked={isRecurring} disabled title="Disponibile prossimamente">
                                <span aria-hidden="true">↻</span>
                                <strong>Ricorrente</strong>
                                <small>Prossimamente</small>
                            </button>
                            <button type="button" className={isVatSettlement ? "is-selected" : ""} role="radio" aria-checked={isVatSettlement} disabled title="Disponibile prossimamente">
                                <span aria-hidden="true">IVA</span>
                                <strong>Saldo IVA</strong>
                                <small>Prossimamente</small>
                            </button>
                        </div>
                    </div>
                    <div className="toggle-field switch-toggle-field expense-type-switch-in-form expense-type-desktop full">
                        <span>Tipo spesa: {isRecurring ? "Ricorrente" : "Singola"}</span>
                        <div className="switch-group">
                            <label className="switch">
                                <input type="hidden" name="isRecurring" value="false"/>
                                <input
                                    type="checkbox"
                                    name="isRecurring"
                                    value="true"
                                    checked={isRecurring}
                                    disabled={!canEditRecurringFlag}
                                    onChange={(event) => {
                                        const checked = event.currentTarget.checked;
                                        setIsRecurring(checked);
                                        if (checked) setIsVatSettlement(false);
                                        if (checked && onSwitchToRecurring && !isExistingExpense) onSwitchToRecurring();
                                    }}
                                />
                                <span className="slider"/>
                                <span>Ricorrente</span>
                            </label>
                            <label className="switch">
                                <input type="hidden" name="expenseType" value={isVatSettlement ? "VAT_SETTLEMENT" : "STANDARD"}/>
                                <input
                                    type="checkbox"
                                    checked={isVatSettlement}
                                    disabled={!canEditExpenseType}
                                    onChange={(event) => {
                                        const checked = event.currentTarget.checked;
                                        setIsVatSettlement(checked);
                                        if (checked) setIsRecurring(false);
                                    }}
                                />
                                <span className="slider"/>
                                <span>Saldo IVA</span>
                            </label>
                        </div>
                    </div>

                    {isVatSettlement && (!vatSettlementCategory || !vatSettlementSupplier) ? <div className="inline-form-error full expense-wizard-step expense-wizard-step-1">
                        Configura la categoria Saldo IVA nelle Impostazioni. Il fornitore di sistema deve essere inizializzato per il workspace.
                    </div> : null}

                    <label className="expense-wizard-step expense-wizard-step-1">
                        {isVatSettlement ? "Data registrazione" : "Data ordine"}
                        <input
                            type="date"
                            name="receivedDate"
                            value={orderDate}
                            onChange={(event) => {
                                const nextOrderDate = event.currentTarget.value;
                                const nextOrderMonth = monthInputFromDateInput(nextOrderDate);
                                setOrderDate(nextOrderDate);
                                if (nextOrderMonth && (!billingPeriod || billingPeriod < nextOrderMonth)) {
                                    setBillingPeriod(nextOrderMonth);
                                }
                                setDueDate(addDaysToDateInput(nextOrderDate, 7));
                            }}
                            required
                        />
                        {isVatSettlement ? <small className="muted">Usata per l’andamento temporale complessivo.</small> : null}
                    </label>
                    <label className="expense-wizard-step expense-wizard-step-1">
                        Data scadenza
                        <input
                            type="date"
                            name="dueDate"
                            value={dueDate}
                            onChange={(event) => setDueDate(event.currentTarget.value)}
                        />
                        <span className="expense-due-date-shortcuts" aria-label="Selezione rapida data scadenza">
                            {[0, 7, 15, 30].map(days => {
                                const value = addDaysToDateInput(orderDate, days);
                                return <button
                                    type="button"
                                    key={days}
                                    className={dueDate === value ? "is-selected" : ""}
                                    aria-pressed={dueDate === value}
                                    onClick={() => setDueDate(value)}
                                >{days === 0 ? "Stesso g" : `+${days}gg`}</button>;
                            })}
                        </span>
                    </label>
                    <label className="expense-wizard-step expense-wizard-step-5">
                        Periodo Contabile
                        <input
                            type="month"
                            name="billingPeriod"
                            value={billingPeriod}
                            onChange={(event) => setBillingPeriod(event.currentTarget.value)}
                            required
                        />
                        {isVatSettlement ? <small className="muted">Determina il periodo fiscale nel quale conteggiare il saldo IVA.</small> : null}
                    </label>
                    {isVatSettlement ? <label className="expense-wizard-step expense-wizard-step-3">
                        Categoria
                        <input value={vatSettlementCategory?.name ?? "Non configurata"} readOnly />
                        <input type="hidden" name="categoryId" value={vatSettlementCategory?.id ?? ""} />
                    </label> : <label className="expense-wizard-step expense-wizard-step-3">
                        {/*🏷️ Categoria*/}
                        Categoria
                        <select
                            name="categoryId"
                            required
                            defaultValue={initialExpense?.categoryId ?? ""}
                        >
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.icon ? `${categoryIcon(c)} ${c.name}` : c.name}
                                </option>
                            ))}
                        </select>
                    </label>}
                    {isVatSettlement ? <label className="expense-wizard-step expense-wizard-step-3">
                        Esercente
                        <input value={vatSettlementSupplier?.businessName ?? "Non configurato"} readOnly />
                        <input type="hidden" name="supplierId" value={vatSettlementSupplier?.id ?? ""} />
                        <input type="hidden" name="merchant" value={vatSettlementSupplier?.businessName ?? ""} />
                    </label> : <SupplierAutocomplete
                        suppliers={suppliers.filter(supplier => !supplier.systemRole)}
                        initialSupplierId={initialExpense?.supplierId ?? null}
                        initialMerchant={initialExpense?.merchant ?? ""}
                    />}
                    <ProductServiceAutocomplete
                        initialValue={initialExpense?.description ?? ""}
                    />
                    <div className="amount-vat-row full expense-wizard-step expense-wizard-step-2">
                        <div className="expense-wizard-amount-entry">
                            {!isVatSettlement ? <label className="expense-wizard-mobile-switch">
                                <span>Fiscale</span>
                                <span className="switch">
                                    <input
                                        type="checkbox"
                                        checked={isDeclared}
                                        onChange={(event) => {
                                            const checked = event.currentTarget.checked;
                                            setIsDeclared(checked);
                                            if (!checked) {
                                                setHasElectronicInvoice(false);
                                                setInvoiceStatus("NON_PREVISTA");
                                            }
                                        }}
                                    />
                                    <span className="slider"/>
                                </span>
                            </label> : null}
                            <label className="expense-wizard-amount-field">
                                {!isVatSettlement ? "Costo IVA inclusa" : "Importo IVA"}
                                <MoneyInput
                                    type="text"
                                    inputMode="decimal"
                                    required
                                    value={amount}
                                    onChange={(e) => handleAmountChange(e.currentTarget.value)}
                                />
                                <input type="hidden" name="amount" value={normalizedAmount}/>
                            </label>
                        </div>
                        {!isVatSettlement ? <label>
                            IVA
                            <select
                                name="vatRate"
                                value={vatRate}
                                onChange={(event) => setVatRate(event.currentTarget.value)}
                            >
                                <option value="0">0%</option>
                                <option value="4">4%</option>
                                <option value="10">10%</option>
                                <option value="22">22%</option>
                            </select>
                        </label> : <div></div>}
                        <div className="expense-wizard-vat-buttons full" aria-label="Aliquota IVA">
                            {["0", "4", "10", "22"].map(rate => <button
                                type="button"
                                key={rate}
                                className={vatRate === rate ? "is-selected" : ""}
                                disabled={isVatSettlement}
                                onClick={() => setVatRate(rate)}
                            >{rate}%</button>)}
                        </div>
                        <div className="expense-wizard-keypad full" aria-label="Tastiera numerica">
                            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "backspace"].map(key => <button
                                type="button"
                                key={key}
                                aria-label={key === "backspace" ? "Cancella ultima cifra" : key}
                                onClick={() => appendAmountKey(key)}
                            >{key === "backspace" ? "⌫" : key}</button>)}
                        </div>
                    </div>
                    <input type="hidden" name="paymentStatus" value={computedPaymentStatus}/>
                </div>
            </details>

            {!isVatSettlement ? <details className="form-section full expense-wizard-split-section expense-wizard-fiscal-section" open>
                <summary>
                    <span>Fiscale</span>
                    <small>IVA, detrazione e fattura elettronica</small>
                </summary>
                <div className="form-section-grid">
                    <div className="toggle-field-wrap">
                        <div className="toggle-field switch-toggle-field expense-wizard-step expense-wizard-step-2 expense-fiscal-desktop-control">
                            <span>Fiscale</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    name="isDeclared"
                                    value="true"
                                    checked={isDeclared}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setIsDeclared(checked);
                                        if (!checked) {
                                            setHasElectronicInvoice(false);
                                            setInvoiceStatus("NON_PREVISTA");
                                        }
                                    }}
                                />
                                <span className="slider"/>
                                <span>{isDeclared ? "Si" : "No"}</span>
                            </label>
                        </div>

                        <div className="toggle-field switch-toggle-field expense-wizard-step expense-wizard-step-5 expense-invoice-desktop-control">
                            <span>Fatt. Elett.</span>
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
                                        if (checked) setIsDeclared(true);
                                    }}
                                />
                                <span className="slider"/>
                                <span>{hasElectronicInvoice ? "Si" : "No"}</span>
                            </label>
                        </div>
                    </div>
                    <div className="expense-invoice-step-row expense-wizard-step expense-wizard-step-5">
                        <label className="expense-wizard-mobile-switch">
                            <span>Fattura elettronica</span>
                            <span className="switch">
                                <input
                                    type="checkbox"
                                    checked={hasElectronicInvoice}
                                    disabled={!isDeclared}
                                    onChange={(event) => {
                                        const checked = event.currentTarget.checked;
                                        setHasElectronicInvoice(checked);
                                        if (checked) setIsDeclared(true);
                                    }}
                                />
                                <span className="slider"/>
                            </span>
                        </label>
                        <label className="expense-invoice-status-field">
                            🧾 Stato Fattura
                            <select
                                name="invoiceStatus"
                                value={invoiceStatus}
                                disabled={invoiceNotExpected}
                                onChange={(e) => setInvoiceStatus(e.currentTarget.value)}
                            >
                                {invoiceStatuses.map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                            {invoiceNotExpected && <input type="hidden" name="invoiceStatus" value="NON_PREVISTA"/>}
                        </label>
                    </div>
                </div>
            </details> : <>
                <input type="hidden" name="vatRate" value="0" />
                <input type="hidden" name="isDeclared" value="false" />
                <input type="hidden" name="hasElectronicInvoice" value="false" />
                <input type="hidden" name="invoiceStatus" value="NON_PREVISTA" />
                <div className="field-note full expense-wizard-step expense-wizard-step-5">
                    Fattura elettronica non prevista per il Saldo IVA.
                </div>
            </>}

            <details className="form-section full expense-wizard-step expense-wizard-step-4" open>
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
                        {payments.map((payment, index) => {
                            const isOpen = openPaymentKey === payment.key || !payment.id;
                            const cashBankLocked = isCashChannel(methodName(payment.paymentMethodId)) && cashBankIdValue;

                            if (!isOpen) {
                                return (
                                    <div className="payment-row" key={payment.key}>
                                        {renderPaymentHiddenInputs(payment)}
                                        <div className="span-3 payment-summary-cell">
                                            <h4>Pagamento registrato</h4>
                                            <div className="muted">{paymentSummary(payment)}</div>
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
                                    <label>
                                        Data pagamento
                                        <input
                                            type="date"
                                            name="paymentDate[]"
                                            value={payment.paymentDate}
                                            onChange={(e) =>
                                                updatePayment(index, {paymentDate: e.target.value})
                                            }
                                        />
                                    </label>
                                    <label>
                                        Canale pagamento
                                        <select
                                            name="paymentMethodId[]"
                                            value={payment.paymentMethodId}
                                            onChange={(e) => {
                                                updatePayment(index, {paymentMethodId: e.target.value});
                                            }}
                                        >
                                            <option value="">Seleziona metodo</option>
                                            {availablePaymentMethods.map(method => <option key={method.id} value={method.id}>{method.icon ?? "  •  "} {method.name}</option>)}
                                        </select>
                                    </label>
                                    <label>
                                        {/*🏦 Banca*/}
                                        Banca pagamento
                                        {cashBankLocked ? <input type="hidden" name="paymentBankId[]" value={cashBankIdValue}/> : null}
                                        <select
                                            name={cashBankLocked ? undefined : "paymentBankId[]"}
                                            value={cashBankLocked ? cashBankIdValue : payment.bankId}
                                            disabled={Boolean(cashBankLocked)}
                                            onChange={(e) =>
                                                updatePayment(index, {bankId: e.target.value})
                                            }
                                        >
                                            <option value="">-</option>
                                            {banks.map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.icon ?? "  •  "} {b.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Importo pagamento
                                        <MoneyInput
                                            name="paymentAmount[]"
                                            value={payment.amount}
                                            onChange={(e) =>
                                                updatePayment(index, {
                                                    amount: e.currentTarget.value,
                                                    amountTouched: true,
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Pagamento effettuato da
                                        <select
                                            name="paymentPaidBy[]"
                                            value={payment.paidBy}
                                            onChange={(e) =>
                                                updatePayment(index, {
                                                    paidBy: e.target.value as PaymentRow["paidBy"],
                                                })
                                            }
                                        >
                                            <option value="HERBAL_MARKET">Herbal Market</option>
                                            <option value="ALTRO_OPERATORE">Altro Operatore</option>
                                        </select>
                                    </label>
                                    <div className="payment-edit-actions">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-danger remove-row"
                                            onClick={() => removePaymentRow(index)}
                                        >
                                            🗑️ Rimuovi
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

            <details className="form-section full expense-wizard-step expense-wizard-step-6" open={mobileStep === 6}>
                <summary>
                    <span>Allegati e note</span>
                    <small>File, XML, P7M e note interne</small>
                </summary>
                <div className="form-section-stack">

                    <label className="attachment-row-wrap">
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
                                onChange={(e) =>
                                    setAttachmentError(
                                        (e.target.files?.length ?? 0) > 5
                                            ? "Puoi caricare massimo 5 allegati."
                                            : "",
                                    )
                                }
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
                    <label className="full">
                        Note
                        <textarea
                            name="notes"
                            rows={3}
                            placeholder="Note interne opzionali"
                            defaultValue={initialExpense?.notes ?? ""}
                        />
                    </label>
                </div>
            </details>

            <div className="expense-wizard-actions full">
                {submitError ? <p className="inline-warning full">{submitError}</p> : null}
                <div className="expense-wizard-actions-row">
                    {mobileStep > 1 ? <button className="btn btn-md btn-default" type="button" onClick={() => goToMobileStep(mobileStep - 1)}>
                        ← Indietro
                    </button> : onCancel ? <button className="btn btn-md btn-default" type="button" onClick={onCancel}>
                        × Annulla
                    </button> : <a className="btn btn-md btn-default" href={cancelHref ?? "/expenses"}>× Annulla</a>}
                    {mobileStep < 6 ? <button className="btn btn-md btn-primary" type="button" onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        nextMobileStep();
                    }}>
                        Avanti →
                    </button> : <button className="btn btn-md btn-primary" type="submit" disabled={isSubmitting || Boolean(attachmentError)}>
                        <span className="btn-icon">✓</span> {isSubmitting ? "Salvataggio..." : submitLabel}
                    </button>}
                </div>
            </div>

            <div className="actions-row full form-actions-row form-sticky-actions">
                {submitError ? <p className="inline-warning full">{submitError}</p> : null}
                <button className="btn btn-md btn-primary" type="submit" disabled={isSubmitting}><span className="btn-icon">✓</span> {isSubmitting ? "Salvataggio..." : submitLabel}
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
