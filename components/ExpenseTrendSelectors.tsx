"use client";

import { useState } from "react";

type Props = {
  dateQuick: string;
  billingPeriodQuick: string;
  useFiscalPeriodFilter: boolean;
};

const quickDateOptions = [
  ["this_month", "Questo Mese"],
  ["previous_month", "Mese precedente"],
  ["two_months_ago", "Due mesi fa"],
  ["current_quarter", "Trimestre in corso"],
  ["last_quarter", "Ultimo Trimestre"],
];

const quickBillingPeriodOptions = [
  ["this_month", "Questo Mese"],
  ["previous_month", "Mese precedente"],
  ["current_quarter", "Trimestre in corso"],
  ["previous_quarter", "Trimestre precedente"],
];

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
    params.set("dateQuick", value || "this_month");
  } else {
    params.delete("orderDateFrom");
    params.delete("orderDateTo");
    params.delete("dateQuick");
    params.delete("billingPeriodFrom");
    params.delete("billingPeriodTo");
    params.delete("period");
    params.set("billingPeriodQuick", value || "this_month");
  }

  const query = params.toString();
  window.location.href = query ? `/expenses?${query}` : "/expenses";
}

export default function ExpenseTrendSelectors({ dateQuick, billingPeriodQuick, useFiscalPeriodFilter }: Props) {
  const [mode, setMode] = useState<"date" | "fiscal">(useFiscalPeriodFilter ? "fiscal" : "date");
  const andamentoComplessivoValue = !useFiscalPeriodFilter ? (dateQuick || "this_month") : "this_month";
  const andamentoFiscaleValue = useFiscalPeriodFilter ? (billingPeriodQuick || "this_month") : "this_month";

  function changeMode(nextMode: "date" | "fiscal") {
    setMode(nextMode);
    goWithQuick(nextMode, "this_month");
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
      <select value={andamentoComplessivoValue} onChange={(event) => goWithQuick("date", event.currentTarget.value)}>
        {quickDateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label> : <label>
      <select value={andamentoFiscaleValue} onChange={(event) => goWithQuick("fiscal", event.currentTarget.value)}>
        {quickBillingPeriodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>}
  </div>;
}
