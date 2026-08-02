import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceApiAccess, getWorkspaceContext, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { SupplierReferenceError, resolveExistingSupplierReference } from '@/lib/supplier-reference';
import { AttachmentValidationError, saveExpenseAttachmentFiles } from '@/lib/attachments';
import { writeAuditLog } from '@/lib/audit';
import {yearMonthInTimeZone} from '@/lib/company-time';

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
  invoiceStatus: z.enum(['NON_PREVISTA', 'IN_ATTESA', 'INVIATA_SDI', 'CONTESTAZIONE', 'PARZIALE', 'RICEVUTA']).default('IN_ATTESA'),
  billingPeriod: z.string().optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2000).optional(),
  paymentStatus: z.enum(['DA_PAGARE', 'COMPLETATO', 'PAGATO_PARZIALMENTE']).default('DA_PAGARE'),
  notes: z.string().optional()
});


function normalizeInvoiceFields(data: z.infer<typeof ExpenseSchema>) {
  if (!data.isDeclared) {
    return { isDeclared: false, hasElectronicInvoice: false, invoiceStatus: 'NON_PREVISTA' as const };
  }
  return {
    isDeclared: data.isDeclared,
    isAutomaticPayment: false,
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

function resolveBillingPeriod(data: z.infer<typeof ExpenseSchema>, timeZone: string) {
  if (data.billingPeriod) {
    const [periodYear, month] = data.billingPeriod.split('-').map(Number);
    const year = data.year ?? periodYear;
    if (year && month) return { year, month };
  }
  const now = yearMonthInTimeZone(timeZone);
  return {
    year: data.year ?? now.year,
    month: data.month ?? now.month
  };
}

function getAll(formData: FormData, key: string) {
  return formData.getAll(key).map(value => String(value || '').trim());
}

function parsePayments(formData: FormData | null, jsonPayments: unknown): PaymentInput[] {
  if (!formData) {
    if (!Array.isArray(jsonPayments)) return [];
    return jsonPayments
      .map((row: any) => ({
        paymentDate: row.paymentDate ? String(row.paymentDate) : undefined,
        paymentMethodId: row.paymentMethodId ? Number(row.paymentMethodId) : null,
        bankId: row.bankId ? Number(row.bankId) : null,
        amount: Number(row.amount || 0)
      }))
      .filter(row => row.amount > 0 || row.paymentDate || row.paymentMethodId || row.bankId);
  }

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


function safePath(value: string | null, fallback: string, requestUrl: string) {
  return pathFromUrl(value, fallback);
}


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
    const method = payment.paymentMethodId ? methods.find(item => item.id === payment.paymentMethodId) : null;
    if (!method) throw new Error('Metodo pagamento non valido');
    if (forbidCash && method && (method.systemRole === 'CASH' || method.name.trim().toLowerCase() === 'cash')) throw new Error('Cash non è disponibile per i saldi IVA');
    return { ...payment, paymentMethodId: method.id };
  });
}

function redirectAfterFormSaveTarget(request: Request, fallback: string) {
  const requestUrl = request.url;
  const explicitReturnTo = new URL(requestUrl).searchParams.get('returnTo');
  const referer = request.headers.get('referer');
  const target = safePath(explicitReturnTo, safePath(referer, fallback, requestUrl), requestUrl);
  return target;
}

