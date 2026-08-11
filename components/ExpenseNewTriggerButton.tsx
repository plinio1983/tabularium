'use client';

import Link from 'next/link';
import {usePathname, useSearchParams} from 'next/navigation';
import type { ReactNode } from 'react';
import type { MouseEvent } from 'react';

export default function ExpenseNewTriggerButton({
  className,
  children,
  floatingLabel
}: {
  className: string;
  children: ReactNode;
  floatingLabel?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = new URLSearchParams(searchParams.toString());
  query.set('new', '1');

  return <Link
    className={className}
    href={`${pathname}?${query}`}
    data-bulk-new
    data-expense-new
    data-floating-label={floatingLabel}
    onClick={(event: MouseEvent<HTMLAnchorElement>) => {
      const openEvent = new CustomEvent('tabularium:expense-new', {cancelable: true});
      if (!window.dispatchEvent(openEvent)) event.preventDefault();
    }}
  >
    {children}
  </Link>;
}
