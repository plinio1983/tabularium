"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FilterIcon from "@/components/FilterIcon";

type Option = { id: number; name: string; icon?: string | null };

type Props = {
  filters: Record<string, string | string[] | undefined>;
  categories: Option[];
  banks: Option[];
  paymentMethods: Option[];
};

const cadenceOptions = [
  ["MONTHLY", "Ogni mese"],
  ["EVERY_2_MONTHS", "Ogni 2 mesi"],
  ["EVERY_3_MONTHS", "Ogni 3 mesi"],
  ["EVERY_6_MONTHS", "Ogni 6 mesi"],
  ["YEARLY", "Annuale"],
  ["EVERY_2_YEARS", "Ogni 2 anni"],
];

const billingOptions = [
  ["SAME_MONTH", "Stesso mese"],
  ["NEXT_MONTH", "Mese successivo"],
];

function inputDefault(filters: Record<string, string | string[] | undefined>, key: string) {
  const value = filters[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function RecurringExpenseFiltersDrawer({ filters, categories, banks, paymentMethods }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.classList.add("drawer-open");
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("drawer-open");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <>
    <button className="btn btn-sm btn-default recurring-filter-trigger" type="button" onClick={() => setOpen(true)}>
      <span className="btn-icon"><FilterIcon /></span> <span className="recurring-filter-trigger-text">Filtri</span>
    </button>

    <div className={open ? "filter-drawer-backdrop is-open" : "filter-drawer-backdrop"} onMouseDown={() => setOpen(false)} aria-hidden={!open}>
      <aside className="filter-drawer-panel" role="dialog" aria-modal="true" aria-label="Filtri spese ricorrenti" onMouseDown={(event) => event.stopPropagation()}>
        <div className="filter-drawer-header">
          <div>
            <h3>Filtri spese ricorrenti</h3>
            <p className="muted">Cerca tra regole, fornitori, importi e modalità di pagamento.</p>
          </div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setOpen(false)}>×</button>
        </div>

        <form className="expense-filters recurring-drawer-filters" action="/recurring-expenses" method="get">
          <label>
            Fornitore / esercente
            <input name="merchant" defaultValue={inputDefault(filters, "merchant")} placeholder="Nome fornitore" />
          </label>

          <label>
            Descrizione
            <input name="description" defaultValue={inputDefault(filters, "description")} placeholder="Descrizione ricorrenza" />
          </label>

          <label>
            Categoria
            <select name="categoryId" defaultValue={inputDefault(filters, "categoryId")}>
              <option value="">Tutte</option>
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>

          <label>
            Stato
            <select name="isActive" defaultValue={inputDefault(filters, "isActive")}>
              <option value="">Tutte</option>
              <option value="true">Attive</option>
              <option value="false">Disattivate</option>
            </select>
          </label>

          <label>
            Cadenza
            <select name="cadence" defaultValue={inputDefault(filters, "cadence")}>
              <option value="">Tutte</option>
              {cadenceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>
            Periodo fatturazione
            <select name="billingPeriodMode" defaultValue={inputDefault(filters, "billingPeriodMode")}>
              <option value="">Tutti</option>
              {billingOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>
            Canale pagamento
            <select name="paymentChannel" defaultValue={inputDefault(filters, "paymentChannel")}>
              <option value="">Tutti</option>
              {paymentMethods.map(value => <option key={value.id} value={value.name}>{value.name}</option>)}
            </select>
          </label>

          <label>
            Banca
            <select name="bankId" defaultValue={inputDefault(filters, "bankId")}>
              <option value="">Tutte</option>
              {banks.map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
            </select>
          </label>

          <label>
            Importo minimo
            <input name="amountMin" inputMode="decimal" defaultValue={inputDefault(filters, "amountMin")} placeholder="0,00" />
          </label>

          <label>
            Importo massimo
            <input name="amountMax" inputMode="decimal" defaultValue={inputDefault(filters, "amountMax")} placeholder="500,00" />
          </label>

          <div className="filter-drawer-actions">
            <Link className="btn btn-md btn-default reset-button" href="/recurring-expenses" onClick={() => setOpen(false)}><span className="btn-icon">↺</span> Reset</Link>
            <button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">🔎</span> Filtra</button>
          </div>
        </form>
      </aside>
    </div>
  </>;
}
