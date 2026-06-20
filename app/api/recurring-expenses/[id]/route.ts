import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth';

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
  bankId: z.coerce.number().optional().nullable(),
  notes: z.string().optional()
});

function safePath(value: string | null, fallback: string, requestUrl: string) {
  if (!value) return fallback;
  try {
    const url = value.startsWith('http') ? new URL(value) : new URL(value, requestUrl);
    if (url.origin !== new URL(requestUrl).origin) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith('/') ? value : fallback;
  }
}

async function resolveSupplierReference(data: z.infer<typeof RecurringExpenseSchema>, workspaceId: number) {
  const submittedName = String(data.merchant ?? '').trim();
  if (data.supplierId) {
    const existing = await prisma.supplier.findFirst({ where: { id: data.supplierId, workspaceId } });
    if (existing) return { id: existing.id, businessName: existing.businessName };
  }
  if (!submittedName) throw new Error('Esercente obbligatorio');
  const existingByName = await prisma.supplier.findFirst({ where: { businessName: { equals: submittedName, mode: 'insensitive' }, workspaceId } });
  if (existingByName) return { id: existingByName.id, businessName: existingByName.businessName };
  const created = await prisma.supplier.create({ data: { businessName: submittedName, workspaceId } });
  return { id: created.id, businessName: created.businessName };
}

async function resolveCategoryId(categoryId: number | null | undefined, workspaceId: number) {
  if (!categoryId) return null;
  const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, workspaceId } });
  if (!category) throw new Error('Categoria non valida');
  return category.id;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const { id } = await params;
  const recurringExpenseId = Number(id);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const action = String(raw._action || 'update');
  const returnTo = new URL(request.url).searchParams.get('returnTo');

  if (!Number.isInteger(recurringExpenseId) || recurringExpenseId <= 0) {
    return NextResponse.json({ error: 'ID spesa ricorrente non valido' }, { status: 400 });
  }

  if (action === 'delete') {
    await prisma.recurringExpense.deleteMany({ where: { id: recurringExpenseId, workspaceId: current.workspace.id } });
    return NextResponse.redirect(new URL(safePath(returnTo, '/recurring-expenses', request.url), request.url), 303);
  }

  const existing = await prisma.recurringExpense.findFirst({ where: { id: recurringExpenseId, workspaceId: current.workspace.id } });
  if (!existing) return NextResponse.json({ error: 'Spesa ricorrente non trovata' }, { status: 404 });

  const data = RecurringExpenseSchema.parse(raw);
  const supplierRef = await resolveSupplierReference(data, current.workspace.id);
  const categoryId = await resolveCategoryId(data.categoryId, current.workspace.id);
  const isYearly = data.cadence === 'YEARLY' || data.cadence === 'EVERY_2_YEARS';

  await prisma.recurringExpense.update({
    where: { id: recurringExpenseId },
    data: {
      startDate: new Date(data.startDate),
      cadence: data.cadence,
      dueDay: data.dueDay || null,
      dueMonth: isYearly ? (data.dueMonth || null) : null,
      accrualType: data.accrualType,
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
      paymentChannel: data.accrualType === 'AUTOMATICO' ? (data.paymentChannel || null) : null,
      bankId: data.accrualType === 'AUTOMATICO' ? (data.bankId || null) : null,
      notes: data.notes || null
    }
  });

  return NextResponse.redirect(new URL(safePath(returnTo, `/recurring-expenses/${recurringExpenseId}`, request.url), request.url), 303);
}
