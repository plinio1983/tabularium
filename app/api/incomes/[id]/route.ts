import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
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
  invoiceStatus: z.enum(['NON_INVIATA', 'PARZIALE', 'EMESSA']).optional().nullable(),
  vatRate: z.coerce.number().default(22),
  notes: z.string().optional().nullable()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  await ensureWorkspaceDefaults(current.workspace.id);
  const { id } = await params;
  const incomeId = Number(id);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const action = String(raw._action || 'update');
  const rawReturnTo = new URL(request.url).searchParams.get('returnTo');
  const returnTo = pathFromUrl(rawReturnTo, `/incomes/${incomeId}`);

  if (action === 'delete') {
    const deleted = await prisma.income.deleteMany({ where: { id: incomeId, workspaceId: current.workspace.id, companyId: current.company.id } });
    if (deleted.count) await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'DELETE',
      entityType: 'Income', entityId: incomeId, request
    });
    return redirectToPath(appendFlash(pathFromUrl(rawReturnTo, '/incomes'), { saved: 'deleted' }));
  }

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
  const existing = await prisma.income.findFirst({ where: { id: incomeId, workspaceId: current.workspace.id, companyId: current.company.id }, select: { id: true } });
  if (!existing) {
    return redirectToPath(appendFlash(returnTo || '/incomes', { error: 'not_found' }));
  }
  const [billingYear, billingMonth] = parsed.billingPeriod.split('-').map(Number);
  await prisma.income.update({
    where: { id: incomeId },
    data: {
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
    action: 'UPDATE',
    entityType: 'Income',
    entityId: incomeId,
    metadata: { amount: parsed.amount, isFiscal: parsed.isFiscal },
    request
  });

  return redirectToPath(appendFlash(returnTo || `/incomes/${incomeId}`, { saved: 'updated' }));
}
