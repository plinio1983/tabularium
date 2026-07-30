'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import MainNav from '@/components/MainNav';
import SettingsMenu from '@/components/SettingsMenu';
import logoHorizontal from '../public/img/tabularium-logo-horiz.png';
import ActiveCompanySwitcher from '@/components/ActiveCompanySwitcher';

type Props = {
  slot: 'header' | 'footer';
};

function isCompactMobileHeaderPath(pathname: string) {
  return /^\/expenses\/\d+$/.test(pathname)
    || /^\/incomes\/\d+$/.test(pathname)
    || /^\/suppliers\/\d+$/.test(pathname)
    || pathname === '/expenses/new'
    || pathname === '/expenses/counter'
    || pathname === '/recurring-expenses/new'
    || pathname === '/incomes/new'
    || pathname === '/incomes/cash-register';
}

function isChromeHiddenPath(pathname: string) {
  return pathname === '/login' || pathname.startsWith('/register') || pathname.startsWith('/admin');
}

function DesktopHeader({ compactOnMobile = false }: { compactOnMobile?: boolean }) {
  const className = compactOnMobile ? "nav compact-mobile-header-path" : "nav";

  return <div className={className}>
    <div className="site-header-brand">
      <img className="site-header-logo" src={logoHorizontal.src} alt="Tabularium" width={logoHorizontal.width} height={logoHorizontal.height} />
      <Suspense fallback={null}><ActiveCompanySwitcher /></Suspense>
    </div>
    <div className="site-header-actions">
      <Suspense fallback={null}>
        <MainNav />
        <SettingsMenu />
      </Suspense>
    </div>
  </div>;
}

export default function ShellChrome({ slot }: Props) {
  const pathname = usePathname() || '/';
  if (isChromeHiddenPath(pathname)) return null;

  if (slot === 'header') {
    if (isCompactMobileHeaderPath(pathname)) {
      return <>
        <DesktopHeader compactOnMobile />
        <div className="expense-detail-mobile-nav-only">
          <div className="nav-actions">
            <Suspense fallback={null}>
              <MainNav />
            </Suspense>
          </div>
        </div>
      </>;
    }

    return <DesktopHeader />;
  }

  return <footer className="app-footer">
    <div>Tabularium</div>
    <div className="muted">Tabularium - DM Solutions</div>
  </footer>;
}
