'use client';

import {Suspense} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import MainNav from '@/components/MainNav';
import SettingsMenu from '@/components/SettingsMenu';
import NotificationBell from '@/components/NotificationBell';
import UserMenu from '@/components/UserMenu';
import ExpenseNewTriggerButton from '@/components/ExpenseNewTriggerButton';
import ReportMobileModeSwitch from '@/components/ReportMobileModeSwitch';
import InfoHint from '@/components/InfoHint';
import logoHorizontal from '../public/img/tabularium-logo-horiz.png';

type Props = {
    slot: 'header' | 'footer';
    userName?: string | null;
};

function isCompactMobileHeaderPath(pathname: string) {
    return /^\/expenses\/\d+$/.test(pathname)
        || /^\/recurring-expenses\/\d+$/.test(pathname)
        || /^\/recurring-incomes\/\d+$/.test(pathname)
        || /^\/incomes\/\d+$/.test(pathname)
        || /^\/suppliers\/\d+$/.test(pathname)
        || /^\/clients\/\d+$/.test(pathname)
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

function DesktopHeader({
                           compactOnMobile = false,
                           ledgerKind = null,
                           reportPage = false,
                           receiptListPage = false,
                           employeePage = false,
                           clientPage = false,
                           supplierPage = false,
                           companyPage = false,
                           importPage = false,
                           settingsPage = false,
                           dashboardPage = false,
                           incomePage = false,
                           expensePage = false,
                           recurringExpensePage = false,
                           recurringIncomePage = false,
                           userName
                       }: {
    compactOnMobile?: boolean;
    ledgerKind?: 'credits' | 'payments' | null;
    reportPage?: boolean;
    receiptListPage?: boolean;
    employeePage?: boolean;
    clientPage?: boolean;
    supplierPage?: boolean;
    companyPage?: boolean;
    importPage?: boolean;
    settingsPage?: boolean;
    dashboardPage?: boolean;
    incomePage?: boolean;
    expensePage?: boolean;
    recurringExpensePage?: boolean;
    recurringIncomePage?: boolean;
    userName?: string | null
}) {
    const className = `${compactOnMobile ? "nav compact-mobile-header-path" : "nav fixed"}${ledgerKind ? " ledger-page-header" : ""}${reportPage ? " report-page-header" : ""}${receiptListPage ? " receipt-list-page-header" : ""}${employeePage ? " employee-page-header" : ""}${clientPage ? " client-page-header" : ""}${supplierPage ? " supplier-page-header" : ""}${companyPage ? " company-page-header" : ""}${importPage ? " import-page-header" : ""}${settingsPage ? " settings-page-header" : ""}${dashboardPage ? " dashboard-page-header" : ""}${incomePage ? " income-page-header" : ""}${expensePage ? " expense-page-header" : ""}${recurringExpensePage ? " recurring-expense-page-header" : ""}${recurringIncomePage ? " recurring-income-page-header" : ""}`;

    return <div className={className}>
        {/*<div className="site-header-brand compact hidden-md-up">*/}
        {/*    <img className="site-header-logo" src={logoIcon.src} alt="Tabularium" width={logoIcon.width} height={logoIcon.height} />*/}
        {/*</div>*/}
        <div className="site-header-brand">
            <img className="site-header-logo" src={logoHorizontal.src} alt="Tabularium" width={logoHorizontal.width} height={logoHorizontal.height}/>
        </div>
        {ledgerKind ? <div className="ledger-mobile-header-actions">
            <div className="info-title-row">
                <h2>{ledgerKind === 'payments' ? 'Pagamenti' : 'Accrediti'}</h2>
                <InfoHint compactOnly title={ledgerKind === 'payments' ? 'Pagamenti' : 'Accrediti'}>
                    {ledgerKind === 'payments' ? 'Pagamenti registrati sulle spese, comprese le buste paga.' : 'Accrediti registrati sugli incassi, compresi gli scontrini.'}
                </InfoHint>
            </div>
        </div> : null}
        {reportPage ? <div className="report-mobile-header-actions">
            <Suspense fallback={null}>
                <ReportMobileModeSwitch/>
            </Suspense>
        </div> : null}
        {receiptListPage ? <div className="receipt-list-mobile-header-actions" aria-label="Azioni scontrini">
            <Link className="btn btn-sm btn-default" href="/incomes">
                <span className="btn-icon" aria-hidden="true">↩</span>Incassi
            </Link>
            <Link className="btn btn-sm btn-secondary" href="/incomes/cash-register" aria-label="Apri registratore di cassa">
                <span className="btn-icon" aria-hidden="true">🧮</span>Reg. di Cassa
            </Link>
        </div> : null}
        {employeePage ? <div className="employee-mobile-header-actions" aria-label="Azioni dipendenti">
            <button className="btn btn-sm btn-primary" type="button" data-employee-new>
                <span className="btn-icon btn-icon-add" aria-hidden="true">＋</span>Nuovo dipendente
            </button>
        </div> : null}
        {clientPage ? <div className="client-mobile-header-actions" aria-label="Azioni clienti">
            <button className="btn btn-sm btn-primary" type="button" data-client-new>
                <span className="btn-icon btn-icon-add" aria-hidden="true">＋</span>Nuovo cliente
            </button>
        </div> : null}
        {settingsPage ? <div className="settings-mobile-header-actions" aria-label="Impostazioni">
            <Link className="btn btn-ghost btn-icon-only" href="/" replace aria-label="Indietro alla dashboard" title="Indietro">
                <span className="btn-icon" aria-hidden="true">↩</span>
            </Link>
            <div className="info-title-row">
                <h2>Impostazioni</h2>
                <InfoHint compactOnly title="Impostazioni">Gestisci account, workspace e configurazioni contabili.</InfoHint>
            </div>
        </div> : null}
        {importPage ? <div className="import-mobile-header-actions" aria-label="Azioni importazione">
            <Link className="btn btn-sm btn-ghost" href="/" aria-label="Indietro alla dashboard">
                <span className="btn-icon" aria-hidden="true">↩</span>Indietro
            </Link>
        </div> : null}
        {companyPage ? <div className="company-mobile-header-actions" aria-label="Azioni società">
            <Link className="btn btn-sm btn-ghost" href="/settings" aria-label="Indietro"><span className="btn-icon">↩</span><span className="company-header-back-label">Indietro</span></Link>
            <button className="btn btn-sm btn-primary" type="button" data-company-new><span className="btn-icon btn-icon-add">＋</span>Nuova società</button>
        </div> : null}
        {supplierPage ? <div className="supplier-mobile-header-actions" aria-label="Azioni fornitori">
            <button className="btn btn-sm btn-primary" type="button" data-supplier-new>
                <span className="btn-icon btn-icon-add" aria-hidden="true">＋</span>Nuovo Fornitore
            </button>
        </div> : null}
        {dashboardPage ? <div className="dashboard-mobile-header-actions" aria-label="Azioni dashboard">
            <Suspense fallback={null}>
                <ExpenseNewTriggerButton className="btn btn-sm btn-primary" floatingLabel="Spesa">
                    <span className="btn-icon btn-icon-add" aria-hidden="true">＋</span>Spesa
                </ExpenseNewTriggerButton>
            </Suspense>
            <Link className="btn btn-sm btn-primary" href="/incomes?new=1">
                <span className="btn-icon btn-icon-add" aria-hidden="true">＋</span>Incasso
            </Link>
        </div> : null}
        {incomePage ? <div className="income-mobile-header-actions" aria-label="Azioni incassi">
            <Link className="btn btn-sm btn-secondary" href="/recurring-incomes">
                <span className="btn-icon" aria-hidden="true">↻</span>Entrate ricorrenti
            </Link>
            <button className="btn btn-sm btn-primary income-add-btn" type="button" data-income-new>
                <span className="btn-icon btn-icon-add" aria-hidden="true">＋</span>Incasso
            </button>
        </div> : null}
        {expensePage ? <div className="expense-mobile-header-actions" aria-label="Azioni spese">
            <Link className="btn btn-sm btn-secondary" href="/recurring-expenses"><span className="btn-icon" aria-hidden="true">↻</span>Spese ricorrenti</Link>
            <ExpenseNewTriggerButton className="btn btn-sm btn-primary" floatingLabel="Spesa"><span className="btn-icon btn-icon-add" aria-hidden="true">＋</span>Spesa</ExpenseNewTriggerButton>
        </div> : null}
        {recurringExpensePage ?
            <div className="recurring-expense-mobile-header-actions" aria-label="Azioni uscite ricorrenti">
                <Link className="btn btn-sm btn-default" href="/expenses"><span className="btn-icon" aria-hidden="true">↩</span>Spese</Link>
                <button className="btn btn-sm btn-primary" type="button" data-recurring-expense-new>
                    <span className="btn-icon btn-icon-add" aria-hidden="true">＋</span>Aggiungi
                </button>
            </div> : null}
        {recurringIncomePage ?
            <div className="recurring-income-mobile-header-actions" aria-label="Azioni entrate ricorrenti">
                <Link className="btn btn-sm btn-default" href="/incomes">
                    <span className="btn-icon" aria-hidden="true">↩</span>Incassi
                </Link>
                <button className="btn btn-sm btn-primary" type="button" data-income-new data-income-new-type="recurring">
                    <span className="btn-icon btn-icon-add" aria-hidden="true">＋</span>Aggiungi
                </button>
            </div> : null}
        <div className="site-header-actions">
            <Suspense fallback={null}>
                <MainNav/>
                <NotificationBell/>
                <UserMenu userName={userName}/>
                <SettingsMenu/>
            </Suspense>
        </div>
    </div>;
}

export default function ShellChrome({slot, userName}: Props) {
    const pathname = usePathname() || '/';
    if (isChromeHiddenPath(pathname)) return null;

    if (slot === 'header') {
        if (isCompactMobileHeaderPath(pathname)) {
            return <>
                <DesktopHeader compactOnMobile userName={userName}/>
                <div className="expense-detail-mobile-nav-only">
                    <div className="nav-actions">
                        <Suspense fallback={null}>
                            <MainNav/>
                        </Suspense>
                    </div>
                </div>
            </>;
        }

        return <DesktopHeader ledgerKind={pathname === '/incomes/credits' ? 'credits' : pathname === '/expenses/payments' ? 'payments' : null} reportPage={/^\/months\/\d+\/\d+$/.test(pathname)} receiptListPage={pathname === '/incomes/cash-register/receipts'} employeePage={pathname === '/employees'} clientPage={pathname === '/clients'} supplierPage={pathname === '/suppliers'} companyPage={pathname === '/settings/company-settings'} importPage={pathname === '/expenses/import'} settingsPage={pathname === '/settings'} dashboardPage={pathname === '/'} incomePage={pathname === '/incomes'} expensePage={pathname === '/expenses'} recurringExpensePage={pathname === '/recurring-expenses'} recurringIncomePage={pathname === '/recurring-incomes'} userName={userName}/>;
    }

    if (isFooterHiddenPath(pathname)) return null;

    return <footer className="app-footer">
        <div>Tabularium</div>
        <div className="muted">Tabularium - DM Solutions</div>
    </footer>;
}
