"use client";

import { useEffect, useState } from "react";
import IncomeForm from "@/components/IncomeForm";
import { clampDateToToday, clampPeriodToCurrentMonth } from "@/lib/copy-dates";

type EditIncome = {
  id: number;
  customerId?: number | null;
  salesChannelId: number;
  description?: string | null;
  amount?: string | number | null;
  paymentMethodId?: number | null;
  creditBankId?: number | null;
  orderDate?: string | Date | null;
  dueDate?: string | Date | null;
  creditDate?: string | Date | null;
  isCredited?: boolean;
  credits?: Array<{
    id?: number;
    creditDate?: string | Date | null;
    paymentMethodId?: number | null;
    bankId?: number | null;
    amount?: string | number | null;
  }>;
  billingMonth?: number | null;
  billingYear?: number | null;
  isFiscal?: boolean;
  invoiceStatus?: string | null;
  vatRate?: string | number | null;
  notes?: string | null;
};

type Option = { id: number; name: string; icon?: string | null; isFallback?: boolean | null };
type PaymentMethodOption = Option & { kind?: string; isIncomeDefault?: boolean };
type IncomeEntityOption = { id: number; code: string; name: string; icon?: string | null };
type CustomerOption = { id: number; businessName: string; alias?: string | null; systemRole?: string | null };

type Props = {
  returnTo: string;
  banks: Option[];
  paymentMethods: PaymentMethodOption[];
  salesChannels: IncomeEntityOption[];
  customers: CustomerOption[];
};

export default function IncomeEditModalController({ returnTo, banks, paymentMethods, salesChannels, customers }: Props) {
  const [income, setIncome] = useState<EditIncome | null>(null);
  const [mode, setMode] = useState<"edit" | "copy" | "credit">("edit");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function openIncome(id: number, nextMode: "edit" | "copy" | "credit" = "edit") {
    setError("");
    setMode(nextMode);
    setLoadingId(id);

    try {
      const response = await fetch(`/api/incomes/${id}/edit-data`, { cache: "no-store" });
      if (!response.ok) throw new Error("Impossibile caricare l'incasso.");
      const payload = await response.json();
      const loadedIncome = payload.income as EditIncome;
      const creditedAmount = (loadedIncome.credits ?? []).reduce((sum, credit) => sum + Number(credit.amount ?? 0), 0);
      if (nextMode === "credit" && (loadedIncome.isCredited || creditedAmount >= Number(loadedIncome.amount ?? 0) - 0.005)) {
        setError("Questo incasso risulta già completamente accreditato.");
        return;
      }
      if (nextMode === "copy") {
        const billingPeriod = clampPeriodToCurrentMonth(loadedIncome.billingMonth, loadedIncome.billingYear);
        setIncome({
          ...loadedIncome,
          orderDate: clampDateToToday(loadedIncome.orderDate ?? loadedIncome.creditDate),
          dueDate: clampDateToToday(loadedIncome.dueDate ?? loadedIncome.orderDate ?? loadedIncome.creditDate),
          creditDate: clampDateToToday(loadedIncome.creditDate),
          isCredited: false,
          credits: [],
          billingMonth: billingPeriod.month,
          billingYear: billingPeriod.year,
        });
      } else {
        setIncome(loadedIncome);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricamento dell'incasso.");
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const editTrigger = target?.closest<HTMLElement>("[data-income-edit-id]");
      const copyTrigger = target?.closest<HTMLElement>("[data-income-copy-id]");
      const creditTrigger = target?.closest<HTMLElement>("[data-income-credit-id], [data-bulk-add-credit]");
      const trigger = editTrigger ?? copyTrigger ?? creditTrigger;
      if (!trigger) return;

      const nextMode = copyTrigger ? "copy" : creditTrigger ? "credit" : "edit";
      let id = Number(copyTrigger ? copyTrigger.dataset.incomeCopyId : creditTrigger ? creditTrigger.dataset.incomeCreditId : editTrigger?.dataset.incomeEditId);
      if (!Number.isInteger(id) || id <= 0) {
        const selected = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked'))
          .map(input => Number(input.value)).filter(value => Number.isInteger(value) && value > 0);
        const selectedIds = [...new Set(selected)];
        if (creditTrigger && selectedIds.length !== 1) {
          event.preventDefault();
          event.stopPropagation();
          window.alert("Seleziona un solo incasso per inserire l’accredito.");
          return;
        }
        id = selectedIds[0] ?? 0;
      }
      if (!Number.isInteger(id) || id <= 0) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openIncome(id, nextMode);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return <>
    {loadingId ? <div className="inline-modal-loading">Caricamento incasso #{loadingId}…</div> : null}
    {error ? <div className="inline-modal-error">{error}</div> : null}

    {income ? <div className="modal-backdrop app-form-modal edit-income-client-modal app-wizard-modal" role="dialog" aria-modal="true" aria-label={mode === "copy" ? `Copia incasso ${income.id}` : mode === "credit" ? `Inserisci accredito per l’incasso ${income.id}` : `Modifica incasso ${income.id}`} onMouseDown={() => setIncome(null)}>
      <div className="modal-card modal-card-wide app-wizard-modal-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h3>{mode === "copy" ? `Copia incasso #${income.id}` : mode === "credit" ? `Nuovo accredito · incasso #${income.id}` : `Modifica incasso #${income.id}`}</h3>
            <p className="muted">{mode === "copy" ? "I dati sono precompilati: puoi modificarli prima di salvare il nuovo incasso." : mode === "credit" ? "Registra un nuovo accredito per questo incasso." : "Aggiorna l'incasso."}</p>
          </div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setIncome(null)}>×</button>
        </div>
        <IncomeForm
          key={`${mode}-${income.id}`}
          initialIncome={income}
          action={mode === "copy" ? `/api/incomes?returnTo=${encodeURIComponent(returnTo)}` : `/api/incomes/${income.id}?returnTo=${encodeURIComponent(returnTo)}`}
          title={mode === "copy" ? "Nuovo incasso da copia" : `Modifica incasso #${income.id}`}
          submitLabel={mode === "copy" ? "Crea incasso copiato" : mode === "credit" ? "Salva accredito" : "Salva modifiche"}
          onCancel={() => setIncome(null)}
          banks={banks}
          paymentMethods={paymentMethods}
          salesChannels={salesChannels}
          customers={customers}
          initialMobileStep={mode === "credit" ? 4 : 1}
          openNewCredit={mode === "credit"}
        />
      </div>
    </div> : null}
  </>;
}
