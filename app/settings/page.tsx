import Link from 'next/link';
import {Suspense} from 'react';
import DetailBackButton from '@/components/DetailBackButton';
import ActiveCompanySwitcher from '@/components/ActiveCompanySwitcher';
import {requireWorkspace} from '@/lib/auth';

const settingsSections = [
    {
        href: '/settings/account',
        label: 'Account',
        description: 'Gestisci profilo, credenziali e sessioni attive.',
        icon: '👤'
    },
    {
        href: '/account/workspace',
        label: 'Workspace',
        description: 'Configura il workspace, i membri e i relativi accessi.',
        icon: '▦'
    },
    {
        href: '/account/workspace/audit',
        label: 'Registro attività',
        description: 'Consulta le operazioni effettuate dagli utenti.',
        icon: '☷'
    },
    {
        href: '/settings/company-settings',
        label: 'Società',
        description: 'Crea e gestisci le società contabili del workspace.',
        icon: '🏢'
    },
    {
        href: '/settings/categories',
        label: 'Categorie',
        description: 'Configura categorie di spesa e canali di vendita.',
        icon: '🏷'
    },
    {
        href: '/settings/payment-credit',
        label: 'Pagamento e accredito',
        description: 'Gestisci banche, metodi di pagamento e instradamenti.',
        icon: '💳'
    },
    {
        href: '/settings/tax-authorities',
        label: 'Enti fiscali',
        description: 'Configura i beneficiari usati per imposte e contributi.',
        icon: '🏛'
    }
] as const;

export default async function SettingsPage() {
    await requireWorkspace('/settings');

    return <div className="grid admin-page settings-admin-page settings-hub-page">
        <div className="toolbar-card">
            <div>
                <h2>Impostazioni</h2>
                <p className="muted">Gestisci account, workspace e configurazioni contabili.</p>
            </div>
            <div className="settings-hub-toolbar-actions">
                <DetailBackButton href="/"/>
                <Suspense fallback={null}><ActiveCompanySwitcher returnTo="/settings"/></Suspense>
            </div>
        </div>

        <nav className="settings-category-hub settings-main-hub" aria-label="Sezioni impostazioni">
            {settingsSections.map(section =>
                <Link className="card settings-category-link" href={section.href} key={section.href}>
                    <span className="settings-category-link-icon" aria-hidden="true">{section.icon}</span>
                    <span className="settings-main-link-copy">
          <strong>{section.label}</strong>
          <small>{section.description}</small>
        </span>
                    <span className="settings-main-link-arrow" aria-hidden="true">›</span>
                </Link>)}
        </nav>

        <form action="/logout" method="post" className="settings-logout-form">
            <button type="submit" className="btn btn-md btn-danger">
                <span aria-hidden="true">↪</span>
                Logout
            </button>
        </form>
    </div>;
}
