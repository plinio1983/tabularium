'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import MonthlyReportIcon from '@/components/MonthlyReportIcon';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {yearMonthInTimeZone} from '@/lib/company-time';

function currentMonthReportHref(timeZone: string) {
  const current = yearMonthInTimeZone(timeZone);
  return `/months/${current.year}/${current.month}?mode=overall&returnTo=${encodeURIComponent('/')}`;
}

const mainMenuLinks = [
  { href: (_timeZone: string) => '/', label: 'Home', icon: '⌂' },
  { href: currentMonthReportHref, label: 'Report mese', icon: <MonthlyReportIcon /> },
  { href: (_timeZone: string) => '/incomes/cash-register', label: 'Registratore di cassa', icon: '🧮' },
  { href: (_timeZone: string) => '/recurring-expenses', label: 'Uscite ricorrenti', icon: '↻' },
  { href: (_timeZone: string) => '/recurring-incomes', label: 'Entrate ricorrenti', icon: '↻' },
  { href: (_timeZone: string) => '/suppliers', label: 'Fornitori', icon: '◇' },
  { href: (_timeZone: string) => '/clients', label: 'Clienti', icon: '♙' },
  { href: (_timeZone: string) => '/settings/company', label: 'Dati azienda', icon: '🏢' },
  { href: (_timeZone: string) => '/expenses/import', label: 'Importa dati', icon: '⬆' },
] as const;

export default function SettingsMenu() {
  const timeZone = useCompanyTimeZone();
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  function openMenu() {
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('settings-menu-open');

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('settings-menu-open');
    };
  }, [isOpen]);

  return <div className="settings-menu-shell">
    <button
      className="settings-trigger"
      type="button"
      aria-label="Apri menu"
      aria-expanded={isOpen}
      aria-controls="settings-drawer"
      onClick={openMenu}
    >
      <span className="burger-menu-icon" aria-hidden="true"><span /><span /><span /></span>
    </button>

    {isOpen ? <button className="settings-drawer-backdrop" type="button" aria-label="Chiudi menu" onClick={closeMenu} /> : null}

    <aside id="settings-drawer" className={isOpen ? 'settings-drawer is-open' : 'settings-drawer'} aria-hidden={!isOpen}>
      <div className="settings-drawer-header">
        <div className="settings-drawer-heading">
          <h2>Menu</h2>
        </div>
        <button className="settings-drawer-close" type="button" aria-label="Chiudi menu" onClick={closeMenu}>×</button>
      </div>
      <nav className="settings-drawer-nav" aria-label="Menu principale laterale">
        {mainMenuLinks.map(link => link.href
          ? <Link key={link.label} href={link.href(timeZone)} onClick={closeMenu}>
              <span className="settings-drawer-item-icon" aria-hidden="true">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          : <button key={link.label} type="button" className="settings-drawer-item-disabled" disabled aria-disabled="true" title="Gestione clienti non ancora disponibile">
              <span className="settings-drawer-item-icon" aria-hidden="true">{link.icon}</span>
              <span>{link.label}</span>
            </button>)}
        <Link href="/settings" onClick={closeMenu}>
          <span className="settings-drawer-item-icon" aria-hidden="true">⚙</span>
          <span>Impostazioni</span>
          <span className="settings-drawer-item-arrow" aria-hidden="true">›</span>
        </Link>
      </nav>
    </aside>
  </div>;
}
