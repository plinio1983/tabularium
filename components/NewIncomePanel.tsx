"use client";

import { useEffect, useState } from "react";
import IncomeForm from "@/components/IncomeForm";
import { flashParamNames } from '@/lib/flash';

type Option = { id: number; name: string; icon?: string | null; isFallback?: boolean | null };
type PaymentMethodOption = Option & { kind?: string; isIncomeDefault?: boolean };
type IncomeEntityOption = { id: number; code: string; name: string; icon?: string | null };
type CustomerOption = { id: number; businessName: string; alias?: string | null; systemRole?: string | null };

export default function NewIncomePanel({ initialOpen = false, showToolbar = true, banks, paymentMethods, salesChannels, customers, initialCustomerId }: {
  initialOpen?: boolean;
  showToolbar?: boolean;
  banks: Option[];
  paymentMethods: PaymentMethodOption[];
  salesChannels: IncomeEntityOption[];
  customers: CustomerOption[];
  initialCustomerId?: number;
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [returnAction, setReturnAction] = useState('/api/incomes');

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('new');
    flashParamNames.forEach(key => url.searchParams.delete(key));
    const returnTo = `${url.pathname}${url.search}`;
    setReturnAction(`/api/incomes?returnTo=${encodeURIComponent(returnTo)}`);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-income-new]')) return;

      event.preventDefault();
      setIsOpen(true);
    };

    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div className="grid">
      {showToolbar ? <div className="toolbar-card">
        <div>
          <h2>Incassi</h2>
          <p className="muted">Gestione delle entrate fiscali e non fiscali.</p>
        </div>
        <button className="btn btn-sm btn-primary income-add-btn" type="button" data-income-new>
          <span className="btn-icon">+</span>Inserisci incasso
        </button>
      </div> : null}

      {isOpen ? <div className="modal-backdrop app-form-modal expense-wizard-modal" role="dialog" aria-modal="true" aria-label="Inserisci incasso" onMouseDown={() => setIsOpen(false)}>
        <div className="modal-card modal-card-wide expense-wizard-modal-card" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-title">
            <div>
              <h3>Nuovo incasso</h3>
              <p className="muted">Inserisci un nuovo incasso.</p>
            </div>
            <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setIsOpen(false)}>×</button>
          </div>
          <IncomeForm initialIncome={initialCustomerId ? { customerId: initialCustomerId } : undefined} action={returnAction} onCancel={() => setIsOpen(false)} banks={banks} paymentMethods={paymentMethods} salesChannels={salesChannels} customers={customers} />
        </div>
      </div> : null}
    </div>
  );
}
