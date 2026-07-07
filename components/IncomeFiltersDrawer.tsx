"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import FilterIcon from "@/components/FilterIcon";

type Props = {
  filters: Record<string, string | string[] | undefined>;
  quickDateFilter: string;
  creditDateFromDefault: string;
  creditDateToDefault: string;
  quickBillingPeriodFilter: string;
  billingPeriodFromFilter: string;
  billingPeriodToFilter: string;
  banks: { id: number; name: string }[];
  paymentMethods: { id: number; name: string }[];
};

const salesChannelOptions = ["Shop", "Online Shop", "Altro Canale"];
const saleCategoryOptions = ["B2C", "B2B", "Altro"];

const invoiceStatusOptions = [
  ["NON_INVIATA", "Non inviata"],
  ["EMESSA", "Emessa"],
  ["not_emitted", "Non emesse"],
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
  ["year_to_date", "Da inizio anno"],
  ...monthQuickOptions,
  ...quarterQuickOptions,
];

const quickBillingPeriodOptions = [
  ["year_to_date", "Da inizio anno"],
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
  if (value === "current_quarter") return { from: monthInputValue(year, currentQuarter * 3), to: monthInputValue(year, currentQuarter * 3 + 2) };
  if (value === "previous_quarter") return currentQuarter > 0
    ? { from: monthInputValue(year, (currentQuarter - 1) * 3), to: monthInputValue(year, (currentQuarter - 1) * 3 + 2) }
    : { from: monthInputValue(year - 1, 9), to: monthInputValue(year - 1, 11) };
  if (value === "year_to_date") return { from: monthInputValue(year, 0), to: monthInputValue(year, month) };
  return null;
}

function quickCreditDateRange(value: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentQuarter = Math.floor(month / 3);
  const monthMatch = value.match(/^month_(\d{2})$/);
  const quarterMatch = value.match(/^quarter_(\d)$/);
  const quarterRange = (targetYear: number, quarter: number) => ({
    from: dateInputValue(new Date(targetYear, quarter * 3, 1)),
    to: dateInputValue(new Date(targetYear, quarter * 3 + 3, 0)),
  });

  if (monthMatch) {
    const selectedMonth = Number(monthMatch[1]) - 1;
    return { from: dateInputValue(new Date(year, selectedMonth, 1)), to: dateInputValue(new Date(year, selectedMonth + 1, 0)) };
  }
  if (quarterMatch) return quarterRange(year, Number(quarterMatch[1]) - 1);
  if (value === "current_quarter") return quarterRange(year, currentQuarter);
  if (value === "previous_quarter") return currentQuarter > 0 ? quarterRange(year, currentQuarter - 1) : quarterRange(year - 1, 3);
  if (value === "year_to_date") return { from: dateInputValue(new Date(year, 0, 1)), to: dateInputValue(now) };
  return null;
}

