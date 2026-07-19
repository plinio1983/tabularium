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
  ["year_to_date", "Anno intero"],
  ...monthQuickOptions,
  ...quarterQuickOptions,
  ["custom", "Data personalizzata"],
];

const quickBillingPeriodOptions = [
  ["year_to_date", "Anno intero"],
  ...monthQuickOptions,
  ...quarterQuickOptions,
  ["custom", "Periodo personalizzato"],
];

const quickDateButtons = [
  "current_month",
  "previous_month",
  "current_quarter",
  "previous_quarter",
  "year_to_date",
] as const;

const monthShortLabels = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

function currentMonthQuickValue() {
  return `month_${String(new Date().getMonth() + 1).padStart(2, "0")}`;
}

function currentYearValue() {
  return String(new Date().getFullYear());
}

function quickButtonLabel(value: (typeof quickDateButtons)[number]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3) + 1;

  if (value === "current_month") return monthShortLabels[currentMonth];
  if (value === "previous_month") return monthShortLabels[new Date(now.getFullYear(), currentMonth - 1, 1).getMonth()];
  if (value === "current_quarter") return `Tri ${currentQuarter}`;
  if (value === "previous_quarter") return `Tri ${currentQuarter > 1 ? currentQuarter - 1 : 4}`;
  return "Anno";
}

function quickButtonTarget(value: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3) + 1;

  if (value === "current_month") {
    return {
      value: `month_${String(currentMonth + 1).padStart(2, "0")}`,
      year: String(currentYear),
    };
  }

  if (value === "previous_month") {
    const previousMonth = new Date(currentYear, currentMonth - 1, 1);
    return {
      value: `month_${String(previousMonth.getMonth() + 1).padStart(2, "0")}`,
      year: String(previousMonth.getFullYear()),
    };
  }

  if (value === "current_quarter") {
    return {
      value: `quarter_${currentQuarter}`,
      year: String(currentYear),
    };
  }

  if (value === "previous_quarter") {
    const previousQuarter = currentQuarter - 1;
    return previousQuarter > 0
      ? { value: `quarter_${previousQuarter}`, year: String(currentYear) }
      : { value: "quarter_4", year: String(currentYear - 1) };
  }

  return {
    value,
    year: String(currentYear),
  };
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
    params.delete("billingPeriod");
    params.delete("billingPeriodQuick");
    params.delete("billingPeriodYear");
    params.delete("creditDateFrom");
    params.delete("creditDateTo");
    params.set("dateQuick", value || currentMonthQuickValue());
    params.set("dateYear", year || currentYearValue());
  } else {
    params.delete("creditDateFrom");
    params.delete("creditDateTo");
    params.delete("dateQuick");
    params.delete("dateYear");
    params.delete("billingPeriodFrom");
    params.delete("billingPeriodTo");
    params.delete("billingPeriod");
    params.set("billingPeriodQuick", value || currentMonthQuickValue());
    params.set("billingPeriodYear", year || currentYearValue());
  }

  const query = params.toString();
  window.location.href = query ? `/incomes?${query}` : "/incomes";
}

export default function IncomeTrendSelectors({ dateQuick, billingPeriodQuick, dateYear, billingPeriodYear, useFiscalPeriodFilter }: Props) {
  const [mode, setMode] = useState<"date" | "fiscal">(useFiscalPeriodFilter ? "fiscal" : "date");
  const [pendingQuickButton, setPendingQuickButton] = useState<string | null>(null);
  const andamentoComplessivoValue = !useFiscalPeriodFilter ? (dateQuick || currentMonthQuickValue()) : currentMonthQuickValue();
  const andamentoFiscaleValue = useFiscalPeriodFilter ? (billingPeriodQuick || currentMonthQuickValue()) : currentMonthQuickValue();
  const andamentoComplessivoYear = !useFiscalPeriodFilter ? (dateYear || currentYearValue()) : currentYearValue();
  const andamentoFiscaleYear = useFiscalPeriodFilter ? (billingPeriodYear || currentYearValue()) : currentYearValue();
  const currentQuickValue = mode === "date" ? andamentoComplessivoValue : andamentoFiscaleValue;
  const currentQuickYear = mode === "date" ? andamentoComplessivoYear : andamentoFiscaleYear;
  const years = yearOptions();

  function changeMode(nextMode: "date" | "fiscal") {
    setMode(nextMode);
    goWithQuick(nextMode, currentMonthQuickValue(), currentYearValue());
  }

  return <div className="expense-trend-selectors expense-trend-selectors-switch" aria-label="Selettori andamento incassi">
    <span className="w100">Andamento</span>
    <div className="expense-trend-mode-toggle" role="group" aria-label="Tipo andamento">
      <button type="button" className={mode === "date" ? "expense-trend-mode-button is-active" : "expense-trend-mode-button"} onClick={() => changeMode("date")}>
        Complessivo
      </button>
      <button type="button" className={mode === "fiscal" ? "expense-trend-mode-button is-active" : "expense-trend-mode-button"} onClick={() => changeMode("fiscal")}>
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
    <section>
      <div className="expense-trend-quick-date" role="group" aria-label="Scorciatoie periodo">
        {quickDateButtons.map((value) => {
          const target = quickButtonTarget(value);
          const label = quickButtonLabel(value);
          const isActive = currentQuickValue === target.value && currentQuickYear === target.year;
          return <button
            key={value}
            type="button"
            className={isActive ? "btn-xs btn-action btn-active expense-trend-quick-btn" : "btn-xs btn-action expense-trend-quick-btn"}
            aria-pressed={isActive}
            aria-label={pendingQuickButton === value ? `Caricamento ${label}` : label}
            disabled={pendingQuickButton !== null}
            onClick={() => {
              setPendingQuickButton(value);
              goWithQuick(mode, target.value, target.year);
            }}
          >
            {pendingQuickButton === value
              ? <span className="expense-trend-quick-loader" aria-hidden="true" />
              : label}
          </button>;
        })}
      </div>
    </section>
  </div>;
}
