import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { SupplierReferenceError, resolveExistingSupplierReference } from '@/lib/supplier-reference';
import { AttachmentValidationError, saveExpenseAttachmentFiles } from '@/lib/attachments';
import { writeAuditLog } from '@/lib/audit';

const BooleanFromForm = z.preprocess((value) => value === true || value === 'true' || value === 'on' || value === '1', z.boolean());

const ExpenseSchema = z.object({
  receivedDate: z.string().optional(),
  dueDate: z.string().optional(),
  merchant: z.string().optional().default(''),
  supplierId: z.coerce.number().optional().nullable(),
  categoryId: z.coerce.number().optional().nullable(),
  description: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  expenseType: z.enum(['STANDARD', 'VAT_SETTLEMENT']).default('STANDARD'),
  vatRate: z.coerce.number().default(22),
  isDeclared: BooleanFromForm.default(false),
  isRecurring: BooleanFromForm.default(false),
  hasElectronicInvoice: BooleanFromForm.default(false),
  invoiceStatus: z.enum(['NON_PREVISTA', 'IN_ATTESA', 'INVIATA_SDI', 'CONTESTAZIONE', 'RICEVUTA']).default('IN_ATTESA'),
  billingPeriod: z.string().optional(),
  paymentStatus: z.enum(['DA_PAGARE', 'COMPLETATO', 'PAGATO_PARZIALMENTE']).default('DA_PAGARE'),
  notes: z.string().optional()
});



async function resolveCategoryId(categoryId: number | null | undefined, workspaceId: number) {
  if (!categoryId) return null;
  const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, workspaceId } });
  if (!category) throw new Error('Categoria non valida');
  return category.id;
}

async function resolvePaymentInputs(payments: PaymentInput[], workspaceId: number, forbidCash = false) {
  if (!payments.length) return payments;
  const methods = await prisma.paymentMethod.findMany({ where: { workspaceId } });
  return payments.map(payment => {
    const method = payment.paymentMethodId
      ? methods.find(item => item.id === payment.paymentMethodId)
      : null;
    if (!method) throw new Error('Metodo pagamento non valido');
    if (forbidCash && method && (method.systemRole === 'CASH' || method.name.trim().toLowerCase() === 'cash')) throw new Error('Cash non è disponibile per i saldi IVA');
    return { ...payment, paymentMethodId: method.id };
  });
}

function safePath(value: string | null, fallback: string, requestUrl: string) {
  return pathFromUrl(value, fallback);
}

function normalizeInvoiceFields(data: z.infer<typeof ExpenseSchema>) {
  if (!data.isDeclared) {
    return { isDeclared: false, hasElectronicInvoice: false, invoiceStatus: 'NON_PREVISTA' as const };
  }
  return {
    isDeclared: data.isDeclared,
    hasElectronicInvoice: data.hasElectronicInvoice,
    invoiceStatus: data.invoiceStatus === 'INVIATA_SDI' ? 'RICEVUTA' as const : data.invoiceStatus,
  };
}

type PaymentInput = {
  paymentDate?: string;
  paymentMethodId?: number | null;
  bankId?: number | null;
  amount: number;
};

