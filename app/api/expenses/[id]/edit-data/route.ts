import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/auth';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const { id } = await params;
  const expenseId = Number(id);

  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return NextResponse.json({ error: 'ID spesa non valido' }, { status: 400 });
  }

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, workspaceId: current.workspace.id, companyId: current.company.id },
    include: { payments: { orderBy: { id: 'asc' } }, attachments: {orderBy: {id: 'asc'}}, supplier: true, employee: true }
  });

  if (!expense) {
    return NextResponse.json({ error: 'Spesa non trovata' }, { status: 404 });
  }

  return NextResponse.json({
    expense: {
      id: expense.id,
      receivedDate: expense.receivedDate,
      dueDate: expense.dueDate,
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
      expenseType: expense.expenseType,
      vatRate: expense.vatRate.toString(),
      paymentStatus: expense.paymentStatus,
      month: expense.month,
      year: expense.year,
      hasElectronicInvoice: expense.hasElectronicInvoice,
      invoiceStatus: expense.invoiceStatus,
      isDeclared: expense.isDeclared,
      affectsFiscalProfit: expense.affectsFiscalProfit,
      isRecurring: expense.isRecurring,
      notes: expense.notes,
      attachments: expense.attachments.map(attachment => ({
        id: attachment.id,
        originalName: attachment.originalName,
        sizeBytes: attachment.sizeBytes,
        type: attachment.type
      })),
      payments: expense.payments.map(payment => ({
        id: payment.id,
        paymentDate: payment.paymentDate,
        paymentMethodId: payment.paymentMethodId,
        bankId: payment.bankId,
        amount: payment.amount.toString()
      }))
    }
  });
}
