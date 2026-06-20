"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {bankIcons, categoryIcon} from "@/lib/expense-ui";

type Option = { id: number; code?: string; name: string; icon?: string | null };
type SupplierOption = {
    id: number;
    businessName: string;
    alias?: string | null;
    email?: string | null;
    phone?: string | null;
    pec?: string | null;
    taxCodeSdi?: string | null;
    internalNotes?: string | null;
};
type PaymentRow = {
    key: number;
    id?: number;
    paymentDate: string;
    channel: string;
    bankId: string;
    amount: string;
    paidBy: "HERBAL_MARKET" | "ALTRO_OPERATORE";
    amountTouched: boolean;
};

type InitialPayment = {
    id?: number;
    paymentDate?: string | Date | null;
    channel?: string | null;
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
    payments?: InitialPayment[];
    notes?: string | null;
};

type Props = {
    categories: Option[];
    banks: Option[];
    suppliers?: SupplierOption[];
    initialExpense?: InitialExpense;
    action?: string;
    title?: string;
    submitLabel?: string;
    onCancel?: () => void;
    cancelHref?: string;
    onSwitchToRecurring?: () => void;
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

const currentBillingPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
const defaultChannel = "Bonifico";
const cashChannel = "Cash";
const cashBankName = "Altra Banca";

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
        channel: defaultChannel,
        bankId: "",
        amount: "",
        paidBy: "HERBAL_MARKET",
        amountTouched: false,
    };
}

function paymentRowFromInitial(
    payment: InitialPayment,
    index: number,
): PaymentRow {
    return {
        key: payment.id ?? Date.now() + index,
        id: payment.id,
        paymentDate: toDateInput(payment.paymentDate),
        channel: payment.channel ?? defaultChannel,
        bankId: payment.bankId ? String(payment.bankId) : "",
        amount: normalizeMoney(payment.amount),
        paidBy: payment.paidBy ?? "HERBAL_MARKET",
        amountTouched: true,
    };
}

