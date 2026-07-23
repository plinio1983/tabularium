'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import MobileEntityPicker, { isMobileEntityPickerViewport } from '@/components/MobileEntityPicker';

type Customer = { id: number; businessName: string; alias?: string | null; systemRole?: string | null };

export default function CustomerAutocomplete({ customers, initialCustomerId }: { customers: Customer[]; initialCustomerId?: number | null }) {
  const fallback = customers.find(customer => customer.id === initialCustomerId) ?? customers.find(customer => customer.systemRole === 'DEFAULT') ?? customers[0];
  const [selected, setSelected] = useState<Customer | undefined>(fallback);
  const [query, setQuery] = useState(fallback?.businessName ?? '');
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCustomer, setPendingCustomer] = useState<Customer | undefined>(fallback);
  const initialMobileValue = useRef<{ query: string; selected?: Customer }>({ query, selected });
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('it');
    return customers.filter(customer => !needle || customer.businessName.toLocaleLowerCase('it').includes(needle) || customer.alias?.toLocaleLowerCase('it').includes(needle)).slice(0, 12);
  }, [customers, query]);

  const cancelMobilePicker = useCallback(() => {
    setQuery(initialMobileValue.current.query);
    setSelected(initialMobileValue.current.selected);
    setPendingCustomer(initialMobileValue.current.selected);
    setMobileOpen(false);
  }, []);

  function openPicker() {
    if (isMobileEntityPickerViewport()) {
      initialMobileValue.current = { query, selected };
      setPendingCustomer(selected);
      setOpen(false);
      setMobileOpen(true);
      return;
    }
    setOpen(true);
  }

  function chooseCustomer(customer: Customer) {
    setPendingCustomer(customer);
    setQuery(customer.businessName);
  }

  return <div className="supplier-autocomplete">
    <input type="hidden" name="customerId" value={selected?.id ?? ''} />
    <input value={query} required autoComplete="off" placeholder="Cerca cliente…" onFocus={openPicker} onBlur={() => window.setTimeout(() => setOpen(false), 150)} onChange={event => { setQuery(event.currentTarget.value); setSelected(undefined); setOpen(true); }} />
    {open ? <div className="supplier-suggestions" role="listbox">
      {matches.map(customer => <button type="button" role="option" key={customer.id} onMouseDown={event => event.preventDefault()} onClick={() => { setSelected(customer); setQuery(customer.businessName); setOpen(false); }}>
        <strong>{customer.businessName}</strong>{customer.alias ? <span>{customer.alias}</span> : null}
      </button>)}
      {!matches.length ? <div className="supplier-suggestion-empty">Nessun cliente trovato.</div> : null}
    </div> : null}
    {mobileOpen ? <MobileEntityPicker
      title="Seleziona cliente"
      query={query}
      placeholder="Cerca per ragione sociale o alias"
      canConfirm={Boolean(pendingCustomer)}
      onQueryChange={value => {
        setQuery(value);
        setPendingCustomer(undefined);
      }}
      onCancel={cancelMobilePicker}
      onConfirm={() => {
        if (!pendingCustomer) return;
        setSelected(pendingCustomer);
        setQuery(pendingCustomer.businessName);
        setMobileOpen(false);
      }}
    >
      {matches.map(customer => <button
        type="button"
        role="option"
        aria-selected={pendingCustomer?.id === customer.id}
        className={pendingCustomer?.id === customer.id ? 'is-selected' : undefined}
        key={customer.id}
        onClick={() => chooseCustomer(customer)}
      >
        <strong>{customer.businessName}</strong>
        {customer.alias ? <span>Alias: {customer.alias}</span> : null}
      </button>)}
      {!matches.length ? <div className="mobile-entity-picker-empty">Nessun cliente trovato.</div> : null}
    </MobileEntityPicker> : null}
  </div>;
}
