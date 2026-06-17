import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/auth';

function selectedIds(formData: FormData) {
  return formData.getAll('ids').map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0);
}

function safeReturnTo(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = requestUrl.searchParams.get('returnTo') || '/expenses';
  try {
    const url = returnTo.startsWith('http') ? new URL(returnTo) : new URL(returnTo, request.url);
    if (url.origin !== requestUrl.origin) return '/expenses';
    return `${url.pathname}${url.search}`;
  } catch {
    return returnTo.startsWith('/') ? returnTo : '/expenses';
  }
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
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  }

  if (action === 'delete') {
    await prisma.expense.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id } });
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  }

  if (action === 'invoice_emitted') {
    const expenses = await prisma.expense.findMany({ where: { id: { in: ids }, workspaceId: current.workspace.id }, select: { id: true, hasElectronicInvoice: true } });
    await prisma.$transaction(expenses.map(expense => prisma.expense.update({
      where: { id: expense.id },
      data: { invoiceStatus: 'RICEVUTA' }
    })));
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
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
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  }

  return NextResponse.redirect(new URL(redirectTo, request.url), 303);
}
