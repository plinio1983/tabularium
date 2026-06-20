"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categoryIcon } from "@/lib/expense-ui";

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
type InitialRecurringExpense = {
  startDate?: string | Date | null;
  cadence?: string | null;
  dueDay?: number | null;
  dueMonth?: number | null;
  accrualType?: string | null;
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
  paymentChannel?: string | null;
  bankId?: number | null;
  notes?: string | null;
};

type Props = {
  categories: Option[];
  banks: Option[];
  suppliers?: SupplierOption[];
  action?: string;
  initialExpense?: InitialRecurringExpense;
  onCancel?: () => void;
  cancelHref?: string;
  onSwitchToSingle?: () => void;
};

const today = new Date().toISOString().slice(0, 10);
const paymentChannels = ["Addebito", "Bonifico", "RID", "F24", "Carta", "PayPal", "Mooney", "Cash"];
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
      phone: "",
      pec: "",
      taxCodeSdi: "",
      alias: "",
      internalNotes: "",
    });
    setShowCreate(false);
  }

  return (
    <div className="supplier-picker supplier-picker-wide span-2" ref={containerRef}>
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
            className="inline-link-button"
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

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-title">
              <h3>➕ Nuovo esercente/fornitore</h3>
              <button type="button" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="modal-form-grid">
              <label>Ragione Sociale<input value={createData.businessName} onChange={(e) => setCreateData((d) => ({ ...d, businessName: e.target.value }))} required /></label>
              <label>Email<input value={createData.email} onChange={(e) => setCreateData((d) => ({ ...d, email: e.target.value }))} /></label>
              <label>Telefono<input value={createData.phone} onChange={(e) => setCreateData((d) => ({ ...d, phone: e.target.value }))} /></label>
              <label>PEC<input value={createData.pec} onChange={(e) => setCreateData((d) => ({ ...d, pec: e.target.value }))} /></label>
              <label>Codice SDI/Codice Fiscale<input value={createData.taxCodeSdi} onChange={(e) => setCreateData((d) => ({ ...d, taxCodeSdi: e.target.value }))} /></label>
              <label>Alias<input value={createData.alias} onChange={(e) => setCreateData((d) => ({ ...d, alias: e.target.value }))} /></label>
              <label className="full">Note interne<textarea rows={3} value={createData.internalNotes} onChange={(e) => setCreateData((d) => ({ ...d, internalNotes: e.target.value }))} /></label>
            </div>
            <div className="actions-row right-actions">
              <button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Annulla</button>
              <button type="button" disabled={isSaving} onClick={createSupplier}>✓ Salva e seleziona</button>
            </div>
          </div>
        </div>
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

export default function RecurringExpenseForm({
  categories,
  banks,
  suppliers = [],
  action = "/api/recurring-expenses",
  initialExpense,
  onCancel,
  cancelHref,
  onSwitchToSingle,
}: Props) {
  const [cadence, setCadence] = useState(initialExpense?.cadence ?? "MONTHLY");
  const [billingPeriodMode, setBillingPeriodMode] = useState(initialExpense?.billingPeriodMode ?? "SAME_MONTH");
  const [isDeclared, setIsDeclared] = useState(initialExpense?.isDeclared ?? true);
  const [hasElectronicInvoice, setHasElectronicInvoice] = useState(initialExpense?.hasElectronicInvoice ?? true);
  const [isAutomaticAccrual, setIsAutomaticAccrual] = useState(initialExpense?.accrualType === "AUTOMATICO");
  const isYearly = cadence === "YEARLY" || cadence === "EVERY_2_YEARS";

  useEffect(() => {
    if (!isDeclared) {
      setBillingPeriodMode("SAME_MONTH");
      setHasElectronicInvoice(false);
    }
  }, [isDeclared]);

  return (
    <form className="card form expense-form recurring-expense-form" action={action} method="post">
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
        <input type="hidden" name="accrualType" value={isAutomaticAccrual ? "AUTOMATICO" : "MANUALE"} />
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

      <label>Canale di pagamento<select name="paymentChannel" defaultValue={initialExpense?.paymentChannel ?? ""} disabled={!isAutomaticAccrual} required={isAutomaticAccrual}><option value="">Seleziona canale</option>{paymentChannels.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
      <label>Banca<select name="bankId" defaultValue={initialExpense?.bankId ?? ""} disabled={!isAutomaticAccrual} required={isAutomaticAccrual}><option value="">Seleziona banca</option>{banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
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
        <button className="button-standard" type="submit"><span className="btn-icon">✓</span> Salva spesa</button>
        {onCancel ? (
          <button type="button" className="secondary-button button-standard" onClick={onCancel}><span className="btn-icon">×</span> Annulla</button>
        ) : cancelHref ? (
          <a className="secondary-button button-standard" href={cancelHref}><span className="btn-icon">×</span> Annulla</a>
        ) : null}
      </div>
    </form>
  );
}
