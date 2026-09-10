"use client";

import PeriodSelectorBox from '@/components/PeriodSelectorBox';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {civilDateInTimeZone} from '@/lib/company-time';
import {defaultQuickPeriod} from '@/lib/period-selector';

type Props = {dateQuick: string; dateYear: string; useFiscalPeriodFilter: boolean};

function openFiltersDrawer() {
  const trigger = document.querySelector<HTMLButtonElement>('[data-period-filter-source="expense"]');
  if (trigger) trigger.click();
}

function goWithQuick(value: string, year: string, now: Date) {
  const params = new URLSearchParams(window.location.search);
  params.delete("new");
  params.delete("orderDateFrom");
  params.delete("orderDateTo");
  params.delete("billingPeriodFrom");
  params.delete("billingPeriodTo");
  params.delete("billingPeriodQuick");
  params.delete("billingPeriodYear");
  params.delete("period");
  params.set("dateQuick", value || defaultQuickPeriod);
  params.set("dateYear", year || String(now.getFullYear()));
  params.set("view", "andamento");

  const query = params.toString();
  window.location.href = query ? `/expenses?${query}` : "/expenses";
}

export default function ExpenseTrendSelectors({dateQuick, dateYear, useFiscalPeriodFilter}: Props) {
  const companyNow = civilDateInTimeZone(useCompanyTimeZone());
  return <PeriodSelectorBox dateQuick={dateQuick} dateYear={dateYear} useFiscalPeriodFilter={useFiscalPeriodFilter}
    companyNow={companyNow} label="Selettori andamento spese"
    onSelect={(value, year) => goWithQuick(value, year, companyNow)} onOpenFilters={openFiltersDrawer}/>;
}
