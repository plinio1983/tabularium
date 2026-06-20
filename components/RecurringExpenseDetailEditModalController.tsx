"use client";

import { useEffect, useState } from "react";
import RecurringExpenseForm from "@/components/RecurringExpenseForm";

type Option = { id: number; code?: string; name: string; icon?: string | null };
type SupplierOption = {
  id: number;
  businessName: string;
  alias?: string | null;
  email?: string | null;
  phone?: string | null;
  pec?: string | null;
  taxCodeSdi?: string | null;
  internalNotes?: string | null;
};

type EditRecurringExpense = {
  id: number;
  startDate?: string | Date | null;
  cadence?: string | null;
  dueDay?: number | null;
  dueMonth?: number | null;
  accrualType?: string | null;
  billingPeriodMode?: string | null;
  billingMonth?: number | null;
  supplierId?: number | null;
  merchant?: string | null;
  categoryId?: number | null;
  description?: string | null;
  amount?: string | number | null;
  vatRate?: string | number | null;
  isDeclared?: boolean;
  hasElectronicInvoice?: boolean;
  paymentChannel?: string | null;
  bankId?: number | null;
  notes?: string | null;
};

type Props = {
  categories: Option[];
  banks: Option[];
  suppliers: SupplierOption[];
  returnTo: string;
};

export default function RecurringExpenseDetailEditModalController({ categories, banks, suppliers, returnTo }: Props) {
  const [expense, setExpense] = useState<EditRecurringExpense | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function openRecurringExpense(id: number) {
    setError("");
    setLoadingId(id);

    try {
      const response = await fetch(`/api/recurring-expenses/${id}/edit-data`, { cache: "no-store" });
      if (!response.ok) throw new Error("Impossibile caricare la spesa ricorrente.");
      const payload = await response.json();
      setExpense(payload.expense as EditRecurringExpense);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricamento della spesa ricorrente.");
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest<HTMLElement>("[data-recurring-expense-detail-edit-id]");
      if (!trigger) return;

      const id = Number(trigger.dataset.recurringExpenseDetailEditId);
      if (!Number.isInteger(id) || id <= 0) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openRecurringExpense(id);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return <>
    {loadingId ? <div className="inline-modal-loading">Caricamento spesa ricorrente #{loadingId}…</div> : null}
    {error ? <div className="inline-modal-error">{error}</div> : null}

    {expense ? <div className="modal-backdrop app-form-modal edit-expense-client-modal" role="dialog" aria-modal="true" aria-label={`Modifica spesa ricorrente ${expense.id}`} onMouseDown={() => setExpense(null)}>
      <div className="modal-card modal-card-wide" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h3>Modifica spesa ricorrente #{expense.id}</h3>
            <p className="muted">Aggiorna la regola ricorrente senza uscire dalla pagina dettaglio.</p>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={() => setExpense(null)}>×</button>
        </div>
        <RecurringExpenseForm
          categories={categories}
          banks={banks}
          suppliers={suppliers}
          action={`/api/recurring-expenses/${expense.id}?returnTo=${encodeURIComponent(returnTo)}`}
          initialExpense={expense}
          onCancel={() => setExpense(null)}
        />
      </div>
    </div> : null}
  </>;
}
