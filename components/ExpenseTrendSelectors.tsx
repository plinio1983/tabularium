"use client";

import { useState } from "react";

type Props = {
  dateQuick: string;
  billingPeriodQuick: string;
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

function openFiltersDrawer() {
  const trigger = document.querySelector<HTMLButtonElement>(".recurring-filter-trigger");
  if (trigger) trigger.click();
}

function goWithQuick(type: "date" | "fiscal", value: string) {
  const params = new URLSearchParams(window.location.search);
  params.delete("new");

  if (type === "date") {
    params.delete("billingPeriodFrom");
    params.delete("billingPeriodTo");
    params.delete("billingPeriodQuick");
    params.delete("period");
    params.delete("orderDateFrom");
    params.delete("orderDateTo");
    params.set("dateQuick", value || currentMonthQuickValue());
  } else {
    params.delete("orderDateFrom");
    params.delete("orderDateTo");
    params.delete("dateQuick");
    params.delete("billingPeriodFrom");
    params.delete("billingPeriodTo");
    params.delete("period");
    params.set("billingPeriodQuick", value || currentMonthQuickValue());
  }

  const query = params.toString();
  window.location.href = query ? `/expenses?${query}` : "/expenses";
}

export default function ExpenseTrendSelectors({ dateQuick, billingPeriodQuick, useFiscalPeriodFilter }: Props) {
  const [mode, setMode] = useState<"date" | "fiscal">(useFiscalPeriodFilter ? "fiscal" : "date");
  const andamentoComplessivoValue = !useFiscalPeriodFilter ? (dateQuick || currentMonthQuickValue()) : currentMonthQuickValue();
  const andamentoFiscaleValue = useFiscalPeriodFilter ? (billingPeriodQuick || currentMonthQuickValue()) : currentMonthQuickValue();

  function changeMode(nextMode: "date" | "fiscal") {
    setMode(nextMode);
    goWithQuick(nextMode, currentMonthQuickValue());
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
      <select value={andamentoComplessivoValue} onChange={(event) => {
        if (event.currentTarget.value === "custom") {
          openFiltersDrawer();
          return;
        }
        goWithQuick("date", event.currentTarget.value);
      }}>
        {quickDateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label> : <label>
      <select value={andamentoFiscaleValue} onChange={(event) => {
        if (event.currentTarget.value === "custom") {
          openFiltersDrawer();
          return;
        }
        goWithQuick("fiscal", event.currentTarget.value);
      }}>
        {quickBillingPeriodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>}
  </div>;
}
