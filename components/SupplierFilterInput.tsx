'use client';

import {matchesEntityQuickSearch} from '@/lib/entity-quick-search';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

type SupplierOption = {
  id: number;
  businessName: string;
  alias?: string | null;
  kind?: 'employee';
  employeeCode?: string | null;
};

export type EmployeeFilterOption = {id: number; firstName: string; lastName: string; employeeCode?: string | null};

export default function SupplierFilterInput({ initialValue = '', employees = [] }: { initialValue?: string; employees?: EmployeeFilterOption[] }) {
  const [query, setQuery] = useState(initialValue);
  const [suppliers, setResults] = useState<SupplierOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(initialValue), [initialValue]);

  useEffect(() => {
    const controller = new AbortController();
    const trimmed = query.trim();
    const params = trimmed ? `?search=${encodeURIComponent(trimmed)}` : '';
    fetch(`/api/suppliers${params}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : [])
      .then((data) => {
        setResults(Array.isArray(data) ? data.slice(0, 8) : []);
        setActiveIndex(0);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const results: SupplierOption[] = [...suppliers, ...employees.filter(employee => matchesEntityQuickSearch(query,
    `${employee.lastName} ${employee.firstName}`, `${employee.firstName} ${employee.lastName}`, employee.employeeCode
  )).slice(0, 8).map(employee => ({
    id: employee.id,
    businessName: `${employee.lastName} ${employee.firstName}`.trim(),
    kind: 'employee' as const,
    employeeCode: employee.employeeCode,
  }))];

  function selectSupplier(supplier: SupplierOption) {
    setQuery(supplier.businessName);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter' && open && results[activeIndex]) {
      event.preventDefault();
      selectSupplier(results[activeIndex]);
    }
    if (event.key === 'Escape') setOpen(false);
  }

  return <div className="supplier-filter-label app-form-field record-filter-field">
    <span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">◎</span>Esercente</span>
    <div className="entity-autocomplete filter-entity-autocomplete" ref={containerRef}>
      <input
        name="merchant"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Cerca fornitore, alias o dipendente"
        autoComplete="off"
      />
      {open && <div className="entity-autocomplete-results filter-entity-autocomplete-results" role="listbox">
        {results.length ? results.map((supplier, index) => <button
          type="button"
          key={`${supplier.kind ?? 'supplier'}-${supplier.id}`}
          className={index === activeIndex ? 'active' : ''}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseDown={(event) => {
            event.preventDefault();
            selectSupplier(supplier);
          }}
        >
          <strong>{supplier.businessName}</strong>
          {supplier.kind === 'employee' && <small>Dipendente{supplier.employeeCode ? ` · ${supplier.employeeCode}` : ''}</small>}
          {supplier.alias && <small>Referente: {supplier.alias}</small>}
        </button>) : <div className="entity-autocomplete-empty">Nessun fornitore o dipendente trovato.</div>}
      </div>}
    </div>
  </div>;
}
