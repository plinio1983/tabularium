import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expenseId = Number(id);

  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return NextResponse.json({ error: 'ID spesa non valido' }, { status: 400 });
  }

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { payments: { orderBy: { id: 'asc' } }, supplier: true }
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
      categoryId: expense.categoryId,
      description: expense.description,
      amount: expense.amount.toString(),
      vatRate: expense.vatRate.toString(),
      paymentStatus: expense.paymentStatus,
      month: expense.month,
      year: expense.year,
      hasElectronicInvoice: expense.hasElectronicInvoice,
      invoiceStatus: expense.invoiceStatus,
      isDeclared: expense.isDeclared,
      notes: expense.notes,
      payments: expense.payments.map(payment => ({
        id: payment.id,
        paymentDate: payment.paymentDate,
        channel: payment.channel,
        bankId: payment.bankId,
        amount: payment.amount.toString(),
        paidBy: payment.paidBy
      }))
    }
  });
}
