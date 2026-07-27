'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Customer = {
  id: number;
  businessName: string;
  alias?: string | null;
  systemRole?: string | null;
};

const emptyCustomer = {
  businessName: '',
  alias: '',
  email: '',
  vatNumber: '',
  taxCodeSdi: '',
  pec: '',
  iban: '',
  swift: '',
  internalNotes: ''
};

export default function CustomerAutocomplete({ customers, initialCustomerId, onValueChange }: { customers: Customer[]; initialCustomerId?: number | null; onValueChange?: (value: string) => void }) {
  const fallback = customers.find(customer => customer.id === initialCustomerId);
  const [selected, setSelected] = useState<Customer | undefined>(fallback);
  const [query, setQuery] = useState(fallback?.businessName ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createData, setCreateData] = useState(emptyCustomer);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('it');
    return customers
      .filter(customer => !needle || customer.businessName.toLocaleLowerCase('it').includes(needle) || customer.alias?.toLocaleLowerCase('it').includes(needle))
      .slice(0, 12);
  }, [customers, query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => setActiveIndex(0), [query]);

  function selectCustomer(customer: Customer) {
    setSelected(customer);
    setQuery(customer.businessName);
    onValueChange?.(customer.businessName);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) setOpen(true);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, matches.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter' && open && matches[activeIndex]) {
      event.preventDefault();
      selectCustomer(matches[activeIndex]);
    }
    if (event.key === 'Escape') setOpen(false);
  }

  async function createCustomer() {
    if (!createData.businessName.trim()) return;
    setIsSaving(true);
    setCreateError('');
    const response = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createData)
    }).catch(() => null);
    setIsSaving(false);
    if (!response?.ok) {
      setCreateError('Impossibile salvare il cliente. Controlla i dati inseriti.');
      return;
    }
    const customer = await response.json() as Customer;
    selectCustomer(customer);
    setCreateData(emptyCustomer);
    setShowCreate(false);
  }

  function updateCreateData(field: keyof typeof emptyCustomer, value: string) {
    setCreateData(data => ({ ...data, [field]: value }));
  }

  return <div className="supplier-picker supplier-picker-wide full expense-wizard-step expense-wizard-step-3" ref={containerRef}>
    <input type="hidden" name="customerId" value={selected?.id ?? ''} />
    <label className="income-customer-field">
      <span className="app-form-field-label">
        <span className="app-form-field-icon" aria-hidden="true">◎</span>
        <span>Cliente</span>
      </span>
      <div className="supplier-input-row">
        <input
          value={query}
          required
          autoComplete="off"
          placeholder="Cerca per ragione sociale o alias"
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onChange={event => {
            setQuery(event.currentTarget.value);
            setSelected(undefined);
            onValueChange?.(event.currentTarget.value);
            setOpen(true);
          }}
        />
        <button
          type="button"
          className="btn btn-sm btn-link inline-link-button"
          onClick={() => {
            setCreateData({ ...emptyCustomer });
            setCreateError('');
            setShowCreate(true);
            setOpen(false);
          }}
        >
          ＋ Nuovo
        </button>
      </div>
    </label>

    {open ? <div className="supplier-results" role="listbox">
      {matches.map((customer, index) => <button
        type="button"
        role="option"
        aria-selected={selected?.id === customer.id}
        key={customer.id}
        className={index === activeIndex ? 'active' : ''}
        onMouseEnter={() => setActiveIndex(index)}
        onMouseDown={event => {
          event.preventDefault();
          selectCustomer(customer);
        }}
      >
        <strong>{customer.businessName}</strong>
        {customer.alias ? <small>Alias: {customer.alias}</small> : null}
      </button>)}
      {!matches.length ? <div className="empty-supplier-result">Nessun cliente trovato.</div> : null}
    </div> : null}

    {showCreate && createPortal(
      <div
        className="modal-backdrop nested-form-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Nuovo cliente"
        onMouseDown={event => {
          event.stopPropagation();
          if (event.target === event.currentTarget) setShowCreate(false);
        }}
      >
        <div className="modal-card" onMouseDown={event => event.stopPropagation()}>
          <div className="modal-title">
            <h3>➕ Nuovo cliente</h3>
            <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setShowCreate(false)}>✕</button>
          </div>
          <div className="modal-form-grid">
            <label>Nome / Ragione sociale<input value={createData.businessName} onChange={event => updateCreateData('businessName', event.target.value)} required autoFocus /></label>
            <label>Alias<input value={createData.alias} onChange={event => updateCreateData('alias', event.target.value)} /></label>
            <label>Email<input type="email" value={createData.email} onChange={event => updateCreateData('email', event.target.value)} /></label>
            <label>P.IVA<input value={createData.vatNumber} onChange={event => updateCreateData('vatNumber', event.target.value)} /></label>
            <label>SDI / Codice fiscale<input value={createData.taxCodeSdi} onChange={event => updateCreateData('taxCodeSdi', event.target.value)} /></label>
            <label>PEC<input type="email" value={createData.pec} onChange={event => updateCreateData('pec', event.target.value)} /></label>
            <label>IBAN<input value={createData.iban} onChange={event => updateCreateData('iban', event.target.value)} /></label>
            <label>Swift<input value={createData.swift} onChange={event => updateCreateData('swift', event.target.value)} /></label>
            <label className="full">Note<textarea rows={3} value={createData.internalNotes} onChange={event => updateCreateData('internalNotes', event.target.value)} /></label>
          </div>
          {createError ? <p className="form-error" role="alert">{createError}</p> : null}
          <div className="modal-actions">
            <button className="btn btn-md btn-default" type="button" onClick={() => setShowCreate(false)}>Annulla</button>
            <button className="btn btn-md btn-primary" type="button" disabled={isSaving || !createData.businessName.trim()} onClick={createCustomer}>
              {isSaving ? 'Salvataggio…' : 'Salva cliente'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </div>;
}