function isPaymentComplete(row: PaymentRow) {
    return Boolean(
        row.paymentDate &&
        row.channel &&
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
        phone: "",
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
            phone: "",
            pec: "",
            taxCodeSdi: "",
            alias: "",
            internalNotes: "",
        });
        setShowCreate(false);
    }

    return (
        <div className="supplier-picker supplier-picker-wide" ref={containerRef}>
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
                        className="inline-link-button"
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
            {showCreate && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <div className="modal-title">
                            <h3>➕ Nuovo esercente/fornitore</h3>
                            <button type="button" onClick={() => setShowCreate(false)}>
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
                                Telefono
                                <input
                                    value={createData.phone}
                                    onChange={(e) =>
                                        setCreateData((d) => ({...d, phone: e.target.value}))
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
                                Codice SDI/Codice Fiscale
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
                                className="secondary-button"
                                onClick={() => setShowCreate(false)}
                            >
                                ✕ Annulla
                            </button>
                            <button
                                type="button"
                                disabled={isSaving}
                                onClick={createSupplier}
                            >
                                ✓ Salva e seleziona
                            </button>
                        </div>
                    </div>
                </div>
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
            className="span-2 product-suggestion-picker"
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
                            onClick={() => selectSuggestion(value)}
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
    suppliers = [],
    initialExpense,
    action = "/api/expenses",
    title = "Nuova spesa",
    submitLabel = "Salva spesa",
    onCancel,
    cancelHref,
    onSwitchToRecurring,
}: Props) {
    const cashBankId = banks.find((bank) => bank.name.toLowerCase() === cashBankName.toLowerCase())?.id;
    const cashBankIdValue = cashBankId ? String(cashBankId) : "";
    const normalizePaymentRow = (row: PaymentRow): PaymentRow =>
        isCashChannel(row.channel) && cashBankIdValue ? {...row, bankId: cashBankIdValue} : row;
    const [amount, setAmount] = useState(normalizeMoney(initialExpense?.amount));
    const [hasElectronicInvoice, setHasElectronicInvoice] = useState(
        initialExpense?.hasElectronicInvoice ?? true,
    );
    const [isDeclared, setIsDeclared] = useState(
        initialExpense?.isDeclared ?? true,
    );
    const [payments, setPayments] = useState<PaymentRow[]>(
        initialExpense?.payments?.length
            ? initialExpense.payments.map(paymentRowFromInitial).map(normalizePaymentRow)
            : [],
    );
    const [openPaymentKey, setOpenPaymentKey] = useState<number | null>(null);
    const openPaymentRef = useRef<HTMLDivElement | null>(null);
    const [attachmentError, setAttachmentError] = useState("");
    const initialOrderDate = toDateInput(initialExpense?.receivedDate) || today;
    const [orderDate, setOrderDate] = useState(initialOrderDate);
    const [dueDate, setDueDate] = useState(
        initialExpense ? toDateInput(initialExpense.dueDate) : addDaysToDateInput(initialOrderDate, 7),
    );
    const [invoiceStatus, setInvoiceStatus] = useState(
        initialExpense?.invoiceStatus ?? "IN_ATTESA",
    );
    const [isRecurring, setIsRecurring] = useState(
        initialExpense?.isRecurring ?? false,
    );
    const canEditRecurringFlag = !initialExpense || initialExpense.isRecurring;

    const amountValue = Number(amount || 0);
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
    const initialBillingPeriod =
        initialExpense?.year && initialExpense?.month
            ? `${initialExpense.year}-${String(initialExpense.month).padStart(2, "0")}`
            : currentBillingPeriod;

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
            return;
        }
        if (invoiceStatus === "NON_PREVISTA") {
            setInvoiceStatus("IN_ATTESA");
        }
    }, [isDeclared, invoiceStatus]);

    useEffect(() => {
        if (!hasElectronicInvoice && !isDeclared) {
            setInvoiceStatus("NON_PREVISTA");
            return;
        }
        if (invoiceStatus === "NON_PREVISTA" && isDeclared) {
            setInvoiceStatus("IN_ATTESA");
        }
    }, [hasElectronicInvoice, isDeclared, invoiceStatus]);

    function handleAmountChange(value: string) {
        setAmount(value);
    }

    function updatePayment(index: number, patch: Partial<PaymentRow>) {
        setPayments((rows) =>
            rows.map((row, i) => {
                if (i !== index) return row;
                const next = {...row, ...patch};
                if ("channel" in patch && isCashChannel(next.channel) && cashBankIdValue) {
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
        const nextResidual = Math.max(0, Number(amount || 0) - currentPaidAmount);
        const suggestedAmount = nextResidual > 0 ? nextResidual.toFixed(2) : "";
        setPayments((rows) => [
            ...rows,
            {
                ...emptyPaymentRow(key),
                amount: suggestedAmount,
                amountTouched: Boolean(suggestedAmount),
            },
        ]);
        setOpenPaymentKey(key);
    }

    function removePaymentRow(index: number) {
        const payment = payments[index];
        if (payment?.id && !window.confirm("Eliminare questo pagamento?")) return;
        setPayments((rows) => rows.filter((_, i) => i !== index));
        if (payment?.key === openPaymentKey) setOpenPaymentKey(null);
    }

    function renderPaymentHiddenInputs(payment: PaymentRow) {
        const cashBankLocked = isCashChannel(payment.channel) && cashBankIdValue;
        return (
            <>
                <input type="hidden" name="paymentId[]" value={payment.id ?? ""}/>
                <input type="hidden" name="paymentDate[]" value={payment.paymentDate}/>
                <input type="hidden" name="paymentChannel[]" value={payment.channel}/>
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
            payment.channel || "Canale non impostato",
            bankName,
            formatEuro(Number(payment.amount || 0)),
            payment.paidBy === "ALTRO_OPERATORE" ? "Altro Operatore" : "Herbal Market",
        ].join(" · ");
    }

    return (
        <form
            className="card form expense-form"
            action={action}
            method="post"
            encType="multipart/form-data"
        >
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

            <details className="form-section full" open>
                <summary>
                    <span>Documento</span>
                    <small>Dati principali della spesa</small>
                </summary>
                <div className="form-section-grid">

                    <div className="toggle-field switch-toggle-field expense-type-switch-in-form full">
                        <span>Tipo spesa: {isRecurring ? "Ricorrente" : "Singola"}</span>
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
                                    if (checked && onSwitchToRecurring && !initialExpense) {
                                        onSwitchToRecurring?.();
                                    }
                                }}
                            />
                            <span className="slider"/>
                            <span>Ricorrente</span>
                        </label>
                    </div>

                    <label>
                        Data ordine
                        <input
                            type="date"
                            name="receivedDate"
                            value={orderDate}
                            onChange={(event) => {
                                const nextOrderDate = event.currentTarget.value;
                                setOrderDate(nextOrderDate);
                                setDueDate(addDaysToDateInput(nextOrderDate, 7));
                            }}
                            required
                        />
                    </label>
                    <label>
                        Data scadenza
                        <input
                            type="date"
                            name="dueDate"
                            value={dueDate}
                            onChange={(event) => setDueDate(event.currentTarget.value)}
                        />
                    </label>
                    <label>
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
                    </label>
                    <SupplierAutocomplete
                        suppliers={suppliers}
                        initialSupplierId={initialExpense?.supplierId ?? null}
                        initialMerchant={initialExpense?.merchant ?? ""}
                    />
                    <ProductServiceAutocomplete
                        initialValue={initialExpense?.description ?? ""}
                    />
                    <div className="amount-vat-row full">
                        <label>
                            Costo IVA inclusa
                            <MoneyInput
                                name="amount"
                                required
                                value={amount}
                                onChange={(e) => handleAmountChange(e.currentTarget.value)}
                            />
                        </label>
                        <label>
                            IVA
                            <select
                                name="vatRate"
                                defaultValue={normalizeMoney(initialExpense?.vatRate) || "22"}
                            >
                                <option value="0">0%</option>
                                <option value="4">4%</option>
                                <option value="10">10%</option>
                                <option value="22">22%</option>
                            </select>
                        </label>
                    </div>
                    <input type="hidden" name="paymentStatus" value={computedPaymentStatus}/>
                </div>
            </details>

            <details className="form-section full" open>
                <summary>
                    <span>Fiscale</span>
                    <small>IVA, detrazione e fattura elettronica</small>
                </summary>
                <div className="form-section-grid">
                    <div className="toggle-field-wrap">
                        <div className="toggle-field switch-toggle-field">
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
                                        } else if (invoiceStatus === "NON_PREVISTA") {
                                            setInvoiceStatus("IN_ATTESA");
                                        }
                                    }}
                                />
                                <span className="slider"/>
                                <span>{isDeclared ? "Si" : "No"}</span>
                            </label>
                        </div>

                        <div className="toggle-field switch-toggle-field">
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
                    <label>
                        Periodo Contabile
                        <input
                            type="month"
                            name="billingPeriod"
                            defaultValue={initialBillingPeriod}
                            required
                        />
                    </label>
                    <label>
                        🧾 Stato Fattura
                        <select
                            name="invoiceStatus"
                            value={invoiceStatus}
                            disabled={invoiceNotExpected}
                            onChange={(e) => setInvoiceStatus(e.currentTarget.value)}
                        >
                            {invoiceStatuses.map(([value, label]) => (
                                <option key={value} value={value} disabled={value === "NON_PREVISTA" && isDeclared}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        {invoiceNotExpected && <input type="hidden" name="invoiceStatus" value="NON_PREVISTA"/>}
                    </label>
                </div>
            </details>

            <details className="form-section full" open>
                <summary>
                    <span>Pagamenti</span>
                    <small>Stato, residuo e movimenti registrati</small>
                </summary>
                <div className="form-section-stack">

                    <div className="field-note payment-note payment-status-note full">
                        <div>
                            <span className="muted">Stato &nbsp;</span>
                            <strong className={computedPaymentStatusInfo.className}>
                                {computedPaymentStatusInfo.icon} {computedPaymentStatusInfo.label}
                            </strong>
                        </div>
                        <div>
                            <span className="muted">Residuo &nbsp;</span>
                            <strong className={residual > 0 ? "text-critical" : "text-ok"}>
                                {formatEuro(residual)}
                            </strong>
                        </div>
                    </div>

                    <section className="payments-box full">
                        <div className="section-title">
                            <div>
                                {/*<h3>Pagamenti</h3>*/}
                                <p>Puoi registrare uno o più pagamenti per la stessa spesa.</p>
                            </div>
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
                                className="secondary-button"
                                onClick={addPaymentRow}
                                disabled={!canAddPayment}
                            >
                                ➕ Aggiungi pagamento
                            </button>
                        </div>
                        {payments.map((payment, index) => {
                            const isOpen = openPaymentKey === payment.key || !payment.id;
                            const cashBankLocked = isCashChannel(payment.channel) && cashBankIdValue;

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
                                                className="secondary-button"
                                                onClick={() => setOpenPaymentKey(payment.key)}
                                            >
                                                ✎ Modifica
                                            </button>
                                            <button
                                                type="button"
                                                className="remove-row"
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
                                            name="paymentChannel[]"
                                            value={payment.channel}
                                            onChange={(e) =>
                                                updatePayment(index, {channel: e.target.value})
                                            }
                                        >
                                            <option>Addebito</option>
                                            <option>Bonifico</option>
                                            <option>RID Bancario</option>
                                            <option>Modello F24</option>
                                            <option>Carta di Debito</option>
                                            <option>PayPal</option>
                                            <option>Mooney</option>
                                            <option>Cash</option>
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
                                                    {bankIcons[b.name] ?? "🏦"} {b.name}
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
                                            className="remove-row"
                                            onClick={() => removePaymentRow(index)}
                                        >
                                            🗑️ Rimuovi
                                        </button>
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            onClick={() => payment.id ? setOpenPaymentKey(null) : removePaymentRow(index)}
                                        >
                                            × Annulla
                                        </button>
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

            <details className="form-section full">
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

            <div className="actions-row full form-actions-row form-sticky-actions">
                <button className="button-standard" type="submit"><span className="btn-icon">✓</span> {submitLabel}
                </button>
                {onCancel ? (
                    <button className="secondary-button button-standard" type="button" onClick={onCancel}><span
                        className="btn-icon">×</span> Annulla</button>
                ) : (
                    <a className="secondary-button button-standard" href={cancelHref ?? "/expenses"}><span
                        className="btn-icon">×</span> Annulla</a>
                )}
            </div>
        </form>
    );
}
