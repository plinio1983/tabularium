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
  defaultVatRate?: string | number | null;
};
type EmployeeOption = { id: number; firstName: string; lastName: string; employeeCode?: string | null; status: "ACTIVE" | "INACTIVE" };

type EditExpense = {
  id: number;
  expenseType?: "STANDARD" | "VAT_SETTLEMENT" | "COUNTER" | "TAX_CONTRIBUTION" | "PAYROLL";
  employeeId?: number | null;
  payrollNetAmount?: string | number | null;
  payrollExtraCompensation?: string | number | null;
  payrollGrossAmount?: string | number | null;
  payrollEmployerCost?: string | number | null;
  affectsFiscalProfit?: boolean;
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
  }>;
  notes?: string | null;
};

type Props = {
  categories: Option[];
  banks: Option[];
  paymentMethods: Option[];
  suppliers: SupplierOption[];
  employees?: EmployeeOption[];
  listHref: string;
  formId?: string;
};

function selectedExpenseIdsFromBulk(formId: string) {
  const selected = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[form="${formId}"][name="ids"]:checked, form#${formId} input[name="ids"]:checked`
    )
  );
  return [...new Set(selected.map(input => Number(input.value)))]
    .filter(id => Number.isInteger(id) && id > 0);
}

export default function ExpenseEditModalController({ categories, banks, paymentMethods, suppliers, employees = [], listHref, formId = "expenseBulkForm" }: Props) {
  const [availableEmployees, setAvailableEmployees] = useState(employees);
  const [expense, setExpense] = useState<EditExpense | null>(null);
  const [mode, setMode] = useState<"edit" | "copy" | "payment">("edit");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (availableEmployees.length) return;
    fetch('/api/employees', {cache: 'no-store'}).then(response => response.ok ? response.json() : []).then(setAvailableEmployees).catch(() => undefined);
  }, [availableEmployees.length]);

  async function openExpense(id: number, nextMode: "edit" | "copy" | "payment" = "edit") {
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
      const paymentTrigger = target.closest<HTMLElement>("[data-expense-payment-id], [data-bulk-add-payment]");
      const trigger = editTrigger ?? copyTrigger ?? paymentTrigger;
      if (!trigger) return;

      const nextMode = copyTrigger ? "copy" : paymentTrigger ? "payment" : "edit";
      let id = Number((copyTrigger ? copyTrigger.dataset.expenseCopyId : paymentTrigger ? paymentTrigger.dataset.expensePaymentId : editTrigger?.dataset.expenseEditId) || 0);
      if (!Number.isInteger(id) || id <= 0) {
        const selectedIds = selectedExpenseIdsFromBulk(formId);
        if (paymentTrigger && selectedIds.length !== 1) {
          event.preventDefault();
          event.stopPropagation();
          window.alert("Seleziona una sola spesa per inserire i pagamenti.");
          return;
        }
        id = selectedIds.length === 1 ? selectedIds[0] : 0;
      }
      if (!Number.isInteger(id) || id <= 0) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openExpense(id, nextMode);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [formId]);

  return <>
    {loadingId ? <div className="inline-modal-loading">Caricamento spesa #{loadingId}…</div> : null}
    {error ? <div className="inline-modal-error">{error}</div> : null}

    {expense ? <div className="modal-backdrop app-form-modal edit-expense-client-modal app-wizard-modal" role="dialog" aria-modal="true" aria-label={mode === "copy" ? `Copia spesa ${expense.id}` : mode === "payment" ? `Inserisci pagamento per la spesa ${expense.id}` : `Modifica spesa ${expense.id}`} onMouseDown={() => setExpense(null)}>
      <div className="modal-card modal-card-wide app-wizard-modal-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h3>{mode === "copy" ? `Copia spesa #${expense.id}` : mode === "payment" ? `Nuovo pagamento · spesa #${expense.id}` : `Modifica spesa #${expense.id}`}</h3>
            <p className="muted">{mode === "copy" ? "I dati sono precompilati, pagamenti e stato pagamento restano azzerati." : mode === "payment" ? "Registra un nuovo pagamento per questa spesa." : "Aggiorna dati e pagamenti."}</p>
          </div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setExpense(null)}>×</button>
        </div>
        <ExpenseForm
          key={`${mode}-${expense.id}`}
          title={mode === "copy" ? "Nuova spesa da copia" : "Modifica spesa"}
          cancelHref={listHref}
          onCancel={() => setExpense(null)}
          submitLabel={mode === "copy" ? "Crea spesa copiata" : mode === "payment" ? "Salva pagamento" : "Salva modifiche"}
          action={mode === "copy" ? `/api/expenses?returnTo=${encodeURIComponent(listHref)}` : `/api/expenses/${expense.id}?returnTo=${encodeURIComponent(listHref)}`}
          categories={categories}
          banks={banks}
          paymentMethods={paymentMethods}
          suppliers={suppliers}
          employees={availableEmployees}
          initialExpense={expense}
          initialMobileStep={mode === "payment" ? 4 : 1}
          mobileStepOffset={1}
          openNewPayment={mode === "payment"}
        />
      </div>
    </div> : null}
  </>;
}
