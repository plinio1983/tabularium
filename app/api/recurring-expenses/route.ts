import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { SupplierReferenceError, resolveExistingSupplierReference } from '@/lib/supplier-reference';
import { writeAuditLog } from '@/lib/audit';

const BooleanFromForm = z.preprocess((value) => value === true || value === 'true' || value === 'on' || value === '1', z.boolean());

const RecurringExpenseSchema = z.object({
  startDate: z.string().min(1),
  cadence: z.enum(['MONTHLY', 'EVERY_2_MONTHS', 'EVERY_3_MONTHS', 'EVERY_6_MONTHS', 'YEARLY', 'EVERY_2_YEARS']),
  dueDay: z.coerce.number().min(1).max(31).optional().nullable(),
  dueMonth: z.coerce.number().min(1).max(12).optional().nullable(),
  isAutomaticPayment: BooleanFromForm.default(false),
  billingPeriodMode: z.enum(['SAME_MONTH', 'NEXT_MONTH', 'CUSTOM_MONTH']).default('SAME_MONTH'),
  billingMonth: z.coerce.number().min(1).max(12).optional().nullable(),
  merchant: z.string().optional().default(''),
  supplierId: z.coerce.number().optional().nullable(),
  categoryId: z.coerce.number().optional().nullable(),
  description: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  vatRate: z.coerce.number().default(22),
  isDeclared: BooleanFromForm.default(false),
  hasElectronicInvoice: BooleanFromForm.default(false),
  paymentMethodId: z.coerce.number().optional().nullable(),
  bankId: z.coerce.number().optional().nullable(),
  notes: z.string().optional()
});

function safePath(value: string | null, fallback: string, requestUrl: string) {
  return pathFromUrl(value, fallback);
}

function redirectTarget(request: Request, fallback: string) {
  const requestUrl = request.url;
  const explicitReturnTo = new URL(requestUrl).searchParams.get('returnTo');
  return safePath(explicitReturnTo, fallback, requestUrl);
}

async function resolveCategoryId(categoryId: number | null | undefined, workspaceId: number) {
  if (!categoryId) return null;
  const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, workspaceId } });
  if (!category) throw new Error('Categoria non valida');
  return category.id;
}

async function resolvePaymentMethod(paymentMethodId: number | null | undefined, workspaceId: number) {
  if (!paymentMethodId) return null;
  const method = await prisma.paymentMethod.findFirst({ where: { id: paymentMethodId, workspaceId } });
  if (!method) throw new Error('Metodo pagamento non valido');
  return method;
}

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  const wantsJson = request.headers.get('accept')?.includes('application/json') || request.headers.get('x-requested-with') === 'fetch';
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const data = RecurringExpenseSchema.parse(raw);
  let supplierRef;
  try {
    supplierRef = await resolveExistingSupplierReference(data, current.workspace.id);
  } catch (error) {
    if (error instanceof SupplierReferenceError) {
      return wantsJson
        ? NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
        : redirectToPath(appendFlash(redirectTarget(request, '/recurring-expenses'), { error: error.code }));
    }
    throw error;
  }
  const categoryId = await resolveCategoryId(data.categoryId, current.workspace.id);
  const paymentMethod = await resolvePaymentMethod(data.paymentMethodId, current.workspace.id);
  const isYearly = data.cadence === 'YEARLY' || data.cadence === 'EVERY_2_YEARS';
  const recurringExpense = await prisma.recurringExpense.create({
    data: {
    workspaceId: current.workspace.id,
    companyId: current.company.id,
      startDate: new Date(data.startDate),
      cadence: data.cadence,
      dueDay: data.dueDay || null,
      dueMonth: isYearly ? (data.dueMonth || null) : null,
      isAutomaticPayment: data.isAutomaticPayment,
      billingPeriodMode: data.billingPeriodMode,
      billingMonth: data.billingPeriodMode === 'CUSTOM_MONTH' ? (data.billingMonth || null) : null,
      merchant: supplierRef.businessName,
      supplierId: supplierRef.id,
      categoryId,
      description: data.description,
      amount: data.amount,
      vatRate: data.vatRate,
      isDeclared: data.isDeclared,
      hasElectronicInvoice: data.isDeclared ? data.hasElectronicInvoice : false,
      paymentMethodId: data.isAutomaticPayment ? (paymentMethod?.id ?? null) : null,
      bankId: data.isAutomaticPayment ? (data.bankId || null) : null,
      notes: data.notes || null
    }
  });
  await writeAuditLog({
    workspaceId: current.workspace.id, userId: current.user.id, action: 'CREATE',
    entityType: 'RecurringExpense', entityId: recurringExpense.id,
    metadata: { amount: data.amount, cadence: data.cadence }, request
  });

  return wantsJson
    ? NextResponse.json({ ok: true })
    : redirectToPath(appendFlash(redirectTarget(request, '/recurring-expenses'), { saved: 'created' }));
}
