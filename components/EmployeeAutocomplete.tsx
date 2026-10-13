'use client';

import {useEffect, useId, useMemo, useRef, useState} from 'react';

type Employee = {id: number; firstName: string; lastName: string; employeeCode?: string | null; status: 'ACTIVE' | 'INACTIVE'};
const employeeName = (employee: Employee) => `${employee.lastName} ${employee.firstName}`;

export default function EmployeeAutocomplete({employees, value, onChange, className = ''}: {
  employees: Employee[]; value: string; onChange: (value: string) => void; className?: string;
}) {
  const selected = employees.find(employee => String(employee.id) === value);
  const [query, setQuery] = useState(selected ? employeeName(selected) : '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const matches = useMemo(() => {
    const words = query.trim().toLocaleLowerCase('it').split(/\s+/).filter(Boolean);
    return employees.filter(employee => (employee.status === 'ACTIVE' || String(employee.id) === value)
      && words.every(word => `${employeeName(employee)} ${employee.employeeCode ?? ''}`.toLocaleLowerCase('it').includes(word))).slice(0, 12);
  }, [employees, query, value]);

  useEffect(() => {if (selected) setQuery(employeeName(selected));}, [selected]);
  useEffect(() => {inputRef.current?.setCustomValidity(value ? '' : 'Seleziona un dipendente dai suggerimenti.');}, [value, query]);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(employee: Employee) {
    onChange(String(employee.id));
    setQuery(employeeName(employee));
    inputRef.current?.setCustomValidity('');
    setOpen(false);
  }

  return <div className={`entity-autocomplete entity-autocomplete-wide full ${className}`} ref={containerRef}>
    <input type="hidden" name="employeeId" value={value}/>
    <label>
      <span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">♙</span><span>Dipendente</span></span>
      <div className="entity-autocomplete-input-row">
        <input ref={inputRef} value={query} required autoComplete="off" placeholder="Cerca per nome, cognome o codice"
          role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
          aria-activedescendant={open && matches[activeIndex] ? `${listId}-${matches[activeIndex].id}` : undefined}
          onFocus={() => setOpen(true)} onChange={event => {
            setQuery(event.currentTarget.value); onChange(''); setActiveIndex(0); setOpen(true);
            event.currentTarget.setCustomValidity('Seleziona un dipendente dai suggerimenti.');
          }} onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setOpen(true);
              setActiveIndex(index => !open ? 0 : Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
            }
            if (event.key === 'Enter' && open) {event.preventDefault(); if (matches[activeIndex]) select(matches[activeIndex]);}
            if (event.key === 'Escape' && open) {event.preventDefault(); event.stopPropagation(); setOpen(false);}
          }}/>
      </div>
    </label>
    {open && <div className="entity-autocomplete-results" role="listbox" id={listId} aria-label="Dipendenti">
      {matches.map((employee, index) => <button type="button" role="option" id={`${listId}-${employee.id}`} key={employee.id}
        aria-selected={value === String(employee.id)} className={index === activeIndex ? 'active' : ''}
        onMouseEnter={() => setActiveIndex(index)} onMouseDown={event => {event.preventDefault(); select(employee);}}>
        <strong>{employeeName(employee)}</strong>
        {employee.employeeCode || employee.status === 'INACTIVE' ? <small>{[employee.employeeCode, employee.status === 'INACTIVE' ? 'Inattivo' : ''].filter(Boolean).join(' · ')}</small> : null}
      </button>)}
      {!matches.length && <div className="entity-autocomplete-empty">Nessun dipendente trovato.</div>}
    </div>}
  </div>;
}
