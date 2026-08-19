"use client";

import { useState } from "react";
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {civilDateInTimeZone} from '@/lib/company-time';

type Props = {
  dateQuick: string;
  dateYear: string;
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
  ["last_30_days", "Ultimi 30 giorni"],
  ["last_90_days", "Ultimi 90 giorni"],
  ["year_to_date", "Anno intero"],
  ...monthQuickOptions,
  ...quarterQuickOptions,
  ["custom", "Data personalizzata"],
];

const quickDateButtons = [
  "last_30_days",
  "last_90_days",
  "current_quarter",
  "previous_quarter",
  "year_to_date",
] as const;

const defaultQuickValue = "last_90_days";

function isRollingQuickValue(value: string) {
  return value === "last_30_days" || value === "last_90_days";
}

function currentYearValue(now: Date) {
  return String(now.getFullYear());
}

function quickButtonLabel(value: (typeof quickDateButtons)[number], now: Date) {
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3) + 1;

  if (value === "last_30_days") return "30 gg";
  if (value === "last_90_days") return "90 gg";
  if (value === "current_quarter") return `Tri ${currentQuarter}`;
  if (value === "previous_quarter") return `Tri ${currentQuarter > 1 ? currentQuarter - 1 : 4}`;
  return "Anno";
}

function quickButtonTarget(value: string, now: Date) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3) + 1;

  if (value === "last_30_days" || value === "last_90_days") {
    return { value, year: String(currentYear) };
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

function goWithQuick(value: string, year: string, now: Date) {
  const params = new URLSearchParams(window.location.search);
  params.delete("new");

  params.delete("creditDateFrom");
  params.delete("creditDateTo");
  params.delete("billingPeriodFrom");
  params.delete("billingPeriodTo");
  params.delete("billingPeriodQuick");
  params.delete("billingPeriodYear");
  params.delete("billingPeriod");
  params.set("dateQuick", value || defaultQuickValue);
  params.set("dateYear", year || currentYearValue(now));
  params.set("view", "andamento");

  const query = params.toString();
  window.location.href = query ? `/incomes?${query}` : "/incomes";
}

export default function IncomeTrendSelectors({ dateQuick, dateYear, useFiscalPeriodFilter }: Props) {
  const timeZone = useCompanyTimeZone();
  const companyNow = civilDateInTimeZone(timeZone);
  const [pendingQuickButton, setPendingQuickButton] = useState<string | null>(null);
  const currentQuickValue = useFiscalPeriodFilter ? "" : dateQuick || defaultQuickValue;
  const currentQuickYear = dateYear || currentYearValue(companyNow);
  const years = yearOptions(companyNow);

  return <div className="trend-selectors trend-selectors-switch" aria-label="Selettori andamento incassi">
    <span className="w100">Periodo</span>
    <label>
      <div className="trend-selectors-heading">
        <select value={currentQuickValue} onChange={(event) => {
          if (event.currentTarget.value === "custom") {
            openFiltersDrawer();
            return;
          }
          goWithQuick(event.currentTarget.value, currentQuickYear, companyNow);
        }}>
          {useFiscalPeriodFilter ? <option value="" disabled>Periodo fiscale dai filtri</option> : null}
          {quickDateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={currentQuickYear} disabled={useFiscalPeriodFilter || isRollingQuickValue(currentQuickValue)} onChange={(event) => goWithQuick(currentQuickValue, event.currentTarget.value, companyNow)}>
          {years.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
    </label>
    <section>
      <div className="trend-quick-date btn-group" role="group" aria-label="Scorciatoie periodo">
        {quickDateButtons.map((value) => {
          const target = quickButtonTarget(value, companyNow);
          const label = quickButtonLabel(value, companyNow);
          const isActive = currentQuickValue === target.value && (isRollingQuickValue(target.value) || currentQuickYear === target.year);
          const accessibleLabel = value === "current_quarter" ? `Trimestre in corso, ${label}` : value === "previous_quarter" ? `Ultimo trimestre concluso, ${label}` : label;
          return <button
            key={value}
            type="button"
            className={isActive ? "btn-xs btn-action btn-active trend-quick-btn" : "btn-xs btn-action trend-quick-btn"}
            aria-pressed={isActive}
            aria-label={pendingQuickButton === value ? `Caricamento ${accessibleLabel}` : accessibleLabel}
            title={accessibleLabel}
            disabled={pendingQuickButton !== null}
            onClick={() => {
              setPendingQuickButton(value);
              goWithQuick(target.value, target.year, companyNow);
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
