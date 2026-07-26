import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceApiAccess, getWorkspaceContext, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { ensureWorkspaceDefaults } from '@/lib/workspace-defaults';
import { writeAuditLog } from '@/lib/audit';

const BooleanFromForm = z.preprocess((value) => value === true || value === 'true' || value === 'on' || value === '1', z.boolean());

const IncomeSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  salesChannelId: z.coerce.number().int().positive(),
  orderDate: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().nonnegative(),
  paymentMethodId: z.coerce.number().int().positive(),
  creditBankId: z.coerce.number().int().positive(),
  creditDate: z.string().min(1),
  isCredited: BooleanFromForm.default(true),
  billingPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  isFiscal: BooleanFromForm.default(true),
  invoiceStatus: z.string().optional().nullable(),
  vatRate: z.coerce.number().default(22),
  notes: z.string().optional().nullable()
});


function safePath(value: string | null, fallback: string, requestUrl: string) {
  const path = pathFromUrl(value, fallback);
  const url = new URL(path, 'http://tabularium.local');
  if (url.pathname === '/incomes') url.searchParams.delete('new');
  return `${url.pathname}${url.search}`;
}

function redirectAfterFormSave(request: Request, fallback: string) {
  const requestUrl = request.url;
  const explicitReturnTo = new URL(requestUrl).searchParams.get('returnTo');
  const referer = request.headers.get('referer');
  const target = safePath(explicitReturnTo, safePath(referer, fallback, requestUrl), requestUrl);
  return target;
}

export async function GET() {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const incomes = await prisma.income.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { creditDate: 'desc' }, take: 500 });
  return NextResponse.json(incomes);
}

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  await ensureWorkspaceDefaults(current.workspace.id);
  const isForm = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') || request.headers.get('content-type')?.includes('multipart/form-data');
  const raw = isForm ? Object.fromEntries((await request.formData()).entries()) : await request.json();
  const parsed = IncomeSchema.parse(raw);
  const [paymentMethod, creditBank, salesChannel, incomeCategory, customer] = await Promise.all([
    prisma.paymentMethod.findFirst({ where: { id: parsed.paymentMethodId, workspaceId: current.workspace.id } }),
    prisma.bank.findFirst({ where: { id: parsed.creditBankId, workspaceId: current.workspace.id } }),
    prisma.incomeSalesChannel.findFirst({ where: { id: parsed.salesChannelId, workspaceId: current.workspace.id } }),
    prisma.incomeCategory.findFirst({ where: { workspaceId: current.workspace.id, code: 'B2C' } })
      .then(category => category ?? prisma.incomeCategory.findFirst({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } })),
    prisma.customer.findFirst({ where: { id: parsed.customerId, workspaceId: current.workspace.id } })
  ]);
  if (!paymentMethod || !creditBank || !salesChannel || !incomeCategory || !customer) return NextResponse.json({ error: 'Configurazione incasso non valida' }, { status: 400 });
  const [billingYear, billingMonth] = parsed.billingPeriod.split('-').map(Number);
  const income = await prisma.income.create({
    data: {
      workspaceId: current.workspace.id,
      customerId: customer.id,
      salesChannelId: salesChannel.id,
      incomeCategoryId: incomeCategory.id,
      description: parsed.description || null,
      amount: parsed.amount,
      paymentMethodId: paymentMethod.id,
      creditBankId: creditBank.id,
      orderDate: new Date(parsed.orderDate),
      creditDate: new Date(parsed.creditDate),
      isCredited: parsed.isCredited,
      billingYear,
      billingMonth,
      isFiscal: parsed.isFiscal,
      invoiceStatus: parsed.isFiscal ? (parsed.invoiceStatus || 'NON_INVIATA') : null,
      vatRate: parsed.isFiscal ? parsed.vatRate : 0,
      notes: parsed.notes || null
    }
  });
  await writeAuditLog({
    workspaceId: current.workspace.id,
    userId: current.user.id,
    action: 'CREATE',
    entityType: 'Income',
    entityId: income.id,
    metadata: { amount: parsed.amount, isFiscal: parsed.isFiscal },
    request
  });
  return isForm
    ? redirectToPath(appendFlash(redirectAfterFormSave(request, '/incomes'), { saved: 'created' }))
    : NextResponse.json(income);
}
