import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';

function selectedIds(formData: FormData) {
  return formData.getAll('ids').map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0);
}

function safeReturnTo(request: Request) {
  return pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/expenses');
}

function todayAtMidnight() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function POST(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const formData = await request.formData();
  const action = String(formData.get('bulkAction') || '');
  const ids = selectedIds(formData);
  const redirectTo = safeReturnTo(request);

  if (!ids.length || !action) {
    return redirectToPath(redirectTo);
  }

  if (action === 'change_category') {
    const categoryId = Number(formData.get('categoryId'));
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return redirectToPath(redirectTo);
    }
    const category = await prisma.expenseCategory.findFirst({
      where: { id: categoryId, workspaceId: current.workspace.id }
    });
    if (!category) return redirectToPath(redirectTo);

    await prisma.expense.updateMany({
      where: { id: { in: ids }, workspaceId: current.workspace.id },
      data: { categoryId }
    });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
  }

  if (action === 'delete') {
    await prisma.expense.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id } });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_deleted' }));
  }

  if (action === 'invoice_emitted') {
    const expenses = await prisma.expense.findMany({ where: { id: { in: ids }, workspaceId: current.workspace.id }, select: { id: true, hasElectronicInvoice: true } });
    await prisma.$transaction(expenses.map(expense => prisma.expense.update({
      where: { id: expense.id },
      data: { invoiceStatus: 'RICEVUTA' }
    })));
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
  }

  if (action === 'payment_completed') {
    const today = todayAtMidnight();
    const expenses = await prisma.expense.findMany({
      where: { id: { in: ids }, workspaceId: current.workspace.id },
      include: { payments: true }
    });

    await prisma.$transaction(expenses.flatMap(expense => {
      const amount = Number(expense.amount.toString());
      const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
      const residual = Math.max(0, amount - paid);
      const operations = [];
      if (residual > 0) {
        operations.push(prisma.expensePayment.create({ data: {
          expenseId: expense.id,
          paymentDate: today,
          channel: expense.channel,
          paymentMethodId: expense.payments[0]?.paymentMethodId ?? null,
          bankId: expense.bankId,
          amount: residual,
          paidBy: expense.paidBy
        } }));
      }
      operations.push(prisma.expense.update({
        where: { id: expense.id },
        data: {
          paymentStatus: 'COMPLETATO',
          isComplete: true,
          paymentDate: today,
          paidAmount: amount
        }
      }));
      return operations;
    }));
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
  }

  return redirectToPath(redirectTo);
}