export async function GET() {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const expenses = await prisma.expense.findMany({
    where: { workspaceId: current.workspace.id, companyId: current.company.id },
    include: { category: true, company: true, supplier: true, payments: { include: { bank: true, paymentMethod: true } }, attachments: true },
    orderBy: { id: 'desc' },
    take: 500
  });
  return NextResponse.json(expenses);
}

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  const isForm = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') || request.headers.get('content-type')?.includes('multipart/form-data');
  const wantsJson = request.headers.get('accept')?.includes('application/json') || request.headers.get('x-requested-with') === 'fetch';
  const formData = isForm ? await request.formData() : null;
  const raw = formData ? Object.fromEntries(formData.entries()) : await request.json();
  const data = ExpenseSchema.parse(raw);
  const isVatSettlement = data.expenseType === 'VAT_SETTLEMENT';
  const invoiceFields = isVatSettlement
    ? { isDeclared: false, hasElectronicInvoice: false, invoiceStatus: 'NON_PREVISTA' as const }
    : normalizeInvoiceFields(data);
  const { year, month } = resolveBillingPeriod(data, current.company.timeZone);
  const payments = await resolvePaymentInputs(parsePayments(formData, (raw as any).payments), current.workspace.id, isVatSettlement);
  let supplierRef;
  let configuredCategoryId: number | null = null;
  try {
    if (isVatSettlement) {
      const [workspace, systemSupplier] = await Promise.all([
        prisma.workspace.findUnique({ where: { id: current.workspace.id }, select: { vatSettlementCategoryId: true } }),
        prisma.supplier.findFirst({ where: { workspaceId: current.workspace.id, systemRole: 'VAT_SETTLEMENT' } })
      ]);
      if (!workspace?.vatSettlementCategoryId || !systemSupplier) throw new Error('Configura categoria e fornitore di sistema per il Saldo IVA');
      configuredCategoryId = await resolveCategoryId(workspace.vatSettlementCategoryId, current.workspace.id);
      supplierRef = { id: systemSupplier.id, businessName: systemSupplier.businessName };
    } else supplierRef = await resolveExistingSupplierReference(data, current.workspace.id);
  } catch (error) {
    if (error instanceof SupplierReferenceError) {
      return isForm && !wantsJson
        ? redirectToPath(appendFlash(redirectAfterFormSaveTarget(request, '/expenses'), { error: error.code }))
        : NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
  const categoryId = isVatSettlement ? configuredCategoryId : await resolveCategoryId(data.categoryId, current.workspace.id);
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  let attachments;
  try {
    attachments = formData ? await saveExpenseAttachmentFiles(formData.getAll('attachments'), 0, formData.getAll('attachmentTypes')) : [];
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return isForm && !wantsJson
        ? redirectToPath(appendFlash(redirectAfterFormSaveTarget(request, '/expenses'), { error: 'invalid_attachment' }))
        : NextResponse.json({ error: error.message, code: 'invalid_attachment' }, { status: 400 });
    }
    throw error;
  }
  const firstPayment = payments[0];

  const expense = await prisma.expense.create({ data: {
    workspaceId: current.workspace.id,
    companyId: current.company.id,
    receivedDate: data.receivedDate ? new Date(data.receivedDate) : null,
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    merchant: supplierRef.businessName,
    supplierId: supplierRef.id,
    categoryId,
    description: data.description || null,
    amount: data.amount,
    expenseType: data.expenseType,
    paymentDate: data.paymentStatus === 'DA_PAGARE' ? null : (firstPayment?.paymentDate ? new Date(firstPayment.paymentDate) : null),
    vatRate: isVatSettlement || !invoiceFields.isDeclared ? 0 : data.vatRate,
    isDeclared: invoiceFields.isDeclared,
    isRecurring: false,
    hasElectronicInvoice: invoiceFields.hasElectronicInvoice,
    invoiceStatus: invoiceFields.invoiceStatus,
    isComplete: data.paymentStatus === 'COMPLETATO',
    paymentStatus: data.paymentStatus,
    paidAmount,
    invoiceDocumentPath: attachments[0]?.path ?? null,
    notes: data.notes || null,
    month,
    year,
    payments: {
      create: payments.map(payment => ({
        paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : null,
        paymentMethodId: payment.paymentMethodId!,
        bankId: payment.bankId || null,
        amount: payment.amount
      }))
    },
    attachments: {
      create: attachments
    }
  }});
  await writeAuditLog({
    workspaceId: current.workspace.id,
    userId: current.user.id,
    action: 'CREATE',
    entityType: 'Expense',
    entityId: expense.id,
    metadata: { amount: data.amount, expenseType: data.expenseType, paymentStatus: data.paymentStatus },
    request
  });

  return isForm && !wantsJson
    ? redirectToPath(appendFlash(redirectAfterFormSaveTarget(request, '/expenses'), { saved: 'created' }))
    : NextResponse.json({ ok: true });
}
