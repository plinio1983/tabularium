"use client";

import { useEffect, useState } from "react";
import ExpenseForm from "@/components/ExpenseForm";
import { clampDateToToday, clampPeriodToCurrentMonth } from "@/lib/copy-dates";

type Option = { id: number; code?: string; name: string; icon?: string | null; isFallback?: boolean | null; kind?: string; systemRole?: string | null; isVatSettlementDefault?: boolean };
type SupplierOption = {
  id: number;
  businessName: string;
  alias?: string | null;
  email?: string | null;
  vatNumber?: string | null;
  iban?: string | null;
  pec?: string | null;
  taxCodeSdi?: string | null;
  internalNotes?: string | null;
  systemRole?: string | null;
  defaultExpenseCategoryId?: number | null;
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
  expenseType?: "STANDARD" | "VAT_SETTLEMENT" | "COUNTER";
  notes?: string | null;
  attachments?: Array<{
    id: number;
    originalName: string;
    sizeBytes?: number | null;
    type: "INVOICE" | "DOCUMENT" | "PAYMENT_RECEIPT";
  }>;
  payments?: Array<{
    id?: number;
    paymentDate?: string | Date | null;
    channel?: string | null;
    paymentMethodId?: number | null;
    bankId?: number | null;
    amount?: string | number | null;
  }>;
};

type Props = {
  categories: Option[];
  banks: Option[];
  paymentMethods: Option[];
  suppliers: SupplierOption[];
  returnTo: string;
};

export default function ExpenseDetailEditModalController({ categories, banks, paymentMethods, suppliers, returnTo }: Props) {
  const [expense, setExpense] = useState<EditExpense | null>(null);
  const [mode, setMode] = useState<"edit" | "copy" | "payment" | "payment-edit" | "attachments">("edit");
  const [targetPaymentId, setTargetPaymentId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function openExpense(
    id: number,
    nextMode: "edit" | "copy" | "payment" | "payment-edit" | "attachments" = "edit",
    paymentId: number | null = null,
  ) {
    setError("");
    setMode(nextMode);
    setTargetPaymentId(paymentId);
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
      const editTrigger = target?.closest<HTMLElement>("[data-expense-detail-edit-id]");
      const detailCopyTrigger = target?.closest<HTMLElement>("[data-expense-detail-copy-id]");
      const genericCopyTrigger = target?.closest<HTMLElement>("[data-expense-copy-id]");
      const paymentTrigger = target?.closest<HTMLElement>("[data-expense-detail-payment-id]");
      const paymentEditTrigger = target?.closest<HTMLElement>("[data-expense-detail-payment-edit-id]");
      const attachmentsTrigger = target?.closest<HTMLElement>("[data-expense-detail-attachments-id]");
      const copyTrigger = detailCopyTrigger ?? genericCopyTrigger;
      const trigger = editTrigger ?? copyTrigger ?? paymentTrigger ?? paymentEditTrigger ?? attachmentsTrigger;
      if (!trigger) return;

      const nextMode = copyTrigger
        ? "copy"
        : paymentTrigger
          ? "payment"
          : paymentEditTrigger
            ? "payment-edit"
            : attachmentsTrigger
              ? "attachments"
              : "edit";
      const id = Number(paymentEditTrigger
        ? paymentEditTrigger.dataset.expenseId
        : copyTrigger
        ? (detailCopyTrigger?.dataset.expenseDetailCopyId ?? genericCopyTrigger?.dataset.expenseCopyId)
        : paymentTrigger
          ? paymentTrigger.dataset.expenseDetailPaymentId
          : attachmentsTrigger
            ? attachmentsTrigger.dataset.expenseDetailAttachmentsId
            : editTrigger?.dataset.expenseDetailEditId);
      if (!Number.isInteger(id) || id <= 0) return;
      const paymentId = paymentEditTrigger
        ? Number(paymentEditTrigger.dataset.expenseDetailPaymentEditId)
        : null;
      if (paymentEditTrigger && (!Number.isInteger(paymentId) || Number(paymentId) <= 0)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openExpense(id, nextMode, paymentId);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return <>
    {loadingId ? <div className="inline-modal-loading">Caricamento spesa #{loadingId}…</div> : null}
    {error ? <div className="inline-modal-error">{error}</div> : null}

    {expense ? <div className="modal-backdrop app-form-modal edit-expense-client-modal app-wizard-modal" role="dialog" aria-modal="true" aria-label={mode === "copy" ? `Copia spesa ${expense.id}` : mode === "payment" ? `Inserisci pagamento per la spesa ${expense.id}` : mode === "payment-edit" ? `Modifica pagamento della spesa ${expense.id}` : mode === "attachments" ? `Modifica allegati della spesa ${expense.id}` : `Modifica spesa ${expense.id}`} onMouseDown={() => setExpense(null)}>
      <div className="modal-card modal-card-wide app-wizard-modal-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h3>{mode === "copy" ? `Copia spesa #${expense.id}` : mode === "payment" ? `Nuovo pagamento · spesa #${expense.id}` : mode === "payment-edit" ? `Modifica pagamento · spesa #${expense.id}` : mode === "attachments" ? `Modifica allegati · spesa #${expense.id}` : `Modifica spesa #${expense.id}`}</h3>
            <p className="muted">{mode === "copy" ? "I dati sono precompilati, pagamenti e stato pagamento restano azzerati." : mode === "payment" ? "Registra un nuovo pagamento per questa spesa." : mode === "payment-edit" ? "Aggiorna il pagamento selezionato." : mode === "attachments" ? "Aggiungi o aggiorna gli allegati della spesa." : "Aggiorna dati, pagamenti e allegati."}</p>
          </div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setExpense(null)}>×</button>
        </div>
        <ExpenseForm
          key={`${mode}-${expense.id}-${targetPaymentId ?? "none"}`}
          title={mode === "copy" ? "Nuova spesa da copia" : "Modifica spesa"}
          cancelHref={returnTo}
          onCancel={() => setExpense(null)}
          submitLabel={mode === "copy" ? "Crea spesa copiata" : mode === "payment" || mode === "payment-edit" ? "Salva pagamento" : "Salva modifiche"}
          action={mode === "copy" ? `/api/expenses?returnTo=${encodeURIComponent(returnTo)}` : `/api/expenses/${expense.id}?returnTo=${encodeURIComponent(returnTo)}`}
          categories={categories}
          banks={banks}
          paymentMethods={paymentMethods}
          suppliers={suppliers}
          initialExpense={mode === "copy" ? {...expense, attachments: []} : expense}
          initialMobileStep={mode === "payment" || mode === "payment-edit" ? 4 : mode === "attachments" ? 7 : 1}
          openNewPayment={mode === "payment"}
          initialOpenPaymentId={mode === "payment-edit" ? targetPaymentId ?? undefined : undefined}
          focusAttachments={mode === "attachments"}
        />
      </div>
    </div> : null}
  </>;
}
