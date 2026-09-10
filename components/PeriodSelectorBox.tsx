"use client";

import {useEffect, useState} from 'react';
import FilterIcon from '@/components/FilterIcon';
import {defaultQuickPeriod, periodOptions, quickPeriodButtons, quickPeriodTarget, quickPeriodLabel, isRollingPeriod} from '@/lib/period-selector';

type Props = {
  dateQuick: string;
  dateYear: string;
  useFiscalPeriodFilter?: boolean;
  inactivePeriodLabel?: string;
  companyNow: Date;
  label: string;
  years?: string[];
  onSelect: (value: string, year: string) => void;
  onOpenFilters: () => void;
};

export default function PeriodSelectorBox({dateQuick, dateYear, useFiscalPeriodFilter = false, inactivePeriodLabel, companyNow, label, years: availableYears, onSelect, onOpenFilters}: Props) {
  const [pendingQuickButton, setPendingQuickButton] = useState<string | null>(null);
  useEffect(() => setPendingQuickButton(null), [dateQuick, dateYear, inactivePeriodLabel]);
  const currentQuickValue = useFiscalPeriodFilter || inactivePeriodLabel ? '' : dateQuick || defaultQuickPeriod;
  const currentQuickYear = dateYear || String(companyNow.getFullYear());
  const years = Array.from(new Set([...(availableYears ?? Array.from({length: 8}, (_, index) => String(companyNow.getFullYear() - index))), currentQuickYear])).sort((a, b) => Number(b) - Number(a));
  return <div className="trend-selectors trend-selectors-switch" aria-label={label}>

    <span className="w100">Periodo</span>

    <label className="flex-grow">
      <div className="trend-selectors-heading">
        <select aria-label="Periodo" value={currentQuickValue} onChange={(event) => {
          if (event.currentTarget.value === "custom") {
            onOpenFilters();
            return;
          }
          onSelect(event.currentTarget.value, currentQuickYear);
        }}>
          {useFiscalPeriodFilter ? <option value="" disabled>Periodo fiscale dai filtri</option> : null}
          {inactivePeriodLabel && !useFiscalPeriodFilter ? <option value="" disabled>{inactivePeriodLabel}</option> : null}
          {periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Anno" value={currentQuickYear}
                disabled={useFiscalPeriodFilter || Boolean(inactivePeriodLabel) || currentQuickValue === 'custom' || isRollingPeriod(currentQuickValue)}
                onChange={(event) => onSelect(currentQuickValue, event.currentTarget.value)}>
          {years.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
    </label>
    <section className="trend-period-actions">
    <div className="trend-quick-date btn-group" role="group" aria-label="Scorciatoie periodo">
      {quickPeriodButtons.map((value) => {
          const target = quickPeriodTarget(value, companyNow);
          const label = quickPeriodLabel(value, companyNow);
        const isActive = currentQuickValue === target.value && (isRollingPeriod(target.value) || currentQuickYear === target.year);
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
            if (isActive) return;
            setPendingQuickButton(value);
            onSelect(target.value, target.year);
          }}
        >
          {pendingQuickButton === value
            ? <span className="trend-quick-loader" aria-hidden="true" />
            : label}
        </button>;
      })}
    </div>
      <button className="btn btn-sm btn-default app-filter-trigger trend-filter-trigger"
              type="button" onClick={onOpenFilters} aria-label="Filtri">
        <span className="btn-icon"><FilterIcon /></span><span className="app-filter-trigger-text">Filtri</span>
      </button>
    </section>
  </div>;
}
