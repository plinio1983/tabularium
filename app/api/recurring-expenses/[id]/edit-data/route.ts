import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/auth';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const { id } = await params;
  const recurringExpenseId = Number(id);

  if (!Number.isInteger(recurringExpenseId) || recurringExpenseId <= 0) {
    return NextResponse.json({ error: 'ID spesa ricorrente non valido' }, { status: 400 });
  }

  const expense = await prisma.recurringExpense.findFirst({
    where: { id: recurringExpenseId, workspaceId: current.workspace.id, companyId: current.company.id },
    include: { supplier: true }
  });

  if (!expense) {
    return NextResponse.json({ error: 'Spesa ricorrente non trovata' }, { status: 404 });
  }

  return NextResponse.json({
    expense: {
      id: expense.id,
      startDate: expense.startDate,
      endDate: expense.endDate,
      archivedAt: expense.archivedAt,
      cadence: expense.cadence,
      dueDay: expense.dueDay,
      dueMonth: expense.dueMonth,
      generationTiming: expense.generationTiming,
      expenseType: expense.expenseType,
      isAutomaticPayment: expense.isAutomaticPayment,
      billingPeriodMode: expense.billingPeriodMode,
      billingMonth: expense.billingMonth,
      merchant: expense.merchant,
      supplierId: expense.supplierId,
      taxAuthorityId: expense.taxAuthorityId,
      employeeId: expense.employeeId,
      categoryId: expense.categoryId,
      description: expense.description,
      amount: expense.amount.toString(),
      payrollNetAmount: expense.payrollNetAmount?.toString() ?? null,
      payrollExtraCompensation: expense.payrollExtraCompensation?.toString() ?? null,
      payrollGrossAmount: expense.payrollGrossAmount?.toString() ?? null,
      payrollEmployerCost: expense.payrollEmployerCost?.toString() ?? null,
      payrollPeriodMode: expense.payrollPeriodMode,
      payrollPeriodMonthOffset: expense.payrollPeriodMonthOffset,
      payrollPeriodStartDay: expense.payrollPeriodStartDay,
      payrollPeriodEndDay: expense.payrollPeriodEndDay,
      vatRate: expense.vatRate.toString(),
      isDeclared: expense.isDeclared,
      hasElectronicInvoice: expense.hasElectronicInvoice,
      affectsFiscalProfit: expense.affectsFiscalProfit,
      paymentMethodId: expense.paymentMethodId,
      bankId: expense.bankId,
      notes: expense.notes
    }
  });
}
