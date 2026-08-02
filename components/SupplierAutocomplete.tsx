"use client";

import {useEffect, useId, useRef, useState} from "react";
import SupplierCreateModal from "@/components/SupplierCreateModal";

export type SupplierAutocompleteOption = {
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

type CategoryOption = {id: number; name: string; icon?: string | null};

export default function SupplierAutocomplete({
  suppliers = [], initialSupplierId, initialMerchant, onSupplierSelected,
  onSupplierValueChange, categories = [], allowCreate = true, className = "",
  wizardStep = true,
}: {
  suppliers?: SupplierAutocompleteOption[];
  initialSupplierId?: number | null;
  initialMerchant?: string | null;
  onSupplierSelected?: (supplier: SupplierAutocompleteOption | null) => void;
  onSupplierValueChange?: (value: string) => void;
  categories?: CategoryOption[];
  allowCreate?: boolean;
  className?: string;
  wizardStep?: boolean;
}) {
  const generatedId = useId();
  const inputId = `expense-supplier-${generatedId.replaceAll(":", "")}`;
  const initial = suppliers.find(supplier => supplier.id === initialSupplierId) ?? null;
  const [query, setQuery] = useState(initial?.businessName ?? initialMerchant ?? "");
  const [selected, setSelected] = useState<SupplierAutocompleteOption | null>(initial);
  const [results, setResults] = useState<SupplierAutocompleteOption[]>(suppliers.slice(0, 10));
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
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  function selectSupplier(supplier: SupplierAutocompleteOption) {
    setSelected(supplier);
    setQuery(supplier.businessName);
    setIsOpen(false);
    onSupplierValueChange?.(supplier.businessName);
    onSupplierSelected?.(supplier);
  }

  function clearSupplier() {
    setQuery("");
    setSelected(null);
    setResults(suppliers.slice(0, 10));
    setIsOpen(true);
    onSupplierValueChange?.("");
    onSupplierSelected?.(null);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) setIsOpen(true);
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex(index => Math.min(index + 1, results.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex(index => Math.max(index - 1, 0)); }
    if (event.key === "Enter" && isOpen && results[activeIndex]) { event.preventDefault(); selectSupplier(results[activeIndex]); }
    if (event.key === "Escape") setIsOpen(false);
  }

  return <div className={`entity-autocomplete entity-autocomplete-wide ${wizardStep ? "app-form-wizard-step app-form-wizard-step-3" : ""} ${className}`.trim()} ref={containerRef}>
    <input type="hidden" name="supplierId" value={selected?.id ?? ""}/>
    <input type="hidden" name="merchant" value={selected?.businessName ?? query}/>
    <div className="app-form-field entity-autocomplete-field">
      <label className="app-form-field-label" htmlFor={inputId}>
        <span className="app-form-field-icon" aria-hidden="true">◎</span><span>Esercente</span>
        {allowCreate ? <span className="flex flex-grow justify-end"><button type="button" className="btn btn-sm btn-link inline-link-button mr-22" onClick={() => setShowCreate(true)}>＋ Nuovo</button></span> : null}
      </label>
    </div>
    <div className="entity-autocomplete-input-row"><div className={`app-autocomplete-control ${selected ? "has-selection" : ""}`}>
      <span className="app-autocomplete-search-icon" aria-hidden="true">⌕</span>
      <input id={inputId} value={query} onChange={event => {setQuery(event.target.value); onSupplierValueChange?.(event.target.value); setSelected(null); onSupplierSelected?.(null); setIsOpen(true);}} onFocus={() => setIsOpen(true)} onKeyDown={onKeyDown} placeholder="Cerca per ragione sociale o referente" autoComplete="off" role="combobox" aria-expanded={isOpen} aria-autocomplete="list" required/>
      {query ? <button type="button" className="app-autocomplete-clear" aria-label="Cancella fornitore" onClick={clearSupplier}>×</button> : null}
      {isOpen ? <div className="entity-autocomplete-results" role="listbox">{results.length ? results.map((supplier, index) => <button type="button" key={supplier.id} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? "active" : ""} onMouseEnter={() => setActiveIndex(index)} onMouseDown={event => {event.preventDefault(); selectSupplier(supplier);}}><strong>{supplier.businessName}</strong>{supplier.alias ? <small>Referente: {supplier.alias}</small> : null}</button>) : <div className="entity-autocomplete-empty">Nessun fornitore trovato.</div>}</div> : null}
    </div></div>
    {selected ? <div className="app-autocomplete-selection"><span aria-hidden="true">✓</span><div><strong>{selected.businessName}</strong>{selected.alias ? <small>{selected.alias}</small> : null}</div></div> : null}
    {allowCreate ? <SupplierCreateModal open={showCreate} onClose={() => setShowCreate(false)} categories={categories} initialBusinessName={query} context="nested" onCreated={supplier => {setResults(current => [supplier, ...current.filter(item => item.id !== supplier.id)]); selectSupplier(supplier);}}/> : null}
  </div>;
}
