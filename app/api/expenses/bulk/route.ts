import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';
import {addExpenseDays, expenseDateDayOffset, expenseDateInRelativeMonth} from '@/lib/expense-bulk-copy';
import {calendarDateInput, dateInputInTimeZone} from '@/lib/company-time';
import type {InvoiceStatus} from '@/generated/prisma/client';

function selectedIds(formData: FormData) {
  return formData.getAll('ids').map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0);
}

function safeReturnTo(request: Request) {
  return pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/expenses');
}

function todayAtMidnight(timeZone: string) {
  return new Date(`${dateInputInTimeZone(timeZone)}T00:00:00.000Z`);
}

function formBoolean(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true' || value === '1';
}

function civilDate(value: FormDataEntryValue | null) {
  const input = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(`${input}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input ? null : date;
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

  if (action === 'change_dates') {
    const updateOrderDate = formBoolean(formData.get('updateOrderDate'));
    const updateDueDate = formBoolean(formData.get('updateDueDate'));
    const orderDate = updateOrderDate ? civilDate(formData.get('orderDate')) : null;
    const dueDate = updateDueDate ? civilDate(formData.get('dueDate')) : null;
    if ((!updateOrderDate && !updateDueDate) || (updateOrderDate && !orderDate) || (updateDueDate && !dueDate)) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_dates'}));
    }

    const expenses = await prisma.expense.findMany({
      where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id},
      select: {id: true, expenseType: true, receivedDate: true, dueDate: true}
    });
    if (expenses.length !== new Set(ids).size) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_dates'}));
    }

    const changes = expenses.map(expense => {
      if (expense.expenseType === 'VAT_SETTLEMENT') {
        if (orderDate && dueDate && calendarDateInput(orderDate) !== calendarDateInput(dueDate)) return null;
        const settlementDate = orderDate ?? dueDate;
        if (!settlementDate) return null;
        return {id: expense.id, data: {receivedDate: settlementDate, dueDate: settlementDate}};
      }
      const nextOrderDate = orderDate ?? expense.receivedDate;
      const nextDueDate = dueDate ?? expense.dueDate;
      const orderKey = calendarDateInput(nextOrderDate);
      const dueKey = calendarDateInput(nextDueDate);
      if (!orderKey || !dueKey || dueKey < orderKey) return null;
      return {
        id: expense.id,
        data: {
          ...(updateOrderDate ? {receivedDate: orderDate} : {}),
          ...(updateDueDate ? {dueDate} : {})
        }
      };
    });
    if (changes.some(change => !change)) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_dates'}));
    }

    await prisma.$transaction(changes.map(change => prisma.expense.update({
      where: {id: change!.id},
      data: change!.data
    })));
    await writeAuditLog({
      workspaceId: current.workspace.id,
      userId: current.user.id,
      action: 'BULK_UPDATE',
      entityType: 'Expense',
      metadata: {
        ids,
        operation: action,
        updatedFields: [updateOrderDate ? 'receivedDate' : null, updateDueDate ? 'dueDate' : null].filter(Boolean),
        orderDate: orderDate ? calendarDateInput(orderDate) : null,
        dueDate: dueDate ? calendarDateInput(dueDate) : null
      },
      request
    });
    return redirectToPath(appendFlash(redirectTo, {saved: 'bulk_updated'}));
  }

  if (action === 'change_supplier') {
    const supplierId = Number(formData.get('supplierId'));
    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_supplier'}));
    }
    const [supplier, expenses] = await Promise.all([
      prisma.supplier.findFirst({
        where: {id: supplierId, workspaceId: current.workspace.id, systemRole: null},
        select: {id: true, businessName: true}
      }),
      prisma.expense.findMany({
        where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id},
        select: {id: true, expenseType: true}
      })
    ]);
    if (!supplier) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_supplier'}));
    }
    if (expenses.length !== new Set(ids).size || expenses.some(expense => expense.expenseType !== 'STANDARD')) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_supplier_records'}));
    }

    const updated = await prisma.expense.updateMany({
      where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id, expenseType: 'STANDARD'},
      data: {supplierId: supplier.id, merchant: supplier.businessName}
    });
    await writeAuditLog({
      workspaceId: current.workspace.id,
      userId: current.user.id,
      action: 'BULK_UPDATE',
      entityType: 'Expense',
      metadata: {ids, operation: action, supplierId: supplier.id, supplierName: supplier.businessName, updated: updated.count},
      request
    });
    return redirectToPath(appendFlash(redirectTo, {saved: 'bulk_updated'}));
  }

  if (action === 'change_accounting') {
    const updateFiscal = formBoolean(formData.get('updateFiscal'));
    const updateVatRate = formBoolean(formData.get('updateVatRate'));
    const updateBillingPeriod = formBoolean(formData.get('updateBillingPeriod'));
    const updateElectronicInvoice = formBoolean(formData.get('updateElectronicInvoice'));
    const updateInvoiceStatus = formBoolean(formData.get('updateInvoiceStatus'));
    if (!(updateFiscal || updateVatRate || updateBillingPeriod || updateElectronicInvoice || updateInvoiceStatus)) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_accounting'}));
    }
    const fiscalValue = formBoolean(formData.get('fiscalValue'));
    const electronicInvoice = formBoolean(formData.get('electronicInvoice'));
    const vatRate = Number(formData.get('vatRate'));
    const validVatRates = [0, 4, 10, 22];
    const invoiceStatus = String(formData.get('invoiceStatus') ?? '');
    const validInvoiceStatuses = ['NON_PREVISTA', 'IN_ATTESA', 'PARZIALE', 'RICEVUTA', 'CONTESTAZIONE'] as const;
    const billingPeriod = String(formData.get('billingPeriod') ?? '');
    const billingMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(billingPeriod);
    if ((updateVatRate && !validVatRates.includes(vatRate)) || (updateInvoiceStatus && !validInvoiceStatuses.includes(invoiceStatus as typeof validInvoiceStatuses[number])) || (updateBillingPeriod && !billingMatch)) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_accounting'}));
    }

    const expenses = await prisma.expense.findMany({
      where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id},
      select: {id: true, expenseType: true, isDeclared: true, vatRate: true, hasElectronicInvoice: true, invoiceStatus: true}
    });
    if (expenses.length !== new Set(ids).size || expenses.some(expense => expense.expenseType !== 'STANDARD')) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_accounting_records'}));
    }

    const changes = expenses.map(expense => {
      let nextFiscal = updateFiscal ? fiscalValue : expense.isDeclared;
      let nextVatRate = updateVatRate ? vatRate : Number(expense.vatRate);
      let nextElectronic = updateElectronicInvoice ? electronicInvoice : expense.hasElectronicInvoice;
      let nextInvoiceStatus = updateInvoiceStatus ? invoiceStatus : expense.invoiceStatus;

      if (updateFiscal && !fiscalValue) {
        nextFiscal = false;
        nextVatRate = 0;
        nextElectronic = false;
        nextInvoiceStatus = 'NON_PREVISTA';
      } else {
        if (nextVatRate > 0 || nextElectronic || nextInvoiceStatus !== 'NON_PREVISTA') nextFiscal = true;
        if (nextElectronic && nextInvoiceStatus === 'NON_PREVISTA') {
          if (updateInvoiceStatus) return null;
          nextInvoiceStatus = 'IN_ATTESA';
        }
        if (!nextFiscal) {
          nextVatRate = 0;
          nextElectronic = false;
          nextInvoiceStatus = 'NON_PREVISTA';
        }
      }

      return {
        id: expense.id,
        data: {
          isDeclared: nextFiscal,
          vatRate: nextVatRate,
          hasElectronicInvoice: nextElectronic,
          invoiceStatus: nextInvoiceStatus as InvoiceStatus,
          ...(updateBillingPeriod && billingMatch ? {year: Number(billingMatch[1]), month: Number(billingMatch[2])} : {})
        }
      };
    });
    if (changes.some(change => !change)) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_accounting'}));
    }

    await prisma.$transaction(changes.map(change => prisma.expense.update({where: {id: change!.id}, data: change!.data})));
    await writeAuditLog({
      workspaceId: current.workspace.id,
      userId: current.user.id,
      action: 'BULK_UPDATE',
      entityType: 'Expense',
      metadata: {
        ids,
        operation: action,
        updatedFields: [updateFiscal ? 'isDeclared' : null, updateVatRate ? 'vatRate' : null, updateBillingPeriod ? 'billingPeriod' : null, updateElectronicInvoice ? 'hasElectronicInvoice' : null, updateInvoiceStatus ? 'invoiceStatus' : null].filter(Boolean),
        values: {fiscalValue, vatRate, billingPeriod: updateBillingPeriod ? billingPeriod : null, electronicInvoice, invoiceStatus}
      },
      request
    });
    return redirectToPath(appendFlash(redirectTo, {saved: 'bulk_updated'}));
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
