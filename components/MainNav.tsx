'use client';

import Link from 'next/link';
import {useEffect, useState, Suspense} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import MonthlyReportIcon from '@/components/MonthlyReportIcon';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {yearMonthInTimeZone} from '@/lib/company-time';

const persistedFilterKeys: Record<string, string> = {
  '/expenses': 'dmsAccounting.expenses.filters',
  '/incomes': 'dmsAccounting.incomes.filters',
};

const filterMaxAgeMs = 24 * 60 * 60 * 1000;
const transientParams = new Set(['new', 'copyId', 'returnTo', 'saved', 'error', 'usage']);

function readStoredFilter(storageKey: string) {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw) as { value?: unknown; savedAt?: unknown };
    if (typeof parsed.value !== 'string' || typeof parsed.savedAt !== 'number') {
      window.localStorage.removeItem(storageKey);
      return '';
    }

    if (Date.now() - parsed.savedAt > filterMaxAgeMs) {
      window.localStorage.removeItem(storageKey);
      return '';
    }

    return parsed.value;
  } catch {
    window.localStorage.removeItem(storageKey);
    return '';
  }
}

function writeStoredFilter(storageKey: string, value: string) {
  window.localStorage.setItem(storageKey, JSON.stringify({ value, savedAt: Date.now() }));
}

function filterSearch(search: string) {
  const params = new URLSearchParams(search);
  transientParams.forEach((param) => params.delete(param));
  const value = params.toString();
  return value ? `?${value}` : '';
}

// const links = [
//   { href: '/', label: 'Dashboard', shortLabel: 'Home', icon: '⌂', match: (pathname: string) => pathname === '/' },
//   { href: '/expenses', label: 'Spese', shortLabel: 'Spese', icon: '−', match: (pathname: string) => pathname.startsWith('/expenses') },
//   { href: '/incomes', label: 'Incassi', shortLabel: 'Incassi', icon: '+', match: (pathname: string) => pathname.startsWith('/incomes') },
//   { href: '/suppliers', label: 'Fornitori', shortLabel: 'Fornitori', icon: '◇', match: (pathname: string) => pathname.startsWith('/suppliers') },
// ];

function MainNavContent() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const [savedFilters, setSavedFilters] = useState<Record<string, string>>({});
  const timeZone = useCompanyTimeZone();
  const currentPeriod = yearMonthInTimeZone(timeZone);
  const currentMonthHref = `/months/${currentPeriod.year}/${currentPeriod.month}?mode=overall&returnTo=${encodeURIComponent('/')}`;
  const navigationLinks = [
      { href: '/', label: 'Dashboard', shortLabel: 'Home', icon: '⌂', match: (pathname: string) => pathname === '/' },
      { href: '/expenses', label: 'Spese', shortLabel: 'Spese', icon: '−', match: (pathname: string) => pathname.startsWith('/expenses') },
      { href: '/incomes', label: 'Incassi', shortLabel: 'Incassi', icon: '+', match: (pathname: string) => pathname.startsWith('/incomes') },
      { href: currentMonthHref, label: 'Mese', shortLabel: 'Mese', icon: <MonthlyReportIcon/>, match: (currentPathname: string) => currentPathname.startsWith('/months/') },
      { href: '/suppliers', label: 'Fornitori', shortLabel: 'Fornitori', icon: '◇', match: (pathname: string) => pathname.startsWith('/suppliers'), isMonthLink: true },
  ];
  const navigationMobileLinks = [
      navigationLinks[0],
      navigationLinks[1],
      navigationLinks[3],
      navigationLinks[2],
      navigationLinks[4],
  ];
  useEffect(() => {
    const nextSavedFilters: Record<string, string> = {};

    Object.entries(persistedFilterKeys).forEach(([path, storageKey]) => {
      const saved = readStoredFilter(storageKey);
      if (saved) nextSavedFilters[path] = saved;
    });

    const storageKey = persistedFilterKeys[pathname];
    if (storageKey) {
      const search = searchParams.toString();
      const filteredSearch = filterSearch(search ? `?${search}` : '');

      if (filteredSearch) {
        writeStoredFilter(storageKey, filteredSearch);
        nextSavedFilters[pathname] = filteredSearch;
      }
    }

    setSavedFilters(nextSavedFilters);
  }, [pathname, searchParams]);

  function navHref(baseHref: string) {
    if (!persistedFilterKeys[baseHref]) return baseHref;
    if (pathname === baseHref) return baseHref;
    return `${baseHref}${savedFilters[baseHref] ?? ''}`;
  }

  return (
    <>
      <div className="nav-links" aria-label="Menu principale">
        {navigationLinks.map((link) => {
          const isActive = link.match(pathname);
          return (
            <Link
              key={link.href}
              href={navHref(link.href)}
              className={[isActive ? 'nav-link-active' : '', 'isMonthLink' in link && link.isMonthLink ? 'nav-link-month' : ''].filter(Boolean).join(' ') || undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-link-icon" aria-hidden="true">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
      <nav className="mobile-bottom-nav" aria-label="Menu mobile principale">
        {navigationMobileLinks.map((link) => {
          const isActive = link.match(pathname);
          return (
            <Link
              key={`mobile-${link.href}`}
              href={navHref(link.href)}
              className={isActive ? 'mobile-bottom-nav-active' : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="mobile-bottom-nav-icon" aria-hidden="true">{link.icon}</span>
              <strong>{link.shortLabel}</strong>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export default function MainNavSuspenseWrapper() {
  return (
    <Suspense fallback={null}>
      <MainNavContent />
    </Suspense>
  );
}
// dms-searchparams-suspense-wrapper
