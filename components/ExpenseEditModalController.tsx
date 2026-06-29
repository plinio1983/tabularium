"use client";

import { useEffect, useState } from "react";
import ExpenseForm from "@/components/ExpenseForm";
import { clampDateToToday, clampPeriodToCurrentMonth } from "@/lib/copy-dates";

type Option = { id: number; code?: string; name: string; icon?: string | null; isFallback?: boolean | null; kind?: string };
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

type EditExpense = {
  id: number;
  receivedDate?: string | Date | null;
  dueDate?: string | Date | null;
  supplierId?: number | null;
  merchant?: string | null;
  categoryId?: number | null;
  description?: string | null;
  amount?: string | number | null;
  vatRate?: string | number | null;
  paymentStatus?: string | null;
  month?: number;
  year?: number;
  hasElectronicInvoice?: boolean;
  invoiceStatus?: string | null;
  isDeclared?: boolean;
  isRecurring?: boolean;
  payments?: Array<{
    id?: number;
    paymentDate?: string | Date | null;
    channel?: string | null;
    paymentMethodId?: number | null;
    bankId?: number | null;
    amount?: string | number | null;
    paidBy?: "HERBAL_MARKET" | "ALTRO_OPERATORE";
  }>;
  notes?: string | null;
};

type Props = {
  categories: Option[];
  banks: Option[];
  paymentMethods: Option[];
  suppliers: SupplierOption[];
  listHref: string;
};

function selectedExpenseIdFromBulk() {
  const selected = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[form="expenseBulkForm"][name="ids"]:checked')
  );

  if (selected.length !== 1) return null;

  const id = Number(selected[0].value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default function ExpenseEditModalController({ categories, banks, paymentMethods, suppliers, listHref }: Props) {
  const [expense, setExpense] = useState<EditExpense | null>(null);
  const [mode, setMode] = useState<"edit" | "copy">("edit");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function openExpense(id: number, nextMode: "edit" | "copy" = "edit") {
    setError("");
    setMode(nextMode);
    setLoadingId(id);

    try {
      const response = await fetch(`/api/expenses/${id}/edit-data`, { cache: "no-store" });
      if (!response.ok) throw new Error("Impossibile caricare la spesa.");
      const payload = await response.json();
      const loadedExpense = payload.expense as EditExpense;
      if (nextMode === "copy") {
        const billingPeriod = clampPeriodToCurrentMonth(loadedExpense.month, loadedExpense.year);
        setExpense({
          ...loadedExpense,
          receivedDate: clampDateToToday(loadedExpense.receivedDate),
          month: billingPeriod.month,
          year: billingPeriod.year,
          paymentStatus: "DA_PAGARE",
          payments: [],
        });
      } else {
        setExpense(loadedExpense);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricamento della spesa.");
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const editTrigger = target.closest<HTMLElement>("[data-expense-edit-id]");
      const copyTrigger = target.closest<HTMLElement>("[data-expense-copy-id]");
      const trigger = editTrigger ?? copyTrigger;
      if (!trigger) return;

      const nextMode = copyTrigger ? "copy" : "edit";
      let id = Number((copyTrigger ? copyTrigger.dataset.expenseCopyId : editTrigger?.dataset.expenseEditId) || 0);
      if (!Number.isInteger(id) || id <= 0) {
        id = selectedExpenseIdFromBulk() ?? 0;
      }
      if (!Number.isInteger(id) || id <= 0) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openExpense(id, nextMode);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return <>
    {loadingId ? <div className="inline-modal-loading">Caricamento spesa #{loadingId}…</div> : null}
    {error ? <div className="inline-modal-error">{error}</div> : null}

    {expense ? <div className="modal-backdrop app-form-modal edit-expense-client-modal" role="dialog" aria-modal="true" aria-label={mode === "copy" ? `Copia spesa ${expense.id}` : `Modifica spesa ${expense.id}`} onMouseDown={() => setExpense(null)}>
      <div className="modal-card modal-card-wide" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h3>{mode === "copy" ? `Copia spesa #${expense.id}` : `Modifica spesa #${expense.id}`}</h3>
            <p className="muted">{mode === "copy" ? "I dati sono precompilati, pagamenti e stato pagamento restano azzerati." : "Aggiorna dati e pagamenti senza uscire dalla lista."}</p>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={() => setExpense(null)}>×</button>
        </div>
        <ExpenseForm
          key={`${mode}-${expense.id}`}
          title={mode === "copy" ? "Nuova spesa da copia" : "Modifica spesa"}
          cancelHref={listHref}
          onCancel={() => setExpense(null)}
          submitLabel={mode === "copy" ? "Crea spesa copiata" : "Salva modifiche"}
          action={mode === "copy" ? `/api/expenses?returnTo=${encodeURIComponent(listHref)}` : `/api/expenses/${expense.id}?returnTo=${encodeURIComponent(listHref)}`}
          categories={categories}
          banks={banks}
          paymentMethods={paymentMethods}
          suppliers={suppliers}
          initialExpense={expense}
        />
      </div>
    </div> : null}
  </>;
}
