"use client";

import { useState } from "react";
import ExpenseForm from "@/components/ExpenseForm";
import RecurringExpenseForm from "@/components/RecurringExpenseForm";
import MobileFormStickyActions from "@/components/MobileFormStickyActions";

type Option = { id: number; code?: string; name: string; icon?: string | null; isFallback?: boolean | null; kind?: string; systemRole?: string | null; isVatSettlementDefault?: boolean };
type SupplierOption = { id: number; businessName: string; alias?: string | null; email?: string | null; vatNumber?: string | null; iban?: string | null; pec?: string | null; taxCodeSdi?: string | null; internalNotes?: string | null; systemRole?: string | null; defaultExpenseCategoryId?: number | null; defaultVatRate?: string | number | null };
type InitialExpense = Parameters<typeof ExpenseForm>[0]["initialExpense"];

type CreationType = "single" | "recurring" | "vat" | "tax";
type Props = { categories: Option[]; banks: Option[]; paymentMethods: Option[]; suppliers: SupplierOption[]; expenseAction: string; recurringAction: string; initialExpense?: InitialExpense; initialType?: CreationType; skipTypeStep?: boolean; title?: string; submitLabel?: string; onCancel?: () => void; onSaved?: () => void; cancelHref?: string; onTypeChange?: (type: CreationType) => void };

export default function ExpenseCreationSwitcher(props: Props) {
  const inferredType: CreationType = props.initialType
    ?? (props.initialExpense?.expenseType === "VAT_SETTLEMENT" ? "vat" : props.initialExpense?.expenseType === "TAX_CONTRIBUTION" ? "tax" : "single");
  const [type, setType] = useState<CreationType>(inferredType);
  const [typeConfirmed, setTypeConfirmed] = useState(Boolean(props.skipTypeStep || props.initialExpense?.id));

  function changeType(nextType: CreationType) {
    setType(nextType);
    props.onTypeChange?.(nextType);
  }

  const typeStep = <section className={`expense-creation-type-step ${typeConfirmed ? "is-complete" : ""}`}>
    <div className="app-form-wizard-header full"><div className="app-form-wizard-heading"><span>Passaggio 1</span><strong>Tipo di spesa</strong></div></div>
    <div className="entry-type-choice full"><span className="entry-type-choice-title">Seleziona il tipo di spesa</span><div className="entry-type-choice-grid" role="radiogroup" aria-label="Tipo di spesa">
      <button type="button" role="radio" aria-checked={type === "single"} className={type === "single" ? "is-selected" : ""} onClick={() => changeType("single")}><span aria-hidden="true">●</span><strong>Singola</strong><small>Spesa occasionale</small></button>
      <button type="button" onClick={() => window.location.assign("/expenses/counter")}><span aria-hidden="true">🛍️</span><strong>Da banco</strong><small>Acquisto già pagato</small></button>
      <button type="button" role="radio" aria-checked={type === "recurring"} className={type === "recurring" ? "is-selected" : ""} onClick={() => changeType("recurring")}><span aria-hidden="true">↻</span><strong>Ricorrente</strong><small>Spesa periodica</small></button>
      <button type="button" role="radio" aria-checked={type === "vat"} className={type === "vat" ? "is-selected" : ""} onClick={() => changeType("vat")}><span aria-hidden="true">IVA</span><strong>Saldo IVA</strong><small>Versamento IVA</small></button>
      <button type="button" role="radio" aria-checked={type === "tax"} className={type === "tax" ? "is-selected" : ""} onClick={() => changeType("tax")}><span aria-hidden="true">F24</span><strong>Imposte</strong><small>Imposte e contributi non IVA</small></button>
    </div></div>
    {!typeConfirmed ? <MobileFormStickyActions currentStep={1} submitStep={2} onBack={() => undefined} onNext={() => setTypeConfirmed(true)} onCancel={props.onCancel} cancelHref={props.cancelHref ?? "/expenses"} submitLabel="Avanti" /> : null}
  </section>;

  const initialExpense = type === "vat"
    ? {...props.initialExpense, expenseType: "VAT_SETTLEMENT" as const}
    : type === "tax"
      ? {...props.initialExpense, expenseType: "TAX_CONTRIBUTION" as const, isDeclared: false, affectsFiscalProfit: true, vatRate: 0, hasElectronicInvoice: false, invoiceStatus: "NON_PREVISTA"}
    : props.initialExpense;

  const form = type === "recurring"
    ? <RecurringExpenseForm categories={props.categories} banks={props.banks} paymentMethods={props.paymentMethods} suppliers={props.suppliers} action={props.recurringAction} initialExpense={props.initialExpense} onCancel={props.onCancel} onSaved={props.onSaved} cancelHref={props.cancelHref} onSwitchToSingle={() => changeType("single")} onSwitchToVatSettlement={() => changeType("vat")} onSwitchToTaxContribution={() => changeType("tax")} mobileStepOffset={1} onBackToType={props.skipTypeStep ? undefined : () => setTypeConfirmed(false)} />
    : <ExpenseForm key={type} categories={props.categories} banks={props.banks} paymentMethods={props.paymentMethods} suppliers={props.suppliers} action={props.expenseAction} title={props.title} submitLabel={props.submitLabel} initialExpense={initialExpense} onCancel={props.onCancel} onSaved={props.onSaved} cancelHref={props.cancelHref} onSwitchToRecurring={() => changeType("recurring")} onExpenseTypeChange={changeType} mobileStepOffset={1} onBackToType={props.skipTypeStep ? undefined : () => setTypeConfirmed(false)} />;

  return <><div className={typeConfirmed ? "expense-creation-stage is-confirmed" : "expense-creation-stage"}>{typeStep}<div className="expense-creation-form-stage">{form}</div></div></>;
}
