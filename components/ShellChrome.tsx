'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import MainNav from '@/components/MainNav';
import SettingsMenu from '@/components/SettingsMenu';
import NotificationBell from '@/components/NotificationBell';
import UserMenu from '@/components/UserMenu';
import logoHorizontal from '../public/img/tabularium-logo-horiz.png';
import logoIcon from '../public/img/icon-60px.png';

type Props = {
  slot: 'header' | 'footer';
  userName?: string | null;
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

function isFooterHiddenPath(pathname: string) {
  return pathname === '/incomes/cash-register';
}

function DesktopHeader({ compactOnMobile = false, userName }: { compactOnMobile?: boolean; userName?: string | null }) {
  const className = compactOnMobile ? "nav compact-mobile-header-path" : "nav fixed";

  return <div className={className}>
      <div className="site-header-brand compact hidden-md-up">
          <img className="site-header-logo" src={logoIcon.src} alt="Tabularium" width={logoIcon.width} height={logoIcon.height} />
      </div>
    <div className="site-header-brand hidden-md-down">
      <img className="site-header-logo" src={logoHorizontal.src} alt="Tabularium" width={logoHorizontal.width} height={logoHorizontal.height} />
    </div>
    <div className="site-header-actions">
      <Suspense fallback={null}>
        <MainNav />
        <NotificationBell />
        <UserMenu userName={userName} />
        <SettingsMenu />
      </Suspense>
    </div>
  </div>;
}

export default function ShellChrome({ slot, userName }: Props) {
  const pathname = usePathname() || '/';
  if (isChromeHiddenPath(pathname)) return null;

  if (slot === 'header') {
    if (isCompactMobileHeaderPath(pathname)) {
      return <>
        <DesktopHeader compactOnMobile userName={userName} />
        <div className="expense-detail-mobile-nav-only">
          <div className="nav-actions">
            <Suspense fallback={null}>
              <MainNav />
            </Suspense>
          </div>
        </div>
      </>;
    }

    return <DesktopHeader userName={userName} />;
  }

  if (isFooterHiddenPath(pathname)) return null;

  return <footer className="app-footer">
    <div>Tabularium</div>
    <div className="muted">Tabularium - DM Solutions</div>
  </footer>;
}
