'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import ExpenseCreationSwitcher from '@/components/ExpenseCreationSwitcher';
import {expenseNewEventName} from '@/components/ExpenseNewTriggerButton';
import {flashParamNames} from '@/lib/flash';

type Option = {
    id: number;
    code?: string;
    name: string;
    icon?: string | null;
    isFallback?: boolean | null;
    kind?: string;
    systemRole?: string | null;
    isVatSettlementDefault?: boolean
};
type SupplierOption = {
    id: number;
    businessName: string;
    alias?: string | null;
    email?: string | null;
    vatNumber?: string | null;
    iban?: string | null;
    pec?: string | null;
    taxCodeSdi?: string | null;
    internalNotes?: string | null;
    systemRole?: string | null;
    defaultExpenseCategoryId?: number | null
};
type InitialExpense = Parameters<typeof ExpenseCreationSwitcher>[0]['initialExpense'];

type Props = {
    categories: Option[];
    banks: Option[];
    paymentMethods: Option[];
    suppliers: SupplierOption[];
    initialExpense?: InitialExpense;
    initialOpen?: boolean;
    showToolbar?: boolean;
};

export default function NewExpensePanel({
                                            categories,
                                            banks,
                                            paymentMethods,
                                            suppliers,
                                            initialExpense,
                                            initialOpen = false,
                                            showToolbar = true
                                        }: Props) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(initialOpen);
    const [returnAction, setReturnAction] = useState('/api/expenses');
    const [recurringAction, setRecurringAction] = useState('/api/recurring-expenses');
    const [creationType, setCreationType] = useState<'single' | 'recurring' | 'vat'>('single');

    const modalCopy = creationType === 'recurring'
        ? {title: 'Nuova spesa ricorrente', description: 'Configura una nuova spesa ricorrente.'}
        : creationType === 'vat'
            ? {title: 'Nuovo saldo IVA', description: 'Inserisci un nuovo versamento IVA.'}
            : {title: 'Nuova spesa singola', description: 'Inserisci una nuova spesa singola.'};

    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('new');
        flashParamNames.forEach(key => url.searchParams.delete(key));
        const returnTo = `${url.pathname}${url.search}`;
        setReturnAction(`/api/expenses?returnTo=${encodeURIComponent(returnTo)}`);
        setRecurringAction(`/api/recurring-expenses?returnTo=${encodeURIComponent(returnTo)}`);
    }, []);

    useEffect(() => {
        const handler = () => setIsOpen(true);
        window.addEventListener(expenseNewEventName, handler);
        return () => window.removeEventListener(expenseNewEventName, handler);
    }, []);

    function handleSaved() {
        setIsOpen(false);
        router.refresh();
    }

    return <div className="grid">
        {showToolbar ? <div className="toolbar-card record-toolbar-card">
            <div className="record-toolbar-card-content">
                <div className="record-toolbar-card-title">
                    <h2>Spese</h2>
                    {/*<Link className="btn btn-md btn-default expense-import-btn" href="/expenses/import">*/}
                    {/*  <span className="btn-icon">⬆</span>*/}
                    {/*  <span className="expense-import-btn-text"> Importa Excel</span>*/}
                    {/*  <span className="expense-import-btn-text-compact"> XLS</span>*/}
                    {/*</Link>*/}
                </div>
                <div className="record-toolbar-card-text">
                    <p className="muted">Gestisci le uscite ricorrenti.</p>
                </div>
            </div>
            <div className="toolbar-actions record-toolbar-actions">
                {/*<Link className="btn btn-md btn-default expense-import-btn-large" href="/expenses/import"><span className="btn-icon">⬆</span>Importa Excel</Link>*/}
                <Link className="btn btn-sm btn-secondary" href="/recurring-expenses">
                    <span className="btn-icon">↻</span>Uscite ricorrenti
                </Link>
                <button className="btn btn-sm btn-primary" type="button" onClick={() => setIsOpen(true)}>
                    <span className="btn-icon">+</span>
                    <span className="--hidden-mobile">Aggiungi spesa</span>
                    {/*<span className="hidden-desktop">Spesa</span>*/}
                </button>
            </div>
        </div> : null}

        {isOpen ?
            <div className="modal-backdrop app-form-modal app-wizard-modal" role="dialog" aria-modal="true" aria-label="Aggiungi nuova spesa" onMouseDown={() => setIsOpen(false)}>
                <div className="modal-card modal-card-wide app-wizard-modal-card" onMouseDown={(event) => event.stopPropagation()}>
                    <div className="modal-title">
                        <div>
                            <h3>{modalCopy.title}</h3>
                            <p className="muted">{modalCopy.description}</p>
                        </div>
                        <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setIsOpen(false)}>×</button>
                    </div>
                    <ExpenseCreationSwitcher categories={categories} banks={banks} paymentMethods={paymentMethods}
                                             suppliers={suppliers} initialExpense={initialExpense} expenseAction={returnAction}
                                             recurringAction={recurringAction} onTypeChange={setCreationType}
                                             onCancel={() => setIsOpen(false)} onSaved={handleSaved}/>
                </div>
            </div> : null}
    </div>;
}