export default function IncomeFiltersDrawer({
  filters,
  quickDateFilter,
  creditDateFromDefault,
  creditDateToDefault,
  quickBillingPeriodFilter,
  billingPeriodFromFilter,
  billingPeriodToFilter,
  banks,
  paymentMethods,
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
    const creditDateFrom = field("creditDateFrom");
    const creditDateTo = field("creditDateTo");

    const hasBillingPeriod = Boolean(billingPeriodFrom?.value || billingPeriodTo?.value);
    const hasCreditDate = Boolean(creditDateFrom?.value || creditDateTo?.value);

    if (hasBillingPeriod) {
      if (billingPeriodQuick) billingPeriodQuick.value = "";
      if (dateQuick) dateQuick.value = "";
      if (creditDateFrom) creditDateFrom.value = "";
      if (creditDateTo) creditDateTo.value = "";
    } else if (hasCreditDate) {
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
    const dateNames = ["dateQuick", "creditDateFrom", "creditDateTo"];

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
    clearFields(form, ["creditDateFrom", "creditDateTo", "dateQuick"]);
  }

  function handleCreditDateQuickChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const range = quickCreditDateRange(event.currentTarget.value);
    if (!range) return;
    const from = form.elements.namedItem("creditDateFrom") as HTMLInputElement | null;
    const to = form.elements.namedItem("creditDateTo") as HTMLInputElement | null;
    if (from) from.value = range.from;
    if (to) to.value = range.to;
    clearFields(form, ["billingPeriodFrom", "billingPeriodTo", "billingPeriodQuick"]);
  }

  function handleBillingPeriodInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    clearFields(form, ["billingPeriodQuick", "creditDateFrom", "creditDateTo", "dateQuick"]);
  }

  function handleCreditDateInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    clearFields(form, ["dateQuick", "billingPeriodFrom", "billingPeriodTo", "billingPeriodQuick"]);
  }

  const drawer = mounted ? createPortal(
    <div className={open ? "filter-drawer-backdrop is-open" : "filter-drawer-backdrop"} onMouseDown={() => setOpen(false)} aria-hidden={!open}>
      <aside className="filter-drawer-panel income-filter-drawer-panel" role="dialog" aria-modal="true" aria-label="Filtri incassi" onMouseDown={(event) => event.stopPropagation()}>
        <div className="filter-drawer-header">
          <div>
            <h3>Filtri incassi</h3>
            <p className="muted">Cerca per periodo, canale, metodo pagamento, fattura e IVA.</p>
          </div>
          <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setOpen(false)}>×</button>
        </div>

        <form className="expense-filters recurring-drawer-filters income-drawer-filters" action="/incomes" method="get" onSubmit={handleFiltersSubmit} onChange={handleFiltersChange}>
          <fieldset className="filter-group filter-group-fiscal">
            <legend>Periodo fiscale</legend>
            <label>Selezione rapida periodo<select id="incomeBillingPeriodQuick" name="billingPeriodQuick" defaultValue={quickBillingPeriodFilter} onChange={handleBillingQuickChange}>
              <option value="">Periodo personalizzato</option>
              {quickBillingPeriodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Periodo Fatt. da<input id="incomeBillingPeriodFrom" name="billingPeriodFrom" type="month" defaultValue={billingPeriodFromFilter} onChange={handleBillingPeriodInputChange} /></label>
            <label>Periodo Fatt. a<input id="incomeBillingPeriodTo" name="billingPeriodTo" type="month" defaultValue={billingPeriodToFilter} onChange={handleBillingPeriodInputChange} /></label>
          </fieldset>

          <fieldset className="filter-group filter-group-order-date">
            <legend>Date accredito</legend>
            <label>Selezione rapida periodo<select id="incomeDateQuick" name="dateQuick" defaultValue={quickDateFilter} onChange={handleCreditDateQuickChange}>
              <option value="">Periodo personalizzato</option>
              {quickDateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Data accredito da<input id="creditDateFrom" name="creditDateFrom" type="date" defaultValue={creditDateFromDefault} onChange={handleCreditDateInputChange} /></label>
            <label>Data accredito a<input id="creditDateTo" name="creditDateTo" type="date" defaultValue={creditDateToDefault} onChange={handleCreditDateInputChange} /></label>
          </fieldset>

          <label>Canale vendita<select name="salesChannel" defaultValue={inputDefault(filters, "salesChannel")}>
            <option value="">Tutti</option>
            {salesChannelOptions.map(value => <option key={value} value={value}>{value}</option>)}
          </select></label>

          <label>Categoria vendita<select name="saleCategory" defaultValue={inputDefault(filters, "saleCategory")}>
            <option value="">Tutte</option>
            {saleCategoryOptions.map(value => <option key={value} value={value}>{value}</option>)}
          </select></label>

          <label>Importo<input name="amount" inputMode="decimal" defaultValue={inputDefault(filters, "amount")} /></label>

          <label>Metodo pagamento<select name="paymentMethod" defaultValue={inputDefault(filters, "paymentMethod")}>
            <option value="">Tutti</option>
            {paymentMethods.map(value => <option key={value.id} value={value.name}>{value.name}</option>)}
          </select></label>

          <label>Canale accredito<select name="creditChannel" defaultValue={inputDefault(filters, "creditChannel")}>
            <option value="">Tutti</option>
            {banks.map(value => <option key={value.id} value={value.name}>{value.name}</option>)}
          </select></label>

          <label>Fiscale<select name="fiscal" defaultValue={inputDefault(filters, "fiscal")}>
            <option value="">Tutti</option>
            <option value="yes">Si</option>
            <option value="no">No</option>
          </select></label>

          <label>Stato fattura<select name="invoiceStatus" defaultValue={inputDefault(filters, "invoiceStatus") || inputDefault(filters, "invoiceStatusMode")}>
            <option value="">Tutti</option>
            {invoiceStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>

          <label>IVA<select name="vatRate" defaultValue={inputDefault(filters, "vatRate")}>
            <option value="">Tutte</option>
            <option value="0">0%</option>
            <option value="4">4%</option>
            <option value="10">10%</option>
            <option value="22">22%</option>
          </select></label>

          <div className="filter-drawer-actions">
            <Link className="btn btn-md btn-default reset-button" href="/incomes" onClick={() => setOpen(false)}><span className="btn-icon">↺</span> Reset</Link>
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
