"use client";

import { useState } from "react";
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {civilDateInTimeZone} from '@/lib/company-time';

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

function currentMonthQuickValue(now: Date) {
  return `month_${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function currentYearValue(now: Date) {
  return String(now.getFullYear());
}

function quickButtonLabel(value: (typeof quickDateButtons)[number], now: Date) {
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3) + 1;

  if (value === "current_month") return monthShortLabels[currentMonth];
  if (value === "previous_month") return monthShortLabels[new Date(now.getFullYear(), currentMonth - 1, 1).getMonth()];
  if (value === "current_quarter") return `Tri ${currentQuarter}`;
  if (value === "previous_quarter") return `Tri ${currentQuarter > 1 ? currentQuarter - 1 : 4}`;
  return "Anno";
}

function quickButtonTarget(value: string, now: Date) {
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

function yearOptions(now: Date) {
  const currentYear = now.getFullYear();
  return Array.from({ length: 8 }, (_, index) => String(currentYear - index));
}

function openFiltersDrawer() {
  const trigger = document.querySelector<HTMLButtonElement>(".app-filter-trigger");
  if (trigger) trigger.click();
}

function goWithQuick(type: "date" | "fiscal", value: string, year: string, now: Date) {
  const params = new URLSearchParams(window.location.search);
  params.delete("new");

  if (type === "date") {
    params.delete("creditDateFrom");
    params.delete("creditDateTo");
    params.set("dateQuick", value || currentMonthQuickValue(now));
    params.set("dateYear", year || currentYearValue(now));
    params.set("view", "andamento");
  } else {
    params.delete("billingPeriodFrom");
    params.delete("billingPeriodTo");
    params.delete("billingPeriod");
    params.set("billingPeriodQuick", value || currentMonthQuickValue(now));
    params.set("billingPeriodYear", year || currentYearValue(now));
    params.set("view", "fiscale");
  }

  const query = params.toString();
  window.location.href = query ? `/incomes?${query}` : "/incomes";
}

export default function IncomeTrendSelectors({ dateQuick, billingPeriodQuick, dateYear, billingPeriodYear, useFiscalPeriodFilter }: Props) {
  const timeZone = useCompanyTimeZone();
  const companyNow = civilDateInTimeZone(timeZone);
  const [mode, setMode] = useState<"date" | "fiscal">(useFiscalPeriodFilter ? "fiscal" : "date");
  const [pendingQuickButton, setPendingQuickButton] = useState<string | null>(null);
  const andamentoComplessivoValue = dateQuick || currentMonthQuickValue(companyNow);
  const andamentoFiscaleValue = billingPeriodQuick || currentMonthQuickValue(companyNow);
  const andamentoComplessivoYear = dateYear || currentYearValue(companyNow);
  const andamentoFiscaleYear = billingPeriodYear || currentYearValue(companyNow);
  const currentQuickValue = mode === "date" ? andamentoComplessivoValue : andamentoFiscaleValue;
  const currentQuickYear = mode === "date" ? andamentoComplessivoYear : andamentoFiscaleYear;
  const years = yearOptions(companyNow);

  function changeMode(nextMode: "date" | "fiscal") {
    goWithQuick(nextMode, currentQuickValue, currentQuickYear, companyNow);
  }

  return <div className="trend-selectors trend-selectors-switch" aria-label="Selettori andamento incassi">
    <span className="w100">Andamento</span>
    <div className="trend-mode-toggle" role="group" aria-label="Tipo andamento">
      <button type="button" className={mode === "date" ? "trend-mode-button is-active" : "trend-mode-button"} onClick={() => changeMode("date")}>
        Andamento
      </button>
      <button type="button" className={mode === "fiscal" ? "trend-mode-button is-active" : "trend-mode-button"} onClick={() => changeMode("fiscal")}>
        Fiscale
      </button>
    </div>

    {mode === "date" ? <label>
      <div className="trend-selectors-heading">
        <select value={andamentoComplessivoValue} onChange={(event) => {
          if (event.currentTarget.value === "custom") {
            openFiltersDrawer();
            return;
          }
          goWithQuick("date", event.currentTarget.value, andamentoComplessivoYear, companyNow);
        }}>
          {quickDateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={andamentoComplessivoYear} onChange={(event) => goWithQuick("date", andamentoComplessivoValue, event.currentTarget.value, companyNow)}>
          {years.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
    </label> : <label>
      <div className="trend-selectors-heading">
        <select value={andamentoFiscaleValue} onChange={(event) => {
          if (event.currentTarget.value === "custom") {
            openFiltersDrawer();
            return;
          }
          goWithQuick("fiscal", event.currentTarget.value, andamentoFiscaleYear, companyNow);
        }}>
          {quickBillingPeriodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={andamentoFiscaleYear} onChange={(event) => goWithQuick("fiscal", andamentoFiscaleValue, event.currentTarget.value, companyNow)}>
          {years.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
    </label>}
    <section>
      <div className="trend-quick-date btn-group" role="group" aria-label="Scorciatoie periodo">
        {quickDateButtons.map((value) => {
          const target = quickButtonTarget(value, companyNow);
          const label = quickButtonLabel(value, companyNow);
          const isActive = currentQuickValue === target.value && currentQuickYear === target.year;
          return <button
            key={value}
            type="button"
            className={isActive ? "btn-xs btn-action btn-active trend-quick-btn" : "btn-xs btn-action trend-quick-btn"}
            aria-pressed={isActive}
            aria-label={pendingQuickButton === value ? `Caricamento ${label}` : label}
            disabled={pendingQuickButton !== null}
            onClick={() => {
              setPendingQuickButton(value);
              goWithQuick(mode, target.value, target.year, companyNow);
            }}
          >
            {pendingQuickButton === value
              ? <span className="trend-quick-loader" aria-hidden="true" />
              : label}
          </button>;
        })}
      </div>
    </section>
  </div>;
}