function resolveBillingPeriod(billingPeriod?: string) {
  if (billingPeriod) {
    const [year, month] = billingPeriod.split('-').map(Number);
    if (year && month) return { year, month };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function getAll(formData: FormData, key: string) {
  return formData.getAll(key).map(value => String(value || '').trim());
}

function parsePayments(formData: FormData): PaymentInput[] {
  const dates = getAll(formData, 'paymentDate[]');
  const methodIds = getAll(formData, 'paymentMethodId[]');
  const banks = getAll(formData, 'paymentBankId[]');
  const amounts = getAll(formData, 'paymentAmount[]');
  const length = Math.max(dates.length, methodIds.length, banks.length, amounts.length);
  const payments: PaymentInput[] = [];

  for (let index = 0; index < length; index++) {
    const amount = Number(amounts[index] || 0);
    const bankId = banks[index] ? Number(banks[index]) : null;
    const paymentDate = dates[index] || undefined;
    const paymentMethodId = methodIds[index] ? Number(methodIds[index]) : null;
    if (amount > 0 || paymentDate || bankId || paymentMethodId) {
      payments.push({ amount, bankId, paymentDate, paymentMethodId });
    }
  }

  return payments.filter(row => row.amount > 0);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  const { id } = await params;
  const expenseId = Number(id);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const action = String(raw._action || 'update');
  const returnTo = new URL(request.url).searchParams.get('returnTo');
  if (action === 'delete') {
    const deleted = await prisma.expense.deleteMany({ where: { id: expenseId, workspaceId: current.workspace.id } });
    if (deleted.count) await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'DELETE',
      entityType: 'Expense', entityId: expenseId, request
    });
    const target = safePath(returnTo, '/expenses', request.url);
    return redirectToPath(appendFlash(target, { saved: 'deleted' }));
  }
  const data = ExpenseSchema.parse(raw);
  const existing = await prisma.expense.findFirst({ where: { id: expenseId, workspaceId: current.workspace.id }, include: { attachments: true } });
  if (!existing) {
    const target = safePath(returnTo, '/expenses', request.url);
    return redirectToPath(appendFlash(target, { error: 'not_found' }));
  }
  const isVatSettlement = existing.expenseType === 'VAT_SETTLEMENT';
  const invoiceFields = isVatSettlement
    ? { isDeclared: false, hasElectronicInvoice: false, invoiceStatus: 'NON_PREVISTA' as const }
    : normalizeInvoiceFields(data);
  const { year, month } = resolveBillingPeriod(data.billingPeriod);
  const payments = await resolvePaymentInputs(parsePayments(formData), current.workspace.id, isVatSettlement);
  let supplierRef;
  let configuredCategoryId: number | null = null;
  try {
    if (isVatSettlement) {
      const [workspace, systemSupplier] = await Promise.all([
        prisma.workspace.findUnique({ where: { id: current.workspace.id }, select: { vatSettlementCategoryId: true } }),
        prisma.supplier.findFirst({ where: { workspaceId: current.workspace.id, systemRole: 'VAT_SETTLEMENT' } })
      ]);
      if (!workspace?.vatSettlementCategoryId || !systemSupplier) throw new Error('Configurazione Saldo IVA incompleta');
      configuredCategoryId = await resolveCategoryId(workspace.vatSettlementCategoryId, current.workspace.id);
      supplierRef = { id: systemSupplier.id, businessName: systemSupplier.businessName };
    } else supplierRef = await resolveExistingSupplierReference(data, current.workspace.id);
  } catch (error) {
    if (error instanceof SupplierReferenceError) {
      const target = safePath(returnTo, `/expenses/${expenseId}`, request.url);
      return redirectToPath(appendFlash(target, { error: error.code }));
    }
    throw error;
  }
  const categoryId = isVatSettlement ? configuredCategoryId : await resolveCategoryId(data.categoryId, current.workspace.id);
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const firstPayment = payments[0];

  const nextIsRecurring = isVatSettlement ? false : (existing.isRecurring ? data.isRecurring : false);

  let attachments;
  try {
    attachments = await saveExpenseAttachmentFiles(formData.getAll('attachments'), existing.attachments.length);
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return redirectToPath(appendFlash(returnTo || `/expenses/${expenseId}`, { error: 'invalid_attachment' }));
    }
    throw error;
  }

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      receivedDate: data.receivedDate ? new Date(data.receivedDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      merchant: supplierRef.businessName,
      supplierId: supplierRef.id,
      categoryId,
      description: data.description || null,
      amount: data.amount,
      paymentDate: data.paymentStatus === 'DA_PAGARE' ? null : (firstPayment?.paymentDate ? new Date(firstPayment.paymentDate) : null),
      vatRate: isVatSettlement || !invoiceFields.isDeclared ? 0 : data.vatRate,
      isDeclared: invoiceFields.isDeclared,
      isRecurring: nextIsRecurring,
      hasElectronicInvoice: invoiceFields.hasElectronicInvoice,
      invoiceStatus: invoiceFields.invoiceStatus,
      isComplete: data.paymentStatus === 'COMPLETATO',
      paymentStatus: data.paymentStatus,
      paidAmount,
      invoiceDocumentPath: existing.invoiceDocumentPath ?? attachments[0]?.path ?? null,
      notes: data.notes || null,
      month,
      year,
      payments: {
        deleteMany: {},
        create: payments.map(payment => ({
          paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : null,
          paymentMethodId: payment.paymentMethodId!,
          bankId: payment.bankId || null,
          amount: payment.amount
        }))
      },
      attachments: attachments.length ? { create: attachments } : undefined
    }
  });
  await writeAuditLog({
    workspaceId: current.workspace.id,
    userId: current.user.id,
    action: 'UPDATE',
    entityType: 'Expense',
    entityId: expenseId,
    metadata: { amount: data.amount, expenseType: data.expenseType, paymentStatus: data.paymentStatus },
    request
  });

  const target = safePath(returnTo, `/expenses/${expenseId}`, request.url);
  return redirectToPath(appendFlash(target, { saved: 'updated' }));
}
