import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';
import {calendarDateInput} from '@/lib/company-time';

function selectedIds(formData: FormData) {
  return formData.getAll('ids').map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0);
}

function safeReturnTo(request: Request) {
  return pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/incomes');
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
    const incomes = await prisma.income.findMany({
      where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id},
      select: {id: true, incomeType: true, orderDate: true, dueDate: true}
    });
    if (incomes.length !== new Set(ids).size || incomes.some(income => income.incomeType !== 'STANDARD')) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_records'}));
    }
    const changes = incomes.map(income => {
      const nextOrderDate = orderDate ?? income.orderDate;
      const nextDueDate = dueDate ?? income.dueDate;
      const orderKey = calendarDateInput(nextOrderDate);
      const dueKey = calendarDateInput(nextDueDate);
      if (!orderKey || !dueKey || dueKey < orderKey) return null;
      return {id: income.id, data: {...(updateOrderDate ? {orderDate} : {}), ...(updateDueDate ? {dueDate} : {})}};
    });
    if (changes.some(change => !change)) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_dates'}));
    }
    await prisma.$transaction(changes.map(change => prisma.income.update({where: {id: change!.id}, data: change!.data})));
    await writeAuditLog({workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE', entityType: 'Income', metadata: {ids, operation: action, updatedFields: [updateOrderDate ? 'orderDate' : null, updateDueDate ? 'dueDate' : null].filter(Boolean)}, request});
    return redirectToPath(appendFlash(redirectTo, {saved: 'bulk_updated'}));
  }

  if (action === 'change_customer') {
    const customerId = Number(formData.get('customerId'));
    const [customer, incomes] = await Promise.all([
      prisma.customer.findFirst({where: {id: customerId, workspaceId: current.workspace.id, systemRole: null}, select: {id: true, businessName: true}}),
      prisma.income.findMany({where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id}, select: {id: true, incomeType: true}})
    ]);
    if (!customer || incomes.length !== new Set(ids).size || incomes.some(income => income.incomeType !== 'STANDARD')) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_customer'}));
    }
    const updated = await prisma.income.updateMany({where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id, incomeType: 'STANDARD'}, data: {customerId: customer.id}});
    await writeAuditLog({workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE', entityType: 'Income', metadata: {ids, operation: action, customerId: customer.id, customerName: customer.businessName, updated: updated.count}, request});
    return redirectToPath(appendFlash(redirectTo, {saved: 'bulk_updated'}));
  }

  if (action === 'change_sales_channel') {
    const salesChannelId = Number(formData.get('salesChannelId'));
    const [salesChannel, incomes] = await Promise.all([
      prisma.incomeSalesChannel.findFirst({where: {id: salesChannelId, workspaceId: current.workspace.id}, select: {id: true, name: true}}),
      prisma.income.findMany({where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id}, select: {id: true, incomeType: true}})
    ]);
    if (!salesChannel || incomes.length !== new Set(ids).size || incomes.some(income => income.incomeType !== 'STANDARD')) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_sales_channel'}));
    }
    const updated = await prisma.income.updateMany({where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id, incomeType: 'STANDARD'}, data: {salesChannelId: salesChannel.id}});
    await writeAuditLog({workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE', entityType: 'Income', metadata: {ids, operation: action, salesChannelId: salesChannel.id, salesChannelName: salesChannel.name, updated: updated.count}, request});
    return redirectToPath(appendFlash(redirectTo, {saved: 'bulk_updated'}));
  }

  if (action === 'change_accounting') {
    const updateFiscal = formBoolean(formData.get('updateFiscal'));
    const updateVatRate = formBoolean(formData.get('updateVatRate'));
    const updateBillingPeriod = formBoolean(formData.get('updateBillingPeriod'));
    const updateInvoiceStatus = formBoolean(formData.get('updateInvoiceStatus'));
    if (!(updateFiscal || updateVatRate || updateBillingPeriod || updateInvoiceStatus)) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_accounting'}));
    }
    const fiscalValue = formBoolean(formData.get('fiscalValue'));
    const vatRate = Number(formData.get('vatRate'));
    const validVatRates = [0, 4, 10, 22];
    const invoiceStatus = String(formData.get('invoiceStatus') ?? '');
    const validInvoiceStatuses = ['NON_INVIATA', 'PARZIALE', 'EMESSA'];
    const billingPeriod = String(formData.get('billingPeriod') ?? '');
    const billingMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(billingPeriod);
    if ((updateVatRate && !validVatRates.includes(vatRate)) || (updateInvoiceStatus && !validInvoiceStatuses.includes(invoiceStatus)) || (updateBillingPeriod && !billingMatch)) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_accounting'}));
    }
    const incomes = await prisma.income.findMany({
      where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id},
      select: {id: true, incomeType: true, isFiscal: true, vatRate: true, invoiceStatus: true}
    });
    if (incomes.length !== new Set(ids).size || incomes.some(income => income.incomeType !== 'STANDARD')) {
      return redirectToPath(appendFlash(redirectTo, {error: 'invalid_bulk_records'}));
    }
    const changes = incomes.map(income => {
      let nextFiscal = updateFiscal ? fiscalValue : income.isFiscal;
      let nextVatRate = updateVatRate ? vatRate : Number(income.vatRate);
      let nextInvoiceStatus = updateInvoiceStatus ? invoiceStatus : income.invoiceStatus;
      if (updateFiscal && !fiscalValue) {
        nextFiscal = false;
        nextVatRate = 0;
        nextInvoiceStatus = null;
      } else {
        if (nextVatRate > 0 || nextInvoiceStatus) nextFiscal = true;
        if (nextFiscal && !nextInvoiceStatus) nextInvoiceStatus = 'NON_INVIATA';
        if (!nextFiscal) {
          nextVatRate = 0;
          nextInvoiceStatus = null;
        }
      }
      return {id: income.id, data: {isFiscal: nextFiscal, vatRate: nextVatRate, invoiceStatus: nextInvoiceStatus, ...(updateBillingPeriod && billingMatch ? {billingYear: Number(billingMatch[1]), billingMonth: Number(billingMatch[2])} : {})}};
    });
    await prisma.$transaction(changes.map(change => prisma.income.update({where: {id: change.id}, data: change.data})));
    await writeAuditLog({workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE', entityType: 'Income', metadata: {ids, operation: action, updatedFields: [updateFiscal ? 'isFiscal' : null, updateVatRate ? 'vatRate' : null, updateBillingPeriod ? 'billingPeriod' : null, updateInvoiceStatus ? 'invoiceStatus' : null].filter(Boolean)}, request});
    return redirectToPath(appendFlash(redirectTo, {saved: 'bulk_updated'}));
  }

  if (action === 'delete') {
    const deleted = await prisma.income.deleteMany({ where: { id: { in: ids }, workspaceId: current.workspace.id, companyId: current.company.id } });
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_DELETE',
      entityType: 'Income', metadata: { ids, deleted: deleted.count }, request
    });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_deleted' }));
  }

  if (action === 'invoice_emitted') {
    await prisma.income.updateMany({ where: { id: { in: ids }, workspaceId: current.workspace.id, companyId: current.company.id, isFiscal: true }, data: { invoiceStatus: 'EMESSA' } });
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE',
      entityType: 'Income', metadata: { ids, operation: action }, request
    });
    return redirectToPath(appendFlash(redirectTo, { saved: 'bulk_updated' }));
  }

  return redirectToPath(redirectTo);
}
