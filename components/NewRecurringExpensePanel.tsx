'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import RecurringExpenseForm from '@/components/RecurringExpenseForm';
import { flashParamNames } from '@/lib/flash';

type Option = { id: number; code?: string; name: string; icon?: string | null; isFallback?: boolean | null; kind?: string };
type SupplierOption = { id: number; businessName: string; alias?: string | null; email?: string | null; vatNumber?: string | null; iban?: string | null; pec?: string | null; taxCodeSdi?: string | null; internalNotes?: string | null };

type Props = {
  categories: Option[];
  banks: Option[];
  paymentMethods: Option[];
  suppliers: SupplierOption[];
};

export default function NewRecurringExpensePanel({ categories, banks, paymentMethods, suppliers }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState('/api/recurring-expenses');

  useEffect(() => {
    const url = new URL(window.location.href);
    flashParamNames.forEach(key => url.searchParams.delete(key));
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
    <div className="toolbar-actions record-toolbar-actions">
      <Link className="btn btn-sm btn-default" href="/expenses"><span className="btn-icon">↩</span> Lista spese</Link>
      <button className="btn btn-sm btn-secondary" type="button" data-recurring-expense-new><span className="btn-icon">＋</span>Spesa ricorrente</button>
    </div>

    {isOpen ? <div className="modal-backdrop app-form-modal app-wizard-modal" role="dialog" aria-modal="true" aria-label="Aggiungi spesa ricorrente" onMouseDown={() => setIsOpen(false)}>
      <div className="modal-card modal-card-wide app-wizard-modal-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h3>Nuova spesa ricorrente</h3>
            <p className="muted">Definisci una regola di spesa ricorrente.</p>
          </div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setIsOpen(false)}>×</button>
        </div>
        <RecurringExpenseForm
          categories={categories}
          banks={banks}
          paymentMethods={paymentMethods}
          suppliers={suppliers}
          action={action}
          onCancel={() => setIsOpen(false)}
        />
      </div>
    </div> : null}
  </>;
}
