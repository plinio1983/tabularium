'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  title: string;
  query: string;
  placeholder: string;
  children: ReactNode;
  canConfirm: boolean;
  onQueryChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function isMobileEntityPickerViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
}

export default function MobileEntityPicker({
  title,
  query,
  placeholder,
  children,
  canConfirm,
  onQueryChange,
  onCancel,
  onConfirm,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel]);

  if (!mounted) return null;

  return createPortal(
    <section className="mobile-entity-picker" role="dialog" aria-modal="true" aria-label={title}>
      <header className="mobile-entity-picker-header">
        <label>
          <span>{title}</span>
          <input
            autoFocus
            value={query}
            autoComplete="off"
            placeholder={placeholder}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
        </label>
      </header>
      <div className="mobile-entity-picker-results" role="listbox">
        {children}
      </div>
      <footer className="mobile-entity-picker-actions">
        <button className="btn btn-md btn-default" type="button" onClick={onCancel}>Annulla</button>
        <button className="btn btn-md btn-primary" type="button" disabled={!canConfirm} onClick={onConfirm}>Conferma</button>
      </footer>
    </section>,
    document.body,
  );
}
