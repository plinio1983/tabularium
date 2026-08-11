'use client';

import { useRouter } from 'next/navigation';

type Option = {
  label: string;
  selectLabel?: string;
  href: string;
  disabled: boolean;
};

export default function MonthReportMonthSelect({ options, value, ariaLabel = 'Seleziona mese' }: { options: Option[]; value: string; ariaLabel?: string }) {
  const router = useRouter();

  return <select
    className="month-report-month-select"
    aria-label={ariaLabel}
    value={value}
    onChange={(event) => {
      const href = event.currentTarget.value;
      if (href) {
        event.currentTarget.dispatchEvent(new Event('tabularium:navigation-start', { bubbles: true }));
        router.push(href);
      }
    }}
  >
    {options.map(option => <option key={option.href} value={option.href} disabled={option.disabled}>{option.selectLabel ?? option.label}</option>)}
  </select>;
}
