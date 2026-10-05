'use client';

import Link from 'next/link';
import {usePathname, useSearchParams} from 'next/navigation';
import InfoHint from '@/components/InfoHint';

const pages: Record<string, {title: string; back: string; help: string}> = {
    '/settings': {title: 'Impostazioni', back: '/', help: 'Gestisci account, workspace e configurazioni contabili.'},
    '/settings/account': {title: 'Account', back: '/settings', help: 'Gestisci profilo, credenziali e sessioni attive.'},
    '/settings/account/password': {title: 'Password', back: '/settings/account', help: 'Modifica la password del tuo account.'},
    '/account/workspace': {title: 'Workspace', back: '/settings', help: 'Configura la tua area di lavoro.'},
    '/account/workspace/audit': {title: 'Registro attività', back: '/account/workspace', help: 'Ultime 200 operazioni sensibili eseguite nel workspace.'},
    '/settings/company-settings': {title: 'Società', back: '/settings', help: 'Gestisci le entità contabili del workspace. La società in uso determina movimenti e report visualizzati.'},
    '/settings/categories': {title: 'Categorie', back: '/settings', help: 'Scegli l’area di categorie da configurare.'},
    '/settings/categories/expenses': {title: 'Categorie di spesa', back: '/settings/categories', help: 'Gestisci categorie, acronimi e icone delle spese.'},
    '/settings/categories/incomes': {title: 'Canali di vendita', back: '/settings/categories', help: 'Gestisci i canali e il loro ordine nelle selezioni.'},
    '/settings/payment-credit': {title: 'Pagamento e accredito', back: '/settings', help: 'Gestisci banche, metodi di pagamento e instradamenti.'},
    '/settings/tax-authorities': {title: 'Enti fiscali', back: '/settings', help: 'Gestisci i beneficiari fiscali e previdenziali disponibili nelle spese di tipo Imposte.'}
};

const sections: Record<string, string> = {
    banks: 'Banche e canali',
    methods: 'Metodi di pagamento',
    routing: 'Instradamento accrediti'
};

export function isSettingsPath(pathname: string) {
    return Object.hasOwn(pages, pathname);
}

export default function SettingsMobileHeader() {
    const pathname = usePathname() || '/settings';
    const params = useSearchParams();
    const page = pages[pathname];
    if (!page) return null;
    const requestedSection = params.get('section') || '';
    const section = pathname === '/settings/payment-credit' && Object.hasOwn(sections, requestedSection)
        ? sections[requestedSection] : undefined;
    const title = section || page.title;
    const back = section ? '/settings/payment-credit' : page.back;

    return <div className="settings-mobile-header-actions" aria-label="Impostazioni">
        <Link data-page-transition="backward" className="btn btn-ghost btn-icon-only" href={back} replace aria-label={back === '/' ? 'Indietro alla dashboard' : 'Indietro'} title="Indietro">
            <span className="btn-icon" aria-hidden="true">↩</span>
        </Link>
        <div className="info-title-row settings-mobile-title">
            <h2>{title}</h2>
            <InfoHint compactOnly title={title}>{page.help}</InfoHint>
        </div>
        {pathname === '/settings/company-settings' ? <button className="btn btn-sm btn-primary btn-icon-only" type="button" data-company-new aria-label="Nuova società" title="Nuova società"><span className="btn-icon btn-icon-add" aria-hidden="true">＋</span></button> : null}
    </div>;
}
