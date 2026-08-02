import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';
import {addExpenseDays, expenseDateDayOffset, expenseDateInRelativeMonth} from '@/lib/expense-bulk-copy';
import {dateInputInTimeZone} from '@/lib/company-time';

function selectedIds(formData: FormData) {
  return formData.getAll('ids').map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0);
}

function safeReturnTo(request: Request) {
  return pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/expenses');
}

function todayAtMidnight(timeZone: string) {
  return new Date(`${dateInputInTimeZone(timeZone)}T00:00:00.000Z`);
}

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
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
      where: { id: { in: ids }, workspaceId: current.workspace.id, companyId: current.company.id, expenseType: 'STANDARD' },
      data: { categoryId }
    });
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE',
      entityType: 'Expense', metadata: { ids, operation: action, categoryId }, request
    });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
  }

  if (action === 'delete') {
    const deleted = await prisma.expense.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id, companyId: current.company.id } });
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_DELETE',
      entityType: 'Expense', metadata: { ids, deleted: deleted.count }, request
    });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_deleted' }));
  }

  if (action === 'copy') {
    const now = todayAtMidnight(current.company.timeZone);
    const today = now;
    const dateMode = String(formData.get('dateMode') || 'CURRENT_MONTH_SAME_DAY');
    const paymentMode = String(formData.get('paymentMode') || 'NONE');
    const validDateModes = ['ORIGINAL', 'CURRENT_MONTH_SAME_DAY', 'FROM_TODAY'];
    const validPaymentModes = ['NONE', 'ORIGINAL', 'TODAY', 'RELATIVE_TO_ORDER'];
    if (!validDateModes.includes(dateMode) || !validPaymentModes.includes(paymentMode)) {
      return redirectToPath(appendFlash(redirectTo, { error: 'invalid_bulk_copy_options' }));
    }
    const expenses = await prisma.expense.findMany({
      where: { id: { in: ids }, workspaceId: current.workspace.id, companyId: current.company.id },
      include: { payments: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' }
    });

    await prisma.$transaction(expenses.map(expense => {
      let receivedDate: Date | null;
      let dueDate: Date | null;
      if (dateMode === 'ORIGINAL') {
        receivedDate = expense.receivedDate ? new Date(expense.receivedDate) : null;
        dueDate = expense.dueDate ? new Date(expense.dueDate) : null;
      } else if (dateMode === 'FROM_TODAY') {
        receivedDate = today;
        const dueOffset = expenseDateDayOffset(expense.receivedDate, expense.dueDate);
        dueDate = dueOffset === null ? null : addExpenseDays(receivedDate, dueOffset);
      } else {
        receivedDate = expense.receivedDate
          ? expenseDateInRelativeMonth(expense.receivedDate, expense.receivedDate, now)
          : today;
        dueDate = expenseDateInRelativeMonth(expense.dueDate, expense.receivedDate, now);
      }

      const copiedPayments = paymentMode === 'NONE' ? [] : expense.payments.map(payment => {
        let paymentDate: Date | null = payment.paymentDate ? new Date(payment.paymentDate) : null;
        if (paymentMode === 'TODAY') paymentDate = today;
        if (paymentMode === 'RELATIVE_TO_ORDER') {
          const offset = expenseDateDayOffset(expense.receivedDate, payment.paymentDate);
          paymentDate = offset === null || !receivedDate ? null : addExpenseDays(receivedDate, offset);
        }
        return {
          paymentDate,
          paymentMethodId: payment.paymentMethodId,
          bankId: payment.bankId,
          amount: payment.amount
        };
      });
      const amount = Number(expense.amount);
      const paidAmount = copiedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const isComplete = amount > 0 && paidAmount >= amount;
      const paymentStatus = isComplete ? 'COMPLETATO' : paidAmount > 0 ? 'PAGATO_PARZIALMENTE' : 'DA_PAGARE';
      const accountingDate = receivedDate ?? now;

      return prisma.expense.create({
        data: {
          workspaceId: expense.workspaceId,
          expenseType: expense.expenseType,
          receivedDate,
          merchant: expense.merchant,
          supplierId: expense.supplierId,
          categoryId: expense.categoryId,
          description: expense.description,
          amount: expense.amount,
          paymentDate: copiedPayments[0]?.paymentDate ?? null,
          dueDate,
          vatRate: expense.vatRate,
          isComplete,
          isDeclared: expense.isDeclared,
          hasElectronicInvoice: expense.hasElectronicInvoice,
          isRecurring: false,
          isAutomaticPayment: false,
          invoiceStatus: expense.invoiceStatus,
          companyId: expense.companyId,
          month: dateMode === 'ORIGINAL' ? expense.month : accountingDate.getUTCMonth() + 1,
          year: dateMode === 'ORIGINAL' ? expense.year : accountingDate.getUTCFullYear(),
          notes: expense.notes,
          paymentStatus,
          paidAmount,
          invoiceDocumentPath: null,
          recurringExpenseId: null,
          recurringExpensePeriodKey: null,
          payments: copiedPayments.length ? { create: copiedPayments } : undefined
        }
      });
    }));
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_CREATE',
      entityType: 'Expense', metadata: {
        sourceIds: ids,
        operation: action,
        created: expenses.length,
        dateMode,
        paymentMode
      }, request
    });

    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_copied' }));
  }

  if (action === 'invoice_emitted') {
    const expenses = await prisma.expense.findMany({ where: { id: { in: ids }, workspaceId: current.workspace.id, companyId: current.company.id, expenseType: 'STANDARD' }, select: { id: true, hasElectronicInvoice: true } });
    await prisma.$transaction(expenses.map(expense => prisma.expense.update({
      where: { id: expense.id },
      data: { invoiceStatus: 'RICEVUTA' }
    })));
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE',
      entityType: 'Expense', metadata: { ids, operation: action }, request
    });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
  }

  if (action === 'payment_completed') {
    const today = todayAtMidnight(current.company.timeZone);
    const [expenses, fallbackMethod] = await Promise.all([
      prisma.expense.findMany({
        where: { id: { in: ids }, workspaceId: current.workspace.id, companyId: current.company.id },
        include: { payments: true }
      }),
      prisma.paymentMethod.findFirst({
        where: {
          workspaceId: current.workspace.id,
          OR: [{ isFallback: true }, { kind: { in: ['EXPENSE', 'BOTH'] } }]
        },
        orderBy: [{ isFallback: 'desc' }, { name: 'asc' }]
      })
    ]);

    await prisma.$transaction(expenses.flatMap(expense => {
      const amount = Number(expense.amount.toString());
      const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
      const residual = Math.max(0, amount - paid);
      const operations = [];
      if (residual > 0) {
        const paymentMethodId = expense.payments[0]?.paymentMethodId ?? fallbackMethod?.id;
        if (!paymentMethodId) throw new Error('Nessun metodo di pagamento disponibile');
        operations.push(prisma.expensePayment.create({ data: {
          expenseId: expense.id,
          paymentDate: today,
          paymentMethodId,
          bankId: expense.payments[0]?.bankId ?? null,
          amount: residual
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
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE',
      entityType: 'Expense', metadata: { ids, operation: action }, request
    });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
  }

  return redirectToPath(redirectTo);
}
