'use client';

import type {ReactNode} from 'react';

export default function ExpenseTypeStep({totalSteps, confirmed, children}: {
    totalSteps: number; confirmed: boolean; children: ReactNode;
}) {
    return <section className={`form app-record-form single-expense-form expense-creation-type-step app-form-wizard app-form-wizard-current-1 ${confirmed ? 'is-complete' : ''}`}>
        <div className="app-form-wizard-header full">
            <div className="app-form-wizard-heading">
                <span>Passaggio 1 di {totalSteps}</span><strong><span>Tipo di spesa</span></strong>
            </div>
            <div className="app-form-wizard-progress" aria-label={`Passaggio 1 di ${totalSteps}`}>
                <span style={{width: `${100 / totalSteps}%`}}/>
            </div>
        </div>
        {children}
    </section>;
}
