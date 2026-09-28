'use client';

import {useTransition} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {reportCurrentMonthHref} from '@/lib/report-period-selection';

export default function ReportCurrentMonthSwitch({checked}: {checked: boolean}) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
  const [pending, startTransition] = useTransition();
  return <div className="switch-toggle-field report-current-month-switch" aria-busy={pending}>
    <label className="report-current-month-label">
      <span>Includi mese in corso</span>
      <span className="switch">
        <input type="checkbox" role="switch" checked={checked} disabled={pending} onChange={event => {
          const href = reportCurrentMonthHref(pathname, query.toString(), event.currentTarget.checked);
          startTransition(() => router.replace(href, {scroll: false}));
        }}/>
        <span className="slider" aria-hidden="true"/>
      </span>
    </label>
  </div>;
}
