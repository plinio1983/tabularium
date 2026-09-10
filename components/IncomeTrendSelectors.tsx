"use client";

import PeriodSelectorBox from '@/components/PeriodSelectorBox';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {civilDateInTimeZone} from '@/lib/company-time';
import {defaultQuickPeriod} from '@/lib/period-selector';

type Props = {dateQuick: string; dateYear: string; useFiscalPeriodFilter: boolean};

function openFiltersDrawer() {
  const trigger = document.querySelector<HTMLButtonElement>('[data-period-filter-source="income"]');
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
  params.set("dateQuick", value || defaultQuickPeriod);
  params.set("dateYear", year || String(now.getFullYear()));
  params.set("view", "andamento");

  const query = params.toString();
  window.location.href = query ? `/incomes?${query}` : "/incomes";
}

export default function IncomeTrendSelectors({dateQuick, dateYear, useFiscalPeriodFilter}: Props) {
  const companyNow = civilDateInTimeZone(useCompanyTimeZone());
  return <PeriodSelectorBox dateQuick={dateQuick} dateYear={dateYear} useFiscalPeriodFilter={useFiscalPeriodFilter}
    companyNow={companyNow} label="Selettori andamento incassi"
    onSelect={(value, year) => goWithQuick(value, year, companyNow)} onOpenFilters={openFiltersDrawer}/>;
}
