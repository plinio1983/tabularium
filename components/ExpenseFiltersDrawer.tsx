"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import SupplierFilterInput from "@/components/SupplierFilterInput";

type CategoryOption = { id: number; code: string; name: string };

type Props = {
  filters: Record<string, string | string[] | undefined>;
  categories: CategoryOption[];
  quickDateFilter: string;
  orderDateFromDefault: string;
  orderDateToDefault: string;
  quickBillingPeriodFilter: string;
  billingPeriodFromFilter: string;
  billingPeriodToFilter: string;
};

const paymentStatusOptions = [
  ["overdue", "Scaduto"],
  ["DA_PAGARE", "Non pagato"],
  ["COMPLETATO", "Completato"],
  ["PAGATO_PARZIALMENTE", "Pagato parzialmente"],
];

const invoiceStatusOptions = [
  ["NON_PREVISTA", "Non prevista"],
  ["IN_ATTESA", "In attesa"],
  ["CONTESTAZIONE", "Contestazione"],
  ["RICEVUTA", "Emessa"],
];

const monthQuickOptions = [
  ["month_01", "Gennaio"],
  ["month_02", "Febbraio"],
  ["month_03", "Marzo"],
  ["month_04", "Aprile"],
  ["month_05", "Maggio"],
  ["month_06", "Giugno"],
  ["month_07", "Luglio"],
  ["month_08", "Agosto"],
  ["month_09", "Settembre"],
  ["month_10", "Ottobre"],
  ["month_11", "Novembre"],
  ["month_12", "Dicembre"],
];

const quarterQuickOptions = [
  ["quarter_1", "T.1 [ Gen - Mar ]"],
  ["quarter_2", "T.2 [ Apr - Giu ]"],
  ["quarter_3", "T.3 [ Lug - Set ]"],
  ["quarter_4", "T.4 [ Ott - Dic ]"],
];

const quickDateOptions = [
  ...monthQuickOptions,
  ...quarterQuickOptions,
];

const quickBillingPeriodOptions = [
  ...monthQuickOptions,
  ...quarterQuickOptions,
];

