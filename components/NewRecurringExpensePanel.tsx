'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import RecurringExpenseForm from '@/components/RecurringExpenseForm';

type Option = { id: number; code?: string; name: string; icon?: string | null };
type SupplierOption = { id: number; businessName: string; alias?: string | null; email?: string | null; phone?: string | null; pec?: string | null; taxCodeSdi?: string | null; internalNotes?: string | null };

type Props = {
  categories: Option[];
  banks: Option[];
  suppliers: SupplierOption[];
};

export default function NewRecurringExpensePanel({ categories, banks, suppliers }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState('/api/recurring-expenses');

  useEffect(() => {
    const url = new URL(window.location.href);
    const returnTo = `${url.pathname}${url.search}`;
    setAction(`/api/recurring-expenses?returnTo=${encodeURIComponent(returnTo)}`);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-recurring-expense-new]')) return;

      event.preventDefault();
      setIsOpen(true);
    };

    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return <>
    <div className="toolbar-actions expense-toolbar-actions">
      <Link className="button-standard secondary-action" href="/expenses">↩ Lista spese</Link>
      <button className="button-standard primary-action" type="button" data-recurring-expense-new><span className="btn-icon">＋</span>Spesa ricorrente</button>
    </div>

    {isOpen ? <div className="modal-backdrop app-form-modal" role="dialog" aria-modal="true" aria-label="Aggiungi spesa ricorrente" onMouseDown={() => setIsOpen(false)}>
      <div className="modal-card modal-card-wide" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h3>Nuova spesa ricorrente</h3>
            <p className="muted">Configura una regola ricorrente senza uscire dalla lista.</p>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={() => setIsOpen(false)}>×</button>
        </div>
        <RecurringExpenseForm
          categories={categories}
          banks={banks}
          suppliers={suppliers}
          action={action}
          onCancel={() => setIsOpen(false)}
        />
      </div>
    </div> : null}
  </>;
}
