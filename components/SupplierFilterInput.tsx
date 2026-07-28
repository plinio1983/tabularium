'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

type SupplierOption = {
  id: number;
  businessName: string;
  alias?: string | null;
};

export default function SupplierFilterInput({ initialValue = '' }: { initialValue?: string }) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<SupplierOption[]>([]);
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

  return <label className="supplier-filter-label">Esercente
    <div className="supplier-picker filter-supplier-picker" ref={containerRef}>
      <input
        name="merchant"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Cerca fornitore o alias"
        autoComplete="off"
      />
      {open && <div className="supplier-results filter-supplier-results" role="listbox">
        {results.length ? results.map((supplier, index) => <button
          type="button"
          key={supplier.id}
          className={index === activeIndex ? 'active' : ''}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseDown={(event) => {
            event.preventDefault();
            selectSupplier(supplier);
          }}
        >
          <strong>{supplier.businessName}</strong>
          {supplier.alias && <small>Referente: {supplier.alias}</small>}
        </button>) : <div className="empty-supplier-result">Nessun fornitore trovato.</div>}
      </div>}
    </div>
  </label>;
}
