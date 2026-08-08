'use client';

import { type ReactNode, useId, useRef } from 'react';
import {formatItalianCompactDate} from '@/lib/date-format';

type FormFieldProps = {
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
  className?: string;
  htmlFor?: string;
  children: ReactNode;
};

export function FormField({ label, icon, hint, className = '', htmlFor, children }: FormFieldProps) {
  return <div className={`app-form-field ${className}`.trim()}>
    <label className="app-form-field-label" htmlFor={htmlFor}>
      {icon ? <span className="app-form-field-icon" aria-hidden="true">{icon}</span> : null}
      <span>{label}</span>
    </label>
    {children}
    {hint ? <small className="app-form-field-hint">{hint}</small> : null}
  </div>;
}

export function SupplierFormField({ label, icon, hint, className = '', htmlFor, children, onCreate }: FormFieldProps & { onCreate: () => void }) {
  return <div className={`app-form-field ${className}`.trim()}>
    <label className="app-form-field-label" htmlFor={htmlFor}>
      {icon ? <span className="app-form-field-icon" aria-hidden="true">{icon}</span> : null}
      <span>{label}</span>
    </label>
      <button
          type="button"
          className="btn btn-sm btn-link"
          onClick={onCreate}
      >
          ＋ Nuovo
      </button>
    {children}
    {hint ? <small className="app-form-field-hint">{hint}</small> : null}
  </div>;
}

type SelectOption = {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
};

type SelectFieldProps = {
  label: string;
  name: string;
  value: string | number;
  options: SelectOption[];
  onChange: (value: string) => void;
  icon?: ReactNode;
  hint?: ReactNode;
  className?: string;
  required?: boolean;
  disabled?: boolean;
};

export function SelectField({
  label, name, value, options, onChange, icon = '⌄', hint, className = '', required, disabled
}: SelectFieldProps) {
  const generatedId = useId();
  const id = `${name}-${generatedId.replaceAll(':', '')}`;
  return <FormField label={label} icon={icon} hint={hint} className={className} htmlFor={id}>
    <div className="app-select-control">
      <select
        id={id}
        name={name}
        value={value}
        onChange={event => onChange(event.currentTarget.value)}
        required={required}
        disabled={disabled}
      >
        {options.map(option => <option key={String(option.value)} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>)}
      </select>
      <span className="app-select-caret" aria-hidden="true">⌄</span>
    </div>
  </FormField>;
}

type DateFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  className?: string;
  required?: boolean;
  min?: string;
  children?: ReactNode;
};

function datePresentation(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12);
  return {
    weekday: new Intl.DateTimeFormat('it-IT', { weekday: 'long' }).format(date),
    date: formatItalianCompactDate(value)
  };
}

export function DateField({ label, name, value, onChange, hint, className = '', required, min, children }: DateFieldProps) {
  const generatedId = useId();
  const id = `${name}-${generatedId.replaceAll(':', '')}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const presentation = datePresentation(value);

  return <FormField label={label} icon="◷" hint={hint} className={`app-date-field ${className}`.trim()} htmlFor={id}>
    <div className="app-date-control">
      <input
        ref={inputRef}
        id={id}
        type="date"
        name={name}
        value={value}
        onChange={event => onChange(event.currentTarget.value)}
        required={required}
        min={min}
      />
      <div className="app-date-presentation" aria-hidden="true">
        <strong>{presentation?.date ?? 'Seleziona una data'}</strong>
        <span>{presentation?.weekday ?? 'Calendario'}</span>
      </div>
      <button
        type="button"
        className="app-date-picker-button"
        aria-label={`Apri calendario per ${label}`}
        onClick={() => {
          inputRef.current?.focus();
          inputRef.current?.showPicker?.();
        }}
      >▦</button>
    </div>
    {children}
  </FormField>;
}

type MonthFieldProps = Omit<DateFieldProps, 'children'>;

export function MonthField({ label, name, value, onChange, hint, className = '', required }: MonthFieldProps) {
  const generatedId = useId();
  const id = `${name}-${generatedId.replaceAll(':', '')}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [year, month] = value.split('-').map(Number);
  const presentation = year && month
    ? new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1, 12))
    : 'Seleziona il periodo';

  return <FormField label={label} icon="▦" hint={hint} className={`app-date-field app-month-field ${className}`.trim()} htmlFor={id}>
    <div className="app-date-control app-month-picker-control">
      <input ref={inputRef} id={id} type="month" name={name} value={value} onChange={event => onChange(event.currentTarget.value)} required={required}/>
      <div className="app-date-presentation" aria-hidden="true">
        <strong>{presentation}</strong>
        <span>Seleziona mese e anno</span>
      </div>
      <button type="button" className="app-date-picker-button" aria-label={`Apri datepicker mese e anno per ${label}`} onClick={() => {
        inputRef.current?.focus();
        inputRef.current?.showPicker?.();
      }}>▦</button>
    </div>
  </FormField>;
}
