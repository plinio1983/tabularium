"use client";

import {useState} from "react";
import ExpenseForm from "@/components/ExpenseForm";
import RecurringExpenseForm from "@/components/RecurringExpenseForm";
import MobileFormStickyActions from "@/components/MobileFormStickyActions";
import ExpenseTypeChoice, {type ExpenseCreationType} from "@/components/ExpenseTypeChoice";

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
    defaultExpenseCategoryId?: number | null;
    defaultVatRate?: string | number | null
};
type EmployeeOption = {
    id: number;
    firstName: string;
    lastName: string;
    employeeCode?: string | null;
    status: "ACTIVE" | "INACTIVE"
};
type InitialExpense = Parameters<typeof ExpenseForm>[0]["initialExpense"];

type CreationType = ExpenseCreationType;
type Props = {
    categories: Option[];
    banks: Option[];
    paymentMethods: Option[];
    suppliers: SupplierOption[];
    employees?: EmployeeOption[];
    expenseAction: string;
    recurringAction: string;
    initialExpense?: InitialExpense;
    initialType?: CreationType;
    skipTypeStep?: boolean;
    title?: string;
    submitLabel?: string;
    onCancel?: () => void;
    onSaved?: () => void;
    cancelHref?: string;
    onTypeChange?: (type: CreationType) => void
};

export default function ExpenseCreationSwitcher(props: Props) {
    const inferredType: CreationType = props.initialType
        ?? (props.initialExpense?.expenseType === "VAT_SETTLEMENT" ? "vat" : props.initialExpense?.expenseType === "TAX_CONTRIBUTION" ? "tax" : props.initialExpense?.expenseType === "PAYROLL" ? "payroll" : "single");
    const [type, setType] = useState<CreationType>(inferredType);
    const [isRecurringDefinition, setIsRecurringDefinition] = useState(props.initialType === "recurring");
    const [typeConfirmed, setTypeConfirmed] = useState(Boolean(props.skipTypeStep || props.initialExpense?.id));
    const recurringEligible = type === "single" || type === "tax" || type === "payroll";
    const totalSteps = isRecurringDefinition && recurringEligible ? 7 : type === "single" ? 7 : 6;

    function changeType(nextType: CreationType) {
        setType(nextType);
        if (nextType === "vat" || nextType === "recurring") setIsRecurringDefinition(nextType === "recurring");
        props.onTypeChange?.(nextType);
    }

    function recurrenceControl(location: "external" | "internal") {
        //return <div className={`app-form-field full app-form-wizard-step app-form-wizard-step-1 switch-toggle-field switch-inline wide expense-recurring-definition-toggle expense-recurring-definition-toggle-${location}`}>
        return <div className={`app-form-field full app-form-wizard-step app-form-wizard-step-1 switch-toggle-field switch-inline wide`}>
            <div className="switch-toggle-field-label app-form-field-label">
                <span className="app-form-field-icon" aria-hidden="true">↻</span>
                <span className="app-form-label">Definizione ricorrente</span>
            </div>
            <label className="switch"><input type="checkbox" checked={isRecurringDefinition && recurringEligible} disabled={!recurringEligible} aria-label={recurringEligible ? "Definizione ricorrente" : "Definizione ricorrente non disponibile per questo tipo di spesa"} onChange={event => setIsRecurringDefinition(event.currentTarget.checked)}/>
                <span className="slider"/>
            </label>
        </div>;
    }

    const typeStep =
        <section className={`form app-record-form single-expense-form expense-creation-type-step app-form-wizard app-form-wizard-current-1 ${typeConfirmed ? "is-complete" : ""}`}>
            <div className="app-form-wizard-header full">
                <div className="app-form-wizard-heading">
                    <span>Passaggio 1 di {totalSteps}</span><strong><span>Tipo di spesa</span></strong></div>
                <div className="app-form-wizard-progress" aria-label={`Passaggio 1 di ${totalSteps}`}>
                    <span style={{width: `${100 / totalSteps}%`}}/></div>
            </div>
            <ExpenseTypeChoice selected={type} onSelect={changeType} onSelectCounter={() => window.location.assign("/expenses/counter")} title="Seleziona il tipo di spesa"/>
            {recurrenceControl("external")}
            {!typeConfirmed ?
                <MobileFormStickyActions currentStep={1} submitStep={2} onBack={() => undefined} onNext={() => setTypeConfirmed(true)} onCancel={props.onCancel} cancelHref={props.cancelHref ?? "/expenses"} submitLabel="Avanti"/> : null}
        </section>;

    const initialExpense = type === "vat"
        ? {...props.initialExpense, expenseType: "VAT_SETTLEMENT" as const}
        : type === "tax"
            ? {
                ...props.initialExpense,
                expenseType: "TAX_CONTRIBUTION" as const,
                isDeclared: false,
                affectsFiscalProfit: true,
                vatRate: 0,
                hasElectronicInvoice: false,
                invoiceStatus: "NON_PREVISTA"
            }
            : type === "payroll"
                ? {
                    ...props.initialExpense,
                    expenseType: "PAYROLL" as const,
                    isDeclared: false,
                    affectsFiscalProfit: true,
                    vatRate: 0,
                    hasElectronicInvoice: false,
                    invoiceStatus: "NON_PREVISTA"
                }
                : props.initialExpense;

    const recurringInitialExpense = {
        ...props.initialExpense,
        expenseType: type === "tax" ? "TAX_CONTRIBUTION" as const : type === "payroll" ? "PAYROLL" as const : "STANDARD" as const,
    };
    const form = isRecurringDefinition && recurringEligible
        ?
        <RecurringExpenseForm key={`recurring-${type}`} categories={props.categories} banks={props.banks} paymentMethods={props.paymentMethods} suppliers={props.suppliers} employees={props.employees} action={props.recurringAction} initialExpense={recurringInitialExpense} onCancel={props.onCancel} onSaved={props.onSaved} cancelHref={props.cancelHref} mobileStepOffset={1} onBackToType={props.skipTypeStep ? undefined : () => setTypeConfirmed(false)} hideMobileActions={!typeConfirmed} recurrenceControl={recurrenceControl("internal")}/>
        :
        <ExpenseForm key={type} categories={props.categories} banks={props.banks} paymentMethods={props.paymentMethods} suppliers={props.suppliers} employees={props.employees} action={props.expenseAction} title={props.title} submitLabel={props.submitLabel} initialExpense={initialExpense} onCancel={props.onCancel} onSaved={props.onSaved} cancelHref={props.cancelHref} onSwitchToRecurring={() => changeType("recurring")} onExpenseTypeChange={changeType} mobileStepOffset={1} onBackToType={props.skipTypeStep ? undefined : () => setTypeConfirmed(false)} hideMobileActions={!typeConfirmed} recurrenceControl={recurrenceControl("internal")}/>;

    return <>
        <div className={typeConfirmed ? "expense-creation-stage is-confirmed" : "expense-creation-stage"}>{typeStep}
            <div className="expense-creation-form-stage">{form}</div>
        </div>
    </>;
}
