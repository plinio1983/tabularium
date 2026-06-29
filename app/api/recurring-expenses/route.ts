import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { SupplierReferenceError, resolveExistingSupplierReference } from '@/lib/supplier-reference';

const BooleanFromForm = z.preprocess((value) => value === true || value === 'true' || value === 'on' || value === '1', z.boolean());

const RecurringExpenseSchema = z.object({
  startDate: z.string().min(1),
  cadence: z.enum(['MONTHLY', 'EVERY_2_MONTHS', 'EVERY_3_MONTHS', 'EVERY_6_MONTHS', 'YEARLY', 'EVERY_2_YEARS']),
  dueDay: z.coerce.number().min(1).max(31).optional().nullable(),
  dueMonth: z.coerce.number().min(1).max(12).optional().nullable(),
  accrualType: z.enum(['MANUALE', 'AUTOMATICO']).default('MANUALE'),
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
  paymentChannel: z.string().optional(),
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

async function resolvePaymentMethod(paymentMethodId: number | null | undefined, paymentChannel: string | undefined, workspaceId: number) {
  if (!paymentMethodId && !paymentChannel) return null;
  const method = paymentMethodId
    ? await prisma.paymentMethod.findFirst({ where: { id: paymentMethodId, workspaceId } })
    : await prisma.paymentMethod.findFirst({ where: { workspaceId, name: { equals: paymentChannel, mode: 'insensitive' } } });
  if (paymentMethodId && !method) throw new Error('Metodo pagamento non valido');
  return method;
}

export async function POST(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const data = RecurringExpenseSchema.parse(raw);
  let supplierRef;
  try {
    supplierRef = await resolveExistingSupplierReference(data, current.workspace.id);
  } catch (error) {
    if (error instanceof SupplierReferenceError) {
      return redirectToPath(appendFlash(redirectTarget(request, '/recurring-expenses'), { error: error.code }));
    }
    throw error;
  }
  const categoryId = await resolveCategoryId(data.categoryId, current.workspace.id);
  const paymentMethod = await resolvePaymentMethod(data.paymentMethodId, data.paymentChannel, current.workspace.id);
  const isYearly = data.cadence === 'YEARLY' || data.cadence === 'EVERY_2_YEARS';
  await prisma.recurringExpense.create({
    data: {
      workspaceId: current.workspace.id,
      startDate: new Date(data.startDate),
      cadence: data.cadence,
      dueDay: data.dueDay || null,
      dueMonth: isYearly ? (data.dueMonth || null) : null,
      accrualType: data.accrualType,
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
      paymentChannel: paymentMethod?.name ?? data.paymentChannel ?? null,
      paymentMethodId: paymentMethod?.id ?? null,
      bankId: data.bankId || null,
      notes: data.notes || null
    }
  });

  return redirectToPath(appendFlash(redirectTarget(request, '/recurring-expenses'), { saved: 'created' }));
}
