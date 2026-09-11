'use client';

import {Suspense} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import MainNav from '@/components/MainNav';
import SettingsMenu from '@/components/SettingsMenu';
import NotificationBell from '@/components/NotificationBell';
import UserMenu from '@/components/UserMenu';
import ExpenseNewTriggerButton from '@/components/ExpenseNewTriggerButton';
import logoHorizontal from '../public/img/tabularium-logo-horiz.png';

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

function DesktopHeader({
                           compactOnMobile = false,
                           incomePage = false,
                           expensePage = false,
                           recurringExpensePage = false,
                           recurringIncomePage = false,
                           userName
                       }: {
    compactOnMobile?: boolean;
    incomePage?: boolean;
    expensePage?: boolean;
    recurringExpensePage?: boolean;
    recurringIncomePage?: boolean;
    userName?: string | null
}) {
    const className = `${compactOnMobile ? "nav compact-mobile-header-path" : "nav fixed"}${incomePage ? " income-page-header" : ""}${expensePage ? " expense-page-header" : ""}${recurringExpensePage ? " recurring-expense-page-header" : ""}${recurringIncomePage ? " recurring-income-page-header" : ""}`;

    return <div className={className}>
        {/*<div className="site-header-brand compact hidden-md-up">*/}
        {/*    <img className="site-header-logo" src={logoIcon.src} alt="Tabularium" width={logoIcon.width} height={logoIcon.height} />*/}
        {/*</div>*/}
        <div className="site-header-brand">
            <img className="site-header-logo" src={logoHorizontal.src} alt="Tabularium" width={logoHorizontal.width} height={logoHorizontal.height}/>
        </div>
        {incomePage ? <div className="income-mobile-header-actions" aria-label="Azioni incassi">
            <Link className="btn btn-sm btn-default" href="/recurring-incomes"><span className="btn-icon" aria-hidden="true">↻</span>Entrate ricorrenti</Link>
            <button className="btn btn-sm btn-primary income-add-btn" type="button" data-income-new>
                <span className="btn-icon" aria-hidden="true">＋</span>Incasso
            </button>
        </div> : null}
        {expensePage ? <div className="expense-mobile-header-actions" aria-label="Azioni spese">
            <Link className="btn btn-sm btn-secondary" href="/recurring-expenses"><span className="btn-icon" aria-hidden="true">↻</span>Spese ricorrenti</Link>
            <ExpenseNewTriggerButton className="btn btn-sm btn-primary" floatingLabel="Spesa"><span className="btn-icon" aria-hidden="true">＋</span>Spesa</ExpenseNewTriggerButton>
        </div> : null}
        {recurringExpensePage ?
            <div className="recurring-expense-mobile-header-actions" aria-label="Azioni uscite ricorrenti">
                <Link className="btn btn-sm btn-default" href="/expenses"><span className="btn-icon" aria-hidden="true">↩</span>Spese</Link>
                <button className="btn btn-sm btn-primary" type="button" data-recurring-expense-new>
                    <span className="btn-icon" aria-hidden="true">＋</span>Ricorrente
                </button>
            </div> : null}
        {recurringIncomePage ?
            <div className="recurring-income-mobile-header-actions" aria-label="Azioni entrate ricorrenti">
                <Link className="btn btn-sm btn-default" href="/incomes">
                    <span className="btn-icon" aria-hidden="true">↩</span>Incassi
                </Link>
                <button className="btn btn-sm btn-primary" type="button" data-income-new data-income-new-type="recurring">
                    <span className="btn-icon" aria-hidden="true">＋</span>Ricorrente
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

        return <DesktopHeader incomePage={pathname === '/incomes'} expensePage={pathname === '/expenses'} recurringExpensePage={pathname === '/recurring-expenses'} recurringIncomePage={pathname === '/recurring-incomes'} userName={userName}/>;
    }

    if (isFooterHiddenPath(pathname)) return null;

    return <footer className="app-footer">
        <div>Tabularium</div>
        <div className="muted">Tabularium - DM Solutions</div>
    </footer>;
}
