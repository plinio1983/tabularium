"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import FilterIcon from "@/components/FilterIcon";
import SupplierFilterInput from "@/components/SupplierFilterInput";

type CategoryOption = { id: number; code: string; name: string; icon?: string | null };

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
  ["year_to_date", "Anno intero"],
  ...monthQuickOptions,
  ...quarterQuickOptions,
];

const quickBillingPeriodOptions = [
  ["year_to_date", "Anno intero"],
  ...monthQuickOptions,
  ...quarterQuickOptions,
];

function inputDefault(filters: Record<string, string | string[] | undefined>, key: string) {
  const value = filters[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function monthInputValue(year: number, monthIndex: number) {
  const date = new Date(year, monthIndex, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function quickBillingPeriodRange(value: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentQuarter = Math.floor(month / 3);
  const monthMatch = value.match(/^month_(\d{2})$/);
  const quarterMatch = value.match(/^quarter_(\d)$/);

  if (monthMatch) {
    const selectedMonth = Number(monthMatch[1]) - 1;
    return { from: monthInputValue(year, selectedMonth), to: monthInputValue(year, selectedMonth) };
  }
  if (quarterMatch) {
    const quarter = Number(quarterMatch[1]) - 1;
    return { from: monthInputValue(year, quarter * 3), to: monthInputValue(year, quarter * 3 + 2) };
  }
  if (value === "year_to_date") return { from: monthInputValue(year, 0), to: monthInputValue(year, 11) };
  return null;
}

function quickOrderDateRange(value: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentQuarter = Math.floor(month / 3);
  const monthMatch = value.match(/^month_(\d{2})$/);
  const quarterMatch = value.match(/^quarter_(\d)$/);
  const quarterRange = (quarter: number) => ({
    from: dateInputValue(new Date(year, quarter * 3, 1)),
    to: dateInputValue(new Date(year, quarter * 3 + 3, 0)),
  });

  if (monthMatch) {
    const selectedMonth = Number(monthMatch[1]) - 1;
    return { from: dateInputValue(new Date(year, selectedMonth, 1)), to: dateInputValue(new Date(year, selectedMonth + 1, 0)) };
  }
  if (quarterMatch) return quarterRange(Number(quarterMatch[1]) - 1);
  if (value === "current_quarter") return quarterRange(currentQuarter);
  if (value === "previous_quarter") return currentQuarter > 0 ? quarterRange(currentQuarter - 1) : {
    from: dateInputValue(new Date(year - 1, 9, 1)),
    to: dateInputValue(new Date(year - 1, 12, 0)),
  };
  if (value === "year_to_date") return { from: dateInputValue(new Date(year, 0, 1)), to: dateInputValue(new Date(year, 11, 31)) };
  return null;
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

  function clearFields(form: HTMLFormElement, names: string[]) {
    names.forEach((name) => {
      const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      if (field) field.value = "";
    });
  }

  function handleFiltersChange(event: React.ChangeEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
    const form = event.currentTarget;
    const billingNames = ["billingPeriodQuick", "billingPeriodFrom", "billingPeriodTo"];
    const dateNames = ["dateQuick", "orderDateFrom", "orderDateTo"];

    if (billingNames.includes(target.name)) {
      clearFields(form, dateNames);
      if (target.name !== "billingPeriodQuick") clearFields(form, ["billingPeriodQuick"]);
    } else if (dateNames.includes(target.name)) {
      clearFields(form, billingNames);
      if (target.name !== "dateQuick") clearFields(form, ["dateQuick"]);
    }
  }

  function handleBillingQuickChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const range = quickBillingPeriodRange(event.currentTarget.value);
    if (!range) return;
    const from = form.elements.namedItem("billingPeriodFrom") as HTMLInputElement | null;
    const to = form.elements.namedItem("billingPeriodTo") as HTMLInputElement | null;
    if (from) from.value = range.from;
    if (to) to.value = range.to;
    clearFields(form, ["orderDateFrom", "orderDateTo", "dateQuick"]);
  }

  function handleOrderDateQuickChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const range = quickOrderDateRange(event.currentTarget.value);
    if (!range) return;
    const from = form.elements.namedItem("orderDateFrom") as HTMLInputElement | null;
    const to = form.elements.namedItem("orderDateTo") as HTMLInputElement | null;
    if (from) from.value = range.from;
    if (to) to.value = range.to;
    clearFields(form, ["billingPeriodFrom", "billingPeriodTo", "billingPeriodQuick"]);
  }

  function handleBillingPeriodInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    clearFields(form, ["billingPeriodQuick", "orderDateFrom", "orderDateTo", "dateQuick"]);
  }

  function handleOrderDateInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    clearFields(form, ["dateQuick", "billingPeriodFrom", "billingPeriodTo", "billingPeriodQuick"]);
  }

  const drawer = mounted ? createPortal(
    <div className={open ? "filter-drawer-backdrop is-open" : "filter-drawer-backdrop"} onMouseDown={() => setOpen(false)} aria-hidden={!open}>
      <aside className="filter-drawer-panel expense-filter-drawer-panel" role="dialog" aria-modal="true" aria-label="Filtri spese" onMouseDown={(event) => event.stopPropagation()}>
        <div className="filter-drawer-header">
          <div>
            <h3>Filtri spese</h3>
            {/*<p className="muted">Cerca per periodo, fornitore, stato pagamento, fattura e importo.</p>*/}
          </div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setOpen(false)}>×</button>
        </div>

        <form className="expense-filters recurring-drawer-filters expense-drawer-filters" action="/expenses" method="get" onSubmit={handleFiltersSubmit} onChange={handleFiltersChange}>
          <fieldset className="filter-group filter-group-fiscal">
            <legend>Periodo fiscale</legend>
            <label>Periodo fiscale rapido<select id="billingPeriodQuick" name="billingPeriodQuick" defaultValue={quickBillingPeriodFilter} onChange={handleBillingQuickChange}>
              <option value="">Periodo personalizzato</option>
              {quickBillingPeriodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Periodo Fatt. da<input id="billingPeriodFrom" name="billingPeriodFrom" type="month" defaultValue={billingPeriodFromFilter} onChange={handleBillingPeriodInputChange} /></label>
            <label>Periodo Fatt. a<input id="billingPeriodTo" name="billingPeriodTo" type="month" defaultValue={billingPeriodToFilter} onChange={handleBillingPeriodInputChange} /></label>
          </fieldset>

          <fieldset className="filter-group filter-group-order-date">
            <legend>Date ordine</legend>
            <label>Selezione rapida data<select id="dateQuick" name="dateQuick" defaultValue={quickDateFilter} onChange={handleOrderDateQuickChange}>
              <option value="">Periodo personalizzato</option>
              {quickDateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Data ordine da<input id="orderDateFrom" name="orderDateFrom" type="date" defaultValue={orderDateFromDefault} onChange={handleOrderDateInputChange} /></label>
            <label>Data ordine a<input id="orderDateTo" name="orderDateTo" type="date" defaultValue={orderDateToDefault} onChange={handleOrderDateInputChange} /></label>
          </fieldset>

          <label>Categoria<select name="category" defaultValue={inputDefault(filters, "category")}>
            <option value="">Tutte</option>
            {categories.map(category => <option key={category.id} value={category.name}>{category.code} - {category.name}</option>)}
          </select></label>

          <label>Tipo spesa<select name="expenseType" defaultValue={inputDefault(filters, "expenseType")}>
            <option value="">Tutte</option>
            <option value="single">Singola</option>
            <option value="recurring">Ricorrente</option>
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
            <Link className="btn btn-md btn-default reset-button" href="/expenses" onClick={() => setOpen(false)}><span className="btn-icon">↺</span> Reset</Link>
            <button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">🔎</span> Filtra</button>
          </div>
        </form>
      </aside>
    </div>,
    document.body
  ) : null;

  return <>
    <button className="btn btn-sm btn-default recurring-filter-trigger" type="button" onClick={() => setOpen(true)}>
      <span className="btn-icon"><FilterIcon /></span> <span className="recurring-filter-trigger-text">Filtri</span>
    </button>
    {drawer}
  </>;
}
