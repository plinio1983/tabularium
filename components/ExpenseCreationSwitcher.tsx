"use client";

import { useState } from "react";
import ExpenseForm from "@/components/ExpenseForm";
import RecurringExpenseForm from "@/components/RecurringExpenseForm";

type Option = { id: number; code?: string; name: string; icon?: string | null; isFallback?: boolean | null; kind?: string; systemRole?: string | null; isVatSettlementDefault?: boolean };
type SupplierOption = { id: number; businessName: string; alias?: string | null; email?: string | null; vatNumber?: string | null; iban?: string | null; pec?: string | null; taxCodeSdi?: string | null; internalNotes?: string | null; systemRole?: string | null; defaultExpenseCategoryId?: number | null };
type InitialExpense = Parameters<typeof ExpenseForm>[0]["initialExpense"];

type Props = { categories: Option[]; banks: Option[]; paymentMethods: Option[]; suppliers: SupplierOption[]; expenseAction: string; recurringAction: string; initialExpense?: InitialExpense; title?: string; submitLabel?: string; onCancel?: () => void; onSaved?: () => void; cancelHref?: string; onTypeChange?: (type: "single" | "recurring" | "vat") => void };

export default function ExpenseCreationSwitcher(props: Props) {
  const [type, setType] = useState<"single" | "recurring" | "vat">("single");

  function changeType(nextType: "single" | "recurring" | "vat") {
    setType(nextType);
    props.onTypeChange?.(nextType);
  }

  if (type === "recurring") {
    return <RecurringExpenseForm categories={props.categories} banks={props.banks} paymentMethods={props.paymentMethods} suppliers={props.suppliers} action={props.recurringAction} initialExpense={props.initialExpense} onCancel={props.onCancel} onSaved={props.onSaved} cancelHref={props.cancelHref} onSwitchToSingle={() => changeType("single")} onSwitchToVatSettlement={() => changeType("vat")} />;
  }

  const initialExpense = type === "vat"
    ? {...props.initialExpense, expenseType: "VAT_SETTLEMENT" as const}
    : props.initialExpense;

  return <ExpenseForm categories={props.categories} banks={props.banks} paymentMethods={props.paymentMethods} suppliers={props.suppliers} action={props.expenseAction} title={props.title} submitLabel={props.submitLabel} initialExpense={initialExpense} onCancel={props.onCancel} onSaved={props.onSaved} cancelHref={props.cancelHref} onSwitchToRecurring={() => changeType("recurring")} onExpenseTypeChange={changeType} />;
}
