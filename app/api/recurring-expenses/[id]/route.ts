import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { SupplierReferenceError, resolveExistingSupplierReference } from '@/lib/supplier-reference';
import { writeAuditLog } from '@/lib/audit';
import {dateInputInTimeZone} from '@/lib/company-time';

const BooleanFromForm = z.preprocess((value) => value === true || value === 'true' || value === 'on' || value === '1', z.boolean());

const RecurringExpenseSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().optional().transform(value => value || null),
  cadence: z.enum(['MONTHLY', 'EVERY_2_MONTHS', 'EVERY_3_MONTHS', 'EVERY_6_MONTHS', 'YEARLY', 'EVERY_2_YEARS']),
  dueDay: z.coerce.number().min(1).max(31).optional().nullable(),
  dueMonth: z.coerce.number().min(1).max(12).optional().nullable(),
  generationTiming: z.enum(['FIRST_OF_MONTH', 'DAYS_7_BEFORE', 'DAYS_10_BEFORE', 'DAYS_15_BEFORE', 'DAYS_30_BEFORE', 'ON_DUE_DATE']).default('FIRST_OF_MONTH'),
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
}).superRefine((data, context) => {
  if (data.endDate && data.endDate < data.startDate) context.addIssue({code: 'custom', path: ['endDate'], message: 'La data di fine non può precedere la data iniziale'});
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  const { id } = await params;
  const recurringExpenseId = Number(id);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const action = String(raw._action || 'update');

  if (!Number.isInteger(recurringExpenseId) || recurringExpenseId <= 0) {
    return NextResponse.json({ error: 'ID spesa ricorrente non valido' }, { status: 400 });
  }

  if (action === 'delete') {
    const deleted = await prisma.recurringExpense.deleteMany({ where: { id: recurringExpenseId, workspaceId: current.workspace.id, companyId: current.company.id } });
    if (deleted.count) await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'DELETE',
      entityType: 'RecurringExpense', entityId: recurringExpenseId, request
    });
    return redirectToPath(appendFlash(redirectTarget(request, '/recurring-expenses'), { saved: 'deleted' }));
  }

  const existing = await prisma.recurringExpense.findFirst({ where: { id: recurringExpenseId, workspaceId: current.workspace.id, companyId: current.company.id } });
  if (!existing) return redirectToPath(appendFlash(redirectTarget(request, '/recurring-expenses'), { error: 'not_found' }));

  const data = RecurringExpenseSchema.parse(raw);
  let supplierRef;
  try {
    supplierRef = await resolveExistingSupplierReference(data, current.workspace.id);
  } catch (error) {
    if (error instanceof SupplierReferenceError) {
      return redirectToPath(appendFlash(redirectTarget(request, `/recurring-expenses/${recurringExpenseId}`), { error: error.code }));
    }
    throw error;
  }
  const categoryId = await resolveCategoryId(data.categoryId, current.workspace.id);
  const paymentMethod = await resolvePaymentMethod(data.paymentMethodId, current.workspace.id);
  const isYearly = data.cadence === 'YEARLY' || data.cadence === 'EVERY_2_YEARS';

  await prisma.recurringExpense.update({
    where: { id: recurringExpenseId },
    data: {
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      archivedAt: data.endDate && data.endDate < dateInputInTimeZone(current.company.timeZone) ? existing.archivedAt : null,
      cadence: data.cadence,
      dueDay: data.dueDay || null,
      dueMonth: isYearly ? (data.dueMonth || null) : null,
      generationTiming: data.generationTiming,
      isAutomaticPayment: data.isAutomaticPayment,
      billingPeriodMode: data.isDeclared ? data.billingPeriodMode : 'SAME_MONTH',
      billingMonth: data.isDeclared && data.billingPeriodMode === 'CUSTOM_MONTH' ? (data.billingMonth || null) : null,
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
    workspaceId: current.workspace.id, userId: current.user.id, action: 'UPDATE',
    entityType: 'RecurringExpense', entityId: recurringExpenseId,
    metadata: { amount: data.amount, cadence: data.cadence }, request
  });

  return redirectToPath(appendFlash(redirectTarget(request, `/recurring-expenses/${recurringExpenseId}`), { saved: 'updated' }));
}
