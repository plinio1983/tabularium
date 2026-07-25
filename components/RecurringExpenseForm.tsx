"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { categoryIcon } from "@/lib/expense-ui";

type Option = { id: number; code?: string; name: string; icon?: string | null; isFallback?: boolean | null; kind?: string };
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
  const initial = suppliers.find((supplier) => supplier.id === initialSupplierId) ?? null;
  const [query, setQuery] = useState(initial?.businessName ?? initialMerchant ?? "");
  const [selected, setSelected] = useState<SupplierOption | null>(initial);
  const [results, setResults] = useState<SupplierOption[]>(suppliers.slice(0, 10));
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
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : "";
      const response = await fetch(`/api/suppliers${params}`, { signal: controller.signal }).catch(() => null);
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

  async function createSupplier() {
    if (!createData.businessName.trim()) return;
    setIsSaving(true);
    const response = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createData),
    });
    setIsSaving(false);
    if (!response.ok) return;
    const supplier = await response.json();
    setResults((current) => [supplier, ...current.filter((item) => item.id !== supplier.id)]);
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
    <div className="supplier-picker supplier-picker-wide" ref={containerRef}>
      <input type="hidden" name="supplierId" value={selected?.id ?? ""} />
      <input type="hidden" name="merchant" value={selected?.businessName ?? query} />
      <label>
        Esercente/Fornitore
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
              setCreateData((data) => ({ ...data, businessName: query }));
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
            <div className="empty-supplier-result">Nessun esercente/fornitore trovato.</div>
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
              <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="modal-form-grid">
              <label>Ragione Sociale<input value={createData.businessName} onChange={(e) => setCreateData((d) => ({ ...d, businessName: e.target.value }))} required /></label>
              <label>Email<input value={createData.email} onChange={(e) => setCreateData((d) => ({ ...d, email: e.target.value }))} /></label>
              <label>P.IVA<input value={createData.vatNumber} onChange={(e) => setCreateData((d) => ({ ...d, vatNumber: e.target.value }))} /></label>
              <label>IBAN<input value={createData.iban} onChange={(e) => setCreateData((d) => ({ ...d, iban: e.target.value }))} /></label>
              <label>PEC<input value={createData.pec} onChange={(e) => setCreateData((d) => ({ ...d, pec: e.target.value }))} /></label>
              <label>Codice SDI/Fiscale<input value={createData.taxCodeSdi} onChange={(e) => setCreateData((d) => ({ ...d, taxCodeSdi: e.target.value }))} /></label>
              <label>Alias<input value={createData.alias} onChange={(e) => setCreateData((d) => ({ ...d, alias: e.target.value }))} /></label>
              <label className="full">Note interne<textarea rows={3} value={createData.internalNotes} onChange={(e) => setCreateData((d) => ({ ...d, internalNotes: e.target.value }))} /></label>
            </div>
            <div className="actions-row right-actions">
              <button type="button" className="btn btn-sm btn-default" onClick={() => setShowCreate(false)}>× Annulla</button>
              <button className="btn btn-md btn-primary" type="button" disabled={isSaving} onClick={createSupplier}>✓ Salva e seleziona</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ProductServiceAutocomplete({ initialValue = "" }: { initialValue?: string | null }) {
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
      const response = await fetch(`/api/expense-descriptions${params}`, { signal: controller.signal }).catch(() => null);
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
    <label className="span-2 product-suggestion-picker" ref={containerRef}>
      Prodotto/servizio
      <input
        name="description"
        required
        placeholder="Descrizione libera della spesa ricorrente"
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
    : initialExpense?.bankId?.toString() ?? "";
  const [cadence, setCadence] = useState(initialExpense?.cadence ?? "MONTHLY");
  const [billingPeriodMode, setBillingPeriodMode] = useState(initialExpense?.billingPeriodMode ?? "SAME_MONTH");
  const [isDeclared, setIsDeclared] = useState(initialExpense?.isDeclared ?? true);
  const [hasElectronicInvoice, setHasElectronicInvoice] = useState(initialExpense?.hasElectronicInvoice ?? true);
  const [isAutomaticAccrual, setIsAutomaticAccrual] = useState(Boolean(initialExpense?.isAutomaticPayment));
  const [paymentMethodId, setPaymentMethodId] = useState(initialPaymentMethodId);
  const [bankId, setBankId] = useState(initialBankId);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedPaymentMethodName = paymentMethods.find(method => String(method.id) === paymentMethodId)?.name ?? "";
  const cashBankLocked = isAutomaticAccrual && isCashChannel(selectedPaymentMethodName) && Boolean(cashBankIdValue);
  const isYearly = cadence === "YEARLY" || cadence === "EVERY_2_YEARS";

  useEffect(() => {
    if (!isDeclared) {
      setBillingPeriodMode("SAME_MONTH");
      setHasElectronicInvoice(false);
    }
  }, [isDeclared]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    <form className="card form expense-form recurring-expense-form" action={action} method="post" onSubmit={handleSubmit} data-in-place-submit={onSaved ? "true" : undefined}>
      <details className="form-section full recurring-form-section" open>
        <summary>
          <span>Documento</span>
          <small>Dati principali della spesa ricorrente</small>
        </summary>
        <div className="form-section-grid recurring-form-section-grid">
      <div className="toggle-field switch-toggle-field expense-type-switch-in-form full">
        <span>Tipo spesa: Ricorrente</span>
        <label className="switch">
          <input
            type="checkbox"
            checked
            onChange={(event) => {
              if (!event.currentTarget.checked) onSwitchToSingle?.();
            }}
          />
          <span className="slider" />
          <span>Ricorrente</span>
        </label>
      </div>

      <label>Data inizio<input type="date" name="startDate" defaultValue={toDateInput(initialExpense?.startDate) || today} required /></label>

      <label>Cadenza<select name="cadence" value={cadence} onChange={(e) => setCadence(e.currentTarget.value)} required>
        <option value="MONTHLY">Ogni mese</option>
        <option value="EVERY_2_MONTHS">Ogni 2 mesi</option>
        <option value="EVERY_3_MONTHS">Ogni 3 mesi</option>
        <option value="EVERY_6_MONTHS">Ogni 6 mesi</option>
        <option value="YEARLY">Annuale</option>
        <option value="EVERY_2_YEARS">Ogni 2 anni</option>
      </select></label>

      {isYearly ? (
        <>
          <label>Giorno scadenza<input type="number" name="dueDay" min="1" max="31" defaultValue={initialExpense?.dueDay ?? 1} required /></label>
          <label>Mese scadenza<select name="dueMonth" defaultValue={initialExpense?.dueMonth ?? new Date().getMonth() + 1} required>{monthOptions.map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></label>
        </>
      ) : (
        <label>Giorno del mese scadenza<input type="number" name="dueDay" min="1" max="31" defaultValue={initialExpense?.dueDay ?? 1} required /></label>
      )}

      <label>Categoria<select name="categoryId" required defaultValue={initialExpense?.categoryId ?? ""}><option value="" disabled>Seleziona categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.icon ? `${categoryIcon(c)} ${c.name}` : c.name}</option>)}</select></label>

      <SupplierAutocomplete suppliers={suppliers} initialSupplierId={initialExpense?.supplierId ?? null} initialMerchant={initialExpense?.merchant ?? ""} />

      <ProductServiceAutocomplete initialValue={initialExpense?.description ?? ""} />

      <div className="amount-vat-row">
        <label>Costo IVA inclusa<MoneyInput name="amount" defaultValue={normalizeMoney(initialExpense?.amount)} required /></label>
        <label>IVA<select name="vatRate" defaultValue={normalizeMoney(initialExpense?.vatRate) || "22"}><option value="0">0%</option><option value="4">4%</option><option value="10">10%</option><option value="22">22%</option></select></label>
      </div>
        </div>
      </details>

      <details className="form-section full recurring-form-section" open>
        <summary>
          <span>Fiscale</span>
          <small>Detrazione, fattura elettronica e periodo fatturazione</small>
        </summary>
        <div className="form-section-grid recurring-form-section-grid">
      <div className="toggle-field-wrap full">
        <div className="toggle-field switch-toggle-field">
          <span>Fiscale</span>
          <label className="switch">
            <input
              type="checkbox"
              name="isDeclared"
              value="true"
              checked={isDeclared}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setIsDeclared(checked);
                if (!checked) setHasElectronicInvoice(false);
              }}
            />
            <span className="slider" />
            <span>{isDeclared ? "Si" : "No"}</span>
          </label>
        </div>
        <div className="toggle-field switch-toggle-field">
          <span>Fatt.Elet.</span>
          <label className="switch">
            <input
              type="checkbox"
              name="hasElectronicInvoice"
              value="true"
              checked={hasElectronicInvoice}
              disabled={!isDeclared}
              onChange={(e) => setHasElectronicInvoice(e.currentTarget.checked)}
            />
            <span className="slider" />
            <span>{hasElectronicInvoice ? "Si" : "No"}</span>
          </label>
        </div>
      </div>

      <label>Periodo Fatturazione<select name="billingPeriodMode" value={billingPeriodMode} disabled={!isDeclared} onChange={(e) => setBillingPeriodMode(e.currentTarget.value)}><option value="SAME_MONTH">Stesso mese</option><option value="NEXT_MONTH">Mese successivo</option><option value="CUSTOM_MONTH">Imposta mese</option></select></label>
      {!isDeclared && <input type="hidden" name="billingPeriodMode" value="SAME_MONTH" />}
      {billingPeriodMode === "CUSTOM_MONTH" && isDeclared ? <label>Mese contabile<select name="billingMonth" defaultValue={initialExpense?.billingMonth ?? new Date().getMonth() + 1}>{monthOptions.map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></label> : null}
        </div>
      </details>

      <details className="form-section full recurring-form-section" open>
        <summary>
          <span>Pagamento</span>
          <small>Automazione, canale e banca</small>
        </summary>
        <div className="form-section-grid recurring-form-section-grid">
      <div className="toggle-field switch-toggle-field full recurring-accrual-toggle">
        <span>Tipo pagamento: {isAutomaticAccrual ? "Automatico" : "Manuale"}</span>
        <input type="hidden" name="isAutomaticPayment" value={isAutomaticAccrual ? "true" : "false"} />
        <label className="switch">
          <input
            type="checkbox"
            checked={isAutomaticAccrual}
            onChange={(event) => setIsAutomaticAccrual(event.currentTarget.checked)}
          />
          <span className="slider" />
          <span>{isAutomaticAccrual ? "Automatico" : "Manuale"}</span>
        </label>
      </div>

      <label>Canale di pagamento<select
        name="paymentMethodId"
        value={paymentMethodId}
        disabled={!isAutomaticAccrual}
        required={isAutomaticAccrual}
        onChange={(event) => {
          const nextPaymentMethodId = event.currentTarget.value;
          const nextPaymentMethodName = paymentMethods.find(method => String(method.id) === nextPaymentMethodId)?.name ?? "";
          setPaymentMethodId(nextPaymentMethodId);
          if (isCashChannel(nextPaymentMethodName) && cashBankIdValue) setBankId(cashBankIdValue);
        }}
      ><option value="">Seleziona canale</option>{paymentMethods.map(c => <option key={c.id} value={c.id}>{c.icon ?? '  •  '} {c.name}</option>)}</select></label>
      <label>Banca
        {cashBankLocked ? <input type="hidden" name="bankId" value={cashBankIdValue} /> : null}
        <select
          name={cashBankLocked ? undefined : "bankId"}
          value={cashBankLocked ? cashBankIdValue : bankId}
          disabled={!isAutomaticAccrual || cashBankLocked}
          required={isAutomaticAccrual && !cashBankLocked}
          onChange={(event) => setBankId(event.currentTarget.value)}
        ><option value="">Seleziona banca</option>{banks.map(b => <option key={b.id} value={b.id}>{b.icon ?? '  •  '} {b.name}</option>)}</select>
      </label>
        </div>
      </details>

      <details className="form-section full recurring-form-section">
        <summary>
          <span>Note</span>
          <small>Note interne opzionali</small>
        </summary>
        <div className="form-section-stack">
      <label className="full">Note<textarea name="notes" rows={3} defaultValue={initialExpense?.notes ?? ""} /></label>
        </div>
      </details>

      <div className="actions-row full form-actions-row form-sticky-actions">
        {submitError ? <p className="inline-warning full">{submitError}</p> : null}
        <button className="btn btn-md btn-primary" type="submit" disabled={isSubmitting}><span className="btn-icon">✓</span> {isSubmitting ? "Salvataggio..." : "Salva spesa"}</button>
        {onCancel ? (
          <button type="button" className="btn btn-md btn-default" onClick={onCancel}><span className="btn-icon">×</span> Annulla</button>
        ) : cancelHref ? (
          <a className="btn btn-md btn-default" href={cancelHref}><span className="btn-icon">×</span> Annulla</a>
        ) : null}
      </div>
    </form>
  );
}
