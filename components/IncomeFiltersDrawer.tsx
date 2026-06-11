"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

type Props = {
  filters: Record<string, string | string[] | undefined>;
  quickDateFilter: string;
  creditDateFromDefault: string;
  creditDateToDefault: string;
  quickBillingPeriodFilter: string;
  billingPeriodFromFilter: string;
  billingPeriodToFilter: string;
};

const salesChannelOptions = ["Shop", "Online Shop", "Altro Canale"];
const saleCategoryOptions = ["B2C", "B2B", "Altro"];
const paymentMethodOptions = ["Bonifico", "Carta di Debito/Credito", "Criptovaluta", "Stripe", "Cash"];
const creditChannelOptions = ["Cash", "Unicredit", "MyTu", "Wise"];

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

export default function IncomeFiltersDrawer({
  filters,
  quickDateFilter,
  creditDateFromDefault,
  creditDateToDefault,
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

  const drawer = mounted ? createPortal(
    <div className={open ? "filter-drawer-backdrop is-open" : "filter-drawer-backdrop"} onMouseDown={() => setOpen(false)} aria-hidden={!open}>
      <aside className="filter-drawer-panel income-filter-drawer-panel" role="dialog" aria-modal="true" aria-label="Filtri incassi" onMouseDown={(event) => event.stopPropagation()}>
        <div className="filter-drawer-header">
          <div>
            <h3>Filtri incassi</h3>
            <p className="muted">Cerca per periodo, canale, metodo pagamento, fattura e IVA.</p>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={() => setOpen(false)}>×</button>
        </div>

        <form className="expense-filters recurring-drawer-filters income-drawer-filters" action="/incomes" method="get" onSubmit={handleFiltersSubmit}>
          <fieldset className="filter-group filter-group-fiscal">
            <legend>Periodo fiscale</legend>
            <label>Periodo Fatt. da<input id="incomeBillingPeriodFrom" name="billingPeriodFrom" type="month" defaultValue={billingPeriodFromFilter} /></label>
            <label>Periodo Fatt. a<input id="incomeBillingPeriodTo" name="billingPeriodTo" type="month" defaultValue={billingPeriodToFilter} /></label>
            <label>Periodo fiscale rapido<select id="incomeBillingPeriodQuick" name="billingPeriodQuick" defaultValue={quickBillingPeriodFilter}>
              <option value="">Periodo personalizzato</option>
              {quickBillingPeriodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
          </fieldset>

          <fieldset className="filter-group filter-group-order-date">
            <legend>Date accredito</legend>
            <label>Data accredito da<input id="creditDateFrom" name="creditDateFrom" type="date" defaultValue={creditDateFromDefault} /></label>
            <label>Data accredito a<input id="creditDateTo" name="creditDateTo" type="date" defaultValue={creditDateToDefault} /></label>
            <label>Selezione rapida data<select id="incomeDateQuick" name="dateQuick" defaultValue={quickDateFilter}>
              <option value="">Periodo personalizzato</option>
              {quickDateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
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
            {paymentMethodOptions.map(value => <option key={value} value={value}>{value}</option>)}
          </select></label>

          <label>Canale accredito<select name="creditChannel" defaultValue={inputDefault(filters, "creditChannel")}>
            <option value="">Tutti</option>
            {creditChannelOptions.map(value => <option key={value} value={value}>{value}</option>)}
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
            <Link className="button-standard secondary-button reset-button" href="/incomes" onClick={() => setOpen(false)}><span className="btn-icon">↺</span> Reset</Link>
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
