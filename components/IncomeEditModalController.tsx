"use client";

import { useEffect, useState } from "react";
import IncomeForm from "@/components/IncomeForm";

type EditIncome = {
  id: number;
  salesChannel?: string | null;
  saleCategory?: string | null;
  description?: string | null;
  amount?: string | number | null;
  paymentMethod?: string | null;
  creditChannel?: string | null;
  creditDate?: string | Date | null;
  billingMonth?: number | null;
  billingYear?: number | null;
  isFiscal?: boolean;
  invoiceStatus?: string | null;
  vatRate?: string | number | null;
  notes?: string | null;
};

type Props = {
  returnTo: string;
};

export default function IncomeEditModalController({ returnTo }: Props) {
  const [income, setIncome] = useState<EditIncome | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function openIncome(id: number) {
    setError("");
    setLoadingId(id);

    try {
      const response = await fetch(`/api/incomes/${id}/edit-data`, { cache: "no-store" });
      if (!response.ok) throw new Error("Impossibile caricare l'incasso.");
      const payload = await response.json();
      setIncome(payload.income as EditIncome);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricamento dell'incasso.");
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest<HTMLElement>("[data-income-edit-id]");
      if (!trigger) return;

      const id = Number(trigger.dataset.incomeEditId);
      if (!Number.isInteger(id) || id <= 0) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openIncome(id);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return <>
    {loadingId ? <div className="inline-modal-loading">Caricamento incasso #{loadingId}…</div> : null}
    {error ? <div className="inline-modal-error">{error}</div> : null}

    {income ? <div className="modal-backdrop app-form-modal edit-income-client-modal" role="dialog" aria-modal="true" aria-label={`Modifica incasso ${income.id}`} onMouseDown={() => setIncome(null)}>
      <div className="modal-card modal-card-wide" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h3>Modifica incasso #{income.id}</h3>
            <p className="muted">Aggiorna l'incasso senza uscire dalla pagina attuale.</p>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={() => setIncome(null)}>×</button>
        </div>
        <IncomeForm
          initialIncome={income}
          action={`/api/incomes/${income.id}?returnTo=${encodeURIComponent(returnTo)}`}
          title={`Modifica incasso #${income.id}`}
          submitLabel="Salva modifiche"
          onCancel={() => setIncome(null)}
        />
      </div>
    </div> : null}
  </>;
}
