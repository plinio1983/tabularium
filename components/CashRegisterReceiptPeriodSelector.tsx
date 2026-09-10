'use client';

import {useRouter, useSearchParams} from 'next/navigation';
import PeriodSelectorBox from '@/components/PeriodSelectorBox';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {civilDateInTimeZone} from '@/lib/company-time';
import {receiptPeriodParams} from '@/lib/receipt-period';

export default function CashRegisterReceiptPeriodSelector({dateQuick, dateYear, years}: {dateQuick: string; dateYear: string; years: string[]}) {
  const router = useRouter();
  const params = useSearchParams();
  const companyNow = civilDateInTimeZone(useCompanyTimeZone());
  return <PeriodSelectorBox dateQuick={dateQuick} dateYear={dateYear} years={years} companyNow={companyNow}
    label="Selettori periodo scontrini"
    onSelect={(value, year) => router.replace(`/incomes/cash-register/receipts?${receiptPeriodParams(params.toString(), value, year)}`, {scroll: false})}
    onOpenFilters={() => document.querySelector<HTMLButtonElement>('[data-period-filter-source="receipt"]')?.click()}/>;
}
