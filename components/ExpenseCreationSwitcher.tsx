"use client";

import { useState } from "react";
import ExpenseForm from "@/components/ExpenseForm";
import RecurringExpenseForm from "@/components/RecurringExpenseForm";

type Option = { id: number; code?: string; name: string; icon?: string | null };
type SupplierOption = { id: number; businessName: string; alias?: string | null; email?: string | null; phone?: string | null; pec?: string | null; taxCodeSdi?: string | null; internalNotes?: string | null };
type InitialExpense = Parameters<typeof ExpenseForm>[0]["initialExpense"];

type Props = { categories: Option[]; banks: Option[]; suppliers: SupplierOption[]; expenseAction: string; recurringAction: string; initialExpense?: InitialExpense; title?: string; submitLabel?: string; onCancel?: () => void; cancelHref?: string };

export default function ExpenseCreationSwitcher(props: Props) {
  const [type, setType] = useState<"single" | "recurring">("single");

  if (type === "recurring") {
    return <RecurringExpenseForm categories={props.categories} banks={props.banks} suppliers={props.suppliers} action={props.recurringAction} onCancel={props.onCancel} cancelHref={props.cancelHref} onSwitchToSingle={() => setType("single")} />;
  }

  return <ExpenseForm categories={props.categories} banks={props.banks} suppliers={props.suppliers} action={props.expenseAction} title={props.title} submitLabel={props.submitLabel} initialExpense={props.initialExpense} onCancel={props.onCancel} cancelHref={props.cancelHref} onSwitchToRecurring={() => setType("recurring")} />;
}
