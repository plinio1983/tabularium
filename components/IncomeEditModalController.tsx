"use client";

import { useEffect, useState } from "react";
import IncomeForm from "@/components/IncomeForm";
import { clampDateToToday, clampPeriodToCurrentMonth } from "@/lib/copy-dates";

type EditIncome = {
  id: number;
  salesChannel?: string | null;
  saleCategory?: string | null;
  description?: string | null;
  amount?: string | number | null;
  paymentMethod?: string | null;
  paymentMethodId?: number | null;
  creditChannel?: string | null;
  creditBankId?: number | null;
  creditDate?: string | Date | null;
  isCredited?: boolean;
  billingMonth?: number | null;
  billingYear?: number | null;
  isFiscal?: boolean;
  invoiceStatus?: string | null;
  vatRate?: string | number | null;
  notes?: string | null;
};

type Option = { id: number; name: string; isFallback?: boolean | null };
type PaymentMethodOption = Option & { kind?: string };

type Props = {
  returnTo: string;
  banks: Option[];
  paymentMethods: PaymentMethodOption[];
};

export default function IncomeEditModalController({ returnTo, banks, paymentMethods }: Props) {
  const [income, setIncome] = useState<EditIncome | null>(null);
  const [mode, setMode] = useState<"edit" | "copy">("edit");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function openIncome(id: number, nextMode: "edit" | "copy" = "edit") {
    setError("");
    setMode(nextMode);
    setLoadingId(id);

    try {
      const response = await fetch(`/api/incomes/${id}/edit-data`, { cache: "no-store" });
      if (!response.ok) throw new Error("Impossibile caricare l'incasso.");
      const payload = await response.json();
      const loadedIncome = payload.income as EditIncome;
      if (nextMode === "copy") {
        const billingPeriod = clampPeriodToCurrentMonth(loadedIncome.billingMonth, loadedIncome.billingYear);
        setIncome({
          ...loadedIncome,
          creditDate: clampDateToToday(loadedIncome.creditDate),
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
      const trigger = editTrigger ?? copyTrigger;
      if (!trigger) return;

      const nextMode = copyTrigger ? "copy" : "edit";
      const id = Number(copyTrigger ? copyTrigger.dataset.incomeCopyId : editTrigger?.dataset.incomeEditId);
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

    {income ? <div className="modal-backdrop app-form-modal edit-income-client-modal" role="dialog" aria-modal="true" aria-label={mode === "copy" ? `Copia incasso ${income.id}` : `Modifica incasso ${income.id}`} onMouseDown={() => setIncome(null)}>
      <div className="modal-card modal-card-wide" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h3>{mode === "copy" ? `Copia incasso #${income.id}` : `Modifica incasso #${income.id}`}</h3>
            <p className="muted">{mode === "copy" ? "I dati sono precompilati: puoi modificarli prima di salvare il nuovo incasso." : "Aggiorna l'incasso senza uscire dalla pagina attuale."}</p>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={() => setIncome(null)}>×</button>
        </div>
        <IncomeForm
          key={`${mode}-${income.id}`}
          initialIncome={income}
          action={mode === "copy" ? `/api/incomes?returnTo=${encodeURIComponent(returnTo)}` : `/api/incomes/${income.id}?returnTo=${encodeURIComponent(returnTo)}`}
          title={mode === "copy" ? "Nuovo incasso da copia" : `Modifica incasso #${income.id}`}
          submitLabel={mode === "copy" ? "Crea incasso copiato" : "Salva modifiche"}
          onCancel={() => setIncome(null)}
          banks={banks}
          paymentMethods={paymentMethods}
        />
      </div>
    </div> : null}
  </>;
}