function inputDefault(filters: Record<string, string | string[] | undefined>, key: string) {
  const value = filters[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function ExpenseFiltersDrawer({
  filters,
  categories,
  quickDateFilter,
  orderDateFromDefault,
  orderDateToDefault,
  quickBillingPeriodFilter,
  billingPeriodFromFilter,
  billingPeriodToFilter,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  function handleFiltersSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;

    const billingPeriodQuick = field("billingPeriodQuick");
    const billingPeriodFrom = field("billingPeriodFrom");
    const billingPeriodTo = field("billingPeriodTo");
    const dateQuick = field("dateQuick");
    const orderDateFrom = field("orderDateFrom");
    const orderDateTo = field("orderDateTo");

    const hasBillingPeriod = Boolean(billingPeriodFrom?.value || billingPeriodTo?.value);
    const hasOrderDate = Boolean(orderDateFrom?.value || orderDateTo?.value);

    if (hasBillingPeriod) {
      if (billingPeriodQuick) billingPeriodQuick.value = "";
      if (dateQuick) dateQuick.value = "";
      if (orderDateFrom) orderDateFrom.value = "";
      if (orderDateTo) orderDateTo.value = "";
    } else if (hasOrderDate) {
      if (dateQuick) dateQuick.value = "";
      if (billingPeriodQuick) billingPeriodQuick.value = "";
      if (billingPeriodFrom) billingPeriodFrom.value = "";
      if (billingPeriodTo) billingPeriodTo.value = "";
    }
  }

  const drawer = mounted ? createPortal(
    <div className={open ? "filter-drawer-backdrop is-open" : "filter-drawer-backdrop"} onMouseDown={() => setOpen(false)} aria-hidden={!open}>
      <aside className="filter-drawer-panel expense-filter-drawer-panel" role="dialog" aria-modal="true" aria-label="Filtri spese" onMouseDown={(event) => event.stopPropagation()}>
        <div className="filter-drawer-header">
          <div>
            <h3>Filtri spese</h3>
            <p className="muted">Cerca per periodo, fornitore, stato pagamento, fattura e importo.</p>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={() => setOpen(false)}>×</button>
        </div>

        <form className="expense-filters recurring-drawer-filters expense-drawer-filters" action="/expenses" method="get" onSubmit={handleFiltersSubmit}>
          <fieldset className="filter-group filter-group-fiscal">
            <legend>Periodo fiscale</legend>
            <label>Periodo fiscale rapido<select id="billingPeriodQuick" name="billingPeriodQuick" defaultValue={quickBillingPeriodFilter}>
              <option value="">Periodo personalizzato</option>
              {quickBillingPeriodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Periodo Fatt. da<input id="billingPeriodFrom" name="billingPeriodFrom" type="month" defaultValue={billingPeriodFromFilter} /></label>
            <label>Periodo Fatt. a<input id="billingPeriodTo" name="billingPeriodTo" type="month" defaultValue={billingPeriodToFilter} /></label>
          </fieldset>

          <fieldset className="filter-group filter-group-order-date">
            <legend>Date ordine</legend>
            <label>Selezione rapida data<select id="dateQuick" name="dateQuick" defaultValue={quickDateFilter}>
              <option value="">Periodo personalizzato</option>
              {quickDateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Data ordine da<input id="orderDateFrom" name="orderDateFrom" type="date" defaultValue={orderDateFromDefault} /></label>
            <label>Data ordine a<input id="orderDateTo" name="orderDateTo" type="date" defaultValue={orderDateToDefault} /></label>
          </fieldset>

          <label>Categoria<select name="category" defaultValue={inputDefault(filters, "category")}>
            <option value="">Tutte</option>
            {categories.map(category => <option key={category.id} value={category.name}>{category.code} - {category.name}</option>)}
          </select></label>

          <SupplierFilterInput initialValue={inputDefault(filters, "merchant")} />
          <label>Descrizione<input name="product" defaultValue={inputDefault(filters, "product")} /></label>
          <label>Importo<input name="amount" inputMode="decimal" defaultValue={inputDefault(filters, "amount")} /></label>

          <label>Stato Pagamento<select name="paymentStatus" defaultValue={inputDefault(filters, "paymentStatus")}>
            <option value="">Tutti</option>
            {paymentStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>

          <label>Residuo<select name="residual" defaultValue={inputDefault(filters, "residual")}>
            <option value="">Tutti</option>
            <option value="open">Con residuo</option>
            <option value="closed">Saldato</option>
          </select></label>

          <label>Fattura Elettronica<select name="electronicInvoice" defaultValue={inputDefault(filters, "electronicInvoice")}>
            <option value="">Tutte</option>
            <option value="yes">Si</option>
            <option value="no">No</option>
          </select></label>

          <label>Stato Fattura<select name="invoiceStatus" defaultValue={inputDefault(filters, "invoiceStatus") || inputDefault(filters, "invoiceStatusMode")}>
            <option value="">Tutti</option>
            {invoiceStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>

          <label>Detrazione<select name="declared" defaultValue={inputDefault(filters, "declared")}>
            <option value="">Tutte</option>
            <option value="yes">Si</option>
            <option value="no">No</option>
          </select></label>

          <label>Allegati<select name="attachments" defaultValue={inputDefault(filters, "attachments")}>
            <option value="">Tutti</option>
            <option value="with">Con allegati</option>
            <option value="without">Senza allegati</option>
          </select></label>

          <div className="filter-drawer-actions">
            <Link className="button-standard secondary-button reset-button" href="/expenses" onClick={() => setOpen(false)}><span className="btn-icon">↺</span> Reset</Link>
            <button className="button-standard primary-action" type="submit"><span className="btn-icon">🔎</span> Filtra</button>
          </div>
        </form>
      </aside>
    </div>,
    document.body
  ) : null;

  return <>
    <button className="button-standard secondary-button recurring-filter-trigger" type="button" onClick={() => setOpen(true)}>
      <span className="btn-icon">☰</span> <span className="recurring-filter-trigger-text">Filtri</span>
    </button>
    {drawer}
  </>;
}
