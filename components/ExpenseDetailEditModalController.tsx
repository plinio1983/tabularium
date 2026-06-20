"use client";

import { useEffect, useState } from "react";
import ExpenseForm from "@/components/ExpenseForm";

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
  notes?: string | null;
  payments?: Array<{
    id?: number;
    paymentDate?: string | Date | null;
    channel?: string | null;
    bankId?: number | null;
    amount?: string | number | null;
    paidBy?: "HERBAL_MARKET" | "ALTRO_OPERATORE";
  }>;
};

type Props = {
  categories: Option[];
  banks: Option[];
  suppliers: SupplierOption[];
  returnTo: string;
};

export default function ExpenseDetailEditModalController({ categories, banks, suppliers, returnTo }: Props) {
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
      setExpense(nextMode === "copy" ? {
        ...loadedExpense,
        paymentStatus: "DA_PAGARE",
        payments: [],
      } : loadedExpense);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricamento della spesa.");
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const editTrigger = target?.closest<HTMLElement>("[data-expense-detail-edit-id]");
      const detailCopyTrigger = target?.closest<HTMLElement>("[data-expense-detail-copy-id]");
      const genericCopyTrigger = target?.closest<HTMLElement>("[data-expense-copy-id]");
      const copyTrigger = detailCopyTrigger ?? genericCopyTrigger;
      const trigger = editTrigger ?? copyTrigger;
      if (!trigger) return;

      const nextMode = copyTrigger ? "copy" : "edit";
      const id = Number(copyTrigger ? (detailCopyTrigger?.dataset.expenseDetailCopyId ?? genericCopyTrigger?.dataset.expenseCopyId) : editTrigger?.dataset.expenseDetailEditId);
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
            <p className="muted">{mode === "copy" ? "I dati sono precompilati, pagamenti e stato pagamento restano azzerati." : "Aggiorna dati, pagamenti e allegati senza uscire dalla pagina dettaglio."}</p>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={() => setExpense(null)}>×</button>
        </div>
        <ExpenseForm
          title={mode === "copy" ? "Nuova spesa da copia" : "Modifica spesa"}
          cancelHref={returnTo}
          onCancel={() => setExpense(null)}
          submitLabel={mode === "copy" ? "Crea spesa copiata" : "Salva modifiche"}
          action={mode === "copy" ? `/api/expenses?returnTo=${encodeURIComponent(returnTo)}` : `/api/expenses/${expense.id}?returnTo=${encodeURIComponent(returnTo)}`}
          categories={categories}
          banks={banks}
          suppliers={suppliers}
          initialExpense={expense}
        />
      </div>
    </div> : null}
  </>;
}
