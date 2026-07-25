'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import MonthlyReportIcon from '@/components/MonthlyReportIcon';

const settingsLinks = [
  { href: '/settings/account', label: 'Account', icon: '👤' },
  { href: '/account/workspace', label: 'Workspace', icon: '▦' },
  // { href: '/settings/company', label: 'Azienda', icon: '🏢' },
  { href: '/settings/company-settings', label: 'Società', icon: '⚙' },
  { href: '/settings/categories', label: 'Categorie', icon: '🏷' },
  { href: '/settings/payment-credit', label: 'Pagamento e Accredito', icon: '💳' },
  // { href: '/expenses/import', label: 'Importazione spese', icon: '⬆' },
];

function currentMonthReportHref() {
  const now = new Date();
  return `/months/${now.getFullYear()}/${now.getMonth() + 1}?mode=overall&returnTo=${encodeURIComponent('/')}`;
}

const mainMenuLinks = [
  { href: currentMonthReportHref, label: 'Report mese', icon: <MonthlyReportIcon /> },
  { href: () => '/incomes/cash-register', label: 'Registratore di cassa', icon: '🧮' },
  { href: () => '/recurring-expenses', label: 'Spese ricorrenti', icon: '↻' },
  { href: () => '/suppliers', label: 'Fornitori', icon: '◇' },
  { href: () => '/clients', label: 'Clienti', icon: '♙' },
  { href: () => '/settings/company', label: 'Azienda', icon: '🏢' },
  { href: () => '/expenses/import', label: 'Importa spese', icon: '⬆' },
] as const;

export default function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'main' | 'settings'>('main');

  function closeMenu() {
    setIsOpen(false);
    setView('main');
  }

  function openMenu() {
    setView('main');
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
          {view === 'settings' ? <button className="settings-drawer-back" type="button" aria-label="Torna al menu" onClick={() => setView('main')}>←</button> : null}
          <h2>{view === 'main' ? 'Menu' : 'Impostazioni'}</h2>
        </div>
        <button className="settings-drawer-close" type="button" aria-label="Chiudi menu" onClick={closeMenu}>×</button>
      </div>
      {view === 'main' ? <nav className="settings-drawer-nav" aria-label="Menu principale laterale">
        {mainMenuLinks.map(link => link.href
          ? <Link key={link.label} href={link.href()} onClick={closeMenu}>
              <span className="settings-drawer-item-icon" aria-hidden="true">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          : <button key={link.label} type="button" className="settings-drawer-item-disabled" disabled aria-disabled="true" title="Gestione clienti non ancora disponibile">
              <span className="settings-drawer-item-icon" aria-hidden="true">{link.icon}</span>
              <span>{link.label}</span>
            </button>)}
        <button type="button" onClick={() => setView('settings')}>
          <span className="settings-drawer-item-icon" aria-hidden="true">⚙</span>
          <span>Impostazioni</span>
          <span className="settings-drawer-item-arrow" aria-hidden="true">›</span>
        </button>
      </nav> : <nav className="settings-drawer-nav" aria-label="Menu impostazioni">
          {settingsLinks.map(link => <Link key={link.href} href={link.href} onClick={closeMenu}>
            <span className="settings-drawer-item-icon" aria-hidden="true">{link.icon}</span>
            <span>{link.label}</span>
          </Link>)}
          <form action="/logout" method="post">
            <button type="submit">
              <span className="settings-drawer-item-icon" aria-hidden="true">↪</span>
              <span>Logout</span>
            </button>
          </form>
        </nav>}
    </aside>
  </div>;
}
