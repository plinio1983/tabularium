'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import MainNav from '@/components/MainNav';

type Props = {
  slot: 'header' | 'footer';
};

function isExpenseDetailPath(pathname: string) {
  return /^\/expenses\/\d+$/.test(pathname);
}

export default function ShellChrome({ slot }: Props) {
  const pathname = usePathname() || '/';

  if (isExpenseDetailPath(pathname)) {
    if (slot === 'footer') return null;

    return <div className="expense-detail-mobile-nav-only">
      <Suspense fallback={null}>
        <MainNav />
      </Suspense>
    </div>;
  }

  if (slot === 'header') {
    return <div className="nav">
      <div><h1>DMS Accounting Manager</h1><div className="muted">Gestionale web per incassi, spese, fornitori e report mensili</div></div>
      <Suspense fallback={null}>
        <MainNav />
      </Suspense>
    </div>;
  }

  return <footer className="app-footer">
    <div>DMS Accounting Manager</div>
    <div className="muted">Footer generico — contenuti e link da definire.</div>
  </footer>;
}
