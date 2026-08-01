import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { redirectToPath } from '@/lib/redirect';

const bool = z.preprocess(value => ['true', 'on', '1', true].includes(value as never), z.boolean());
const recurringIncomeSchema = z.object({
  startDate: z.string().min(1), cadence: z.enum(['MONTHLY', 'EVERY_2_MONTHS', 'EVERY_3_MONTHS', 'EVERY_6_MONTHS', 'YEARLY', 'EVERY_2_YEARS']),
  creditDay: z.coerce.number().min(1).max(31).optional().nullable(), creditMonth: z.coerce.number().min(1).max(12).optional().nullable(),
  billingPeriodMode: z.enum(['SAME_MONTH', 'NEXT_MONTH', 'CUSTOM_MONTH']).default('SAME_MONTH'), billingMonth: z.coerce.number().min(1).max(12).optional().nullable(),
  customerId: z.coerce.number().optional().nullable(), salesChannelId: z.coerce.number(),
  description: z.string().min(1), amount: z.coerce.number().positive(), vatRate: z.coerce.number().min(0).default(22),
  isFiscal: bool.default(false), isAutomaticCredit: bool.default(false), paymentMethodId: z.coerce.number().optional().nullable(), bankId: z.coerce.number().optional().nullable(), notes: z.string().optional()
});

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const form = await request.formData();
  const data = recurringIncomeSchema.parse(Object.fromEntries(form.entries()));
  const workspaceId = access.current.workspace.id;
  const companyId = access.current.company.id;
  const [channel, category, customer, method, bank] = await Promise.all([
    prisma.incomeSalesChannel.findFirst({ where: { id: data.salesChannelId, workspaceId } }),
    prisma.incomeCategory.findFirst({ where: { workspaceId, code: 'B2C' } }).then(value => value ?? prisma.incomeCategory.findFirst({ where: { workspaceId }, orderBy: { id: 'asc' } })),
    data.customerId ? prisma.customer.findFirst({ where: { id: data.customerId, workspaceId } }) : null,
    data.paymentMethodId ? prisma.paymentMethod.findFirst({ where: { id: data.paymentMethodId, workspaceId } }) : null,
    data.bankId ? prisma.bank.findFirst({ where: { id: data.bankId, workspaceId } }) : null
  ]);
  if (!channel || !category || (data.customerId && !customer)) return NextResponse.json({ error: 'Riferimenti non validi' }, { status: 400 });
  if (data.isAutomaticCredit && (!method || !bank)) return NextResponse.json({ error: 'Per l’accredito automatico metodo e banca sono obbligatori' }, { status: 400 });
  await prisma.recurringIncome.create({ data: {
    workspaceId, companyId, startDate: new Date(data.startDate), cadence: data.cadence, creditDay: data.creditDay || null,
    creditMonth: ['YEARLY', 'EVERY_2_YEARS'].includes(data.cadence) ? data.creditMonth || null : null,
    billingPeriodMode: data.billingPeriodMode, billingMonth: data.billingPeriodMode === 'CUSTOM_MONTH' ? data.billingMonth || null : null,
    customerId: data.customerId || null, salesChannelId: data.salesChannelId, incomeCategoryId: category.id,
    description: data.description, amount: data.amount, vatRate: data.vatRate, isFiscal: data.isFiscal,
    isAutomaticCredit: data.isAutomaticCredit, paymentMethodId: data.isAutomaticCredit ? data.paymentMethodId : null,
    bankId: data.isAutomaticCredit ? data.bankId : null, notes: data.notes || null
  } });
  const returnTo = new URL(request.url).searchParams.get('returnTo') || '/recurring-incomes';
  return redirectToPath(appendFlash(returnTo.startsWith('/') ? returnTo : '/recurring-incomes', { saved: 'created' }));
}
