"use client";

import { useState } from "react";

type Props = {
  dateQuick: string;
  billingPeriodQuick: string;
  dateYear: string;
  billingPeriodYear: string;
  useFiscalPeriodFilter: boolean;
};

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
  ["custom", "Data personalizzata"],
];

const quickBillingPeriodOptions = [
  ...monthQuickOptions,
  ...quarterQuickOptions,
  ["custom", "Periodo personalizzato"],
];

function currentMonthQuickValue() {
  return `month_${String(new Date().getMonth() + 1).padStart(2, "0")}`;
}

function currentYearValue() {
  return String(new Date().getFullYear());
}

function yearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, index) => String(currentYear - index));
}

function openFiltersDrawer() {
  const trigger = document.querySelector<HTMLButtonElement>(".recurring-filter-trigger");
  if (trigger) trigger.click();
}

function goWithQuick(type: "date" | "fiscal", value: string, year: string) {
  const params = new URLSearchParams(window.location.search);
  params.delete("new");

  if (type === "date") {
    params.delete("billingPeriodFrom");
    params.delete("billingPeriodTo");
    params.delete("billingPeriodQuick");
    params.delete("billingPeriodYear");
    params.delete("period");
    params.delete("orderDateFrom");
    params.delete("orderDateTo");
    params.set("dateQuick", value || currentMonthQuickValue());
    params.set("dateYear", year || currentYearValue());
  } else {
    params.delete("orderDateFrom");
    params.delete("orderDateTo");
    params.delete("dateQuick");
    params.delete("dateYear");
    params.delete("billingPeriodFrom");
    params.delete("billingPeriodTo");
    params.delete("period");
    params.set("billingPeriodQuick", value || currentMonthQuickValue());
    params.set("billingPeriodYear", year || currentYearValue());
  }

  const query = params.toString();
  window.location.href = query ? `/expenses?${query}` : "/expenses";
}

export default function ExpenseTrendSelectors({ dateQuick, billingPeriodQuick, dateYear, billingPeriodYear, useFiscalPeriodFilter }: Props) {
  const [mode, setMode] = useState<"date" | "fiscal">(useFiscalPeriodFilter ? "fiscal" : "date");
  const andamentoComplessivoValue = !useFiscalPeriodFilter ? (dateQuick || currentMonthQuickValue()) : currentMonthQuickValue();
  const andamentoFiscaleValue = useFiscalPeriodFilter ? (billingPeriodQuick || currentMonthQuickValue()) : currentMonthQuickValue();
  const andamentoComplessivoYear = !useFiscalPeriodFilter ? (dateYear || currentYearValue()) : currentYearValue();
  const andamentoFiscaleYear = useFiscalPeriodFilter ? (billingPeriodYear || currentYearValue()) : currentYearValue();
  const years = yearOptions();

  function changeMode(nextMode: "date" | "fiscal") {
    setMode(nextMode);
    goWithQuick(nextMode, currentMonthQuickValue(), currentYearValue());
  }

  return <div className="expense-trend-selectors expense-trend-selectors-switch" aria-label="Selettori andamento spese">

      <span>Andamento</span>

    <div className="expense-trend-mode-toggle" role="group" aria-label="Tipo andamento">
      <button
        type="button"
        className={mode === "date" ? "expense-trend-mode-button is-active" : "expense-trend-mode-button"}
        onClick={() => changeMode("date")}
      >
        Complessivo
      </button>
      <button
        type="button"
        className={mode === "fiscal" ? "expense-trend-mode-button is-active" : "expense-trend-mode-button"}
        onClick={() => changeMode("fiscal")}
      >
        Fiscale
      </button>
    </div>

    {mode === "date" ? <label>
      <div className="expense-trend-selectors-heading">
        <select value={andamentoComplessivoValue} onChange={(event) => {
          if (event.currentTarget.value === "custom") {
            openFiltersDrawer();
            return;
          }
          goWithQuick("date", event.currentTarget.value, andamentoComplessivoYear);
        }}>
          {quickDateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={andamentoComplessivoYear} onChange={(event) => goWithQuick("date", andamentoComplessivoValue, event.currentTarget.value)}>
          {years.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
    </label> : <label>
      <div className="expense-trend-selectors-heading">
        <select value={andamentoFiscaleValue} onChange={(event) => {
          if (event.currentTarget.value === "custom") {
            openFiltersDrawer();
            return;
          }
          goWithQuick("fiscal", event.currentTarget.value, andamentoFiscaleYear);
        }}>
          {quickBillingPeriodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={andamentoFiscaleYear} onChange={(event) => goWithQuick("fiscal", andamentoFiscaleValue, event.currentTarget.value)}>
          {years.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
    </label>}
  </div>;
}
