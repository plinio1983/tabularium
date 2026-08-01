import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { ensureWorkspaceDefaults } from '@/lib/workspace-defaults';
import { writeAuditLog } from '@/lib/audit';
import { parseIncomeCredits, validateIncomeCredits } from '@/lib/income-credits';
import {resolveDefaultIncomeCategory} from '@/lib/income-category';

const BooleanFromForm = z.preprocess((value) => value === true || value === 'true' || value === 'on' || value === '1', z.boolean());

const IncomeSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  salesChannelId: z.coerce.number().int().positive(),
  orderDate: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().nonnegative(),
  paymentMethodId: z.coerce.number().int().positive().optional(),
  creditBankId: z.coerce.number().int().positive().optional(),
  creditDate: z.string().optional(),
  isCredited: BooleanFromForm.default(false),
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
  let credits = parseIncomeCredits(formData, null);
  if (!credits.length && parsed.isCredited && parsed.paymentMethodId && parsed.creditBankId && parsed.creditDate) {
    credits = [{creditDate: parsed.creditDate, paymentMethodId: parsed.paymentMethodId, bankId: parsed.creditBankId, amount: parsed.amount}];
  }
  let creditState;
  try {
    creditState = validateIncomeCredits(credits, parsed.amount);
  } catch (error) {
    return redirectToPath(appendFlash(returnTo || `/incomes/${incomeId}`, { error: 'invalid' }));
  }
  const [methods, banks, salesChannel, incomeCategory, customer] = await Promise.all([
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.incomeSalesChannel.findFirst({ where: { id: parsed.salesChannelId, workspaceId: current.workspace.id } }),
    resolveDefaultIncomeCategory(current.workspace.id),
    prisma.customer.findFirst({ where: { id: parsed.customerId, workspaceId: current.workspace.id } })
  ]);
  const fallbackMethod = methods.find(method => method.isIncomeDefault) ?? methods[0];
  const fallbackBank = banks.find(bank => bank.id === current.company.primaryBankId) ?? banks[0];
  const invalidCredit = credits.some(credit => !methods.some(method => method.id === credit.paymentMethodId) || !banks.some(bank => bank.id === credit.bankId));
  if (!fallbackMethod || !fallbackBank || invalidCredit || !salesChannel || !incomeCategory || !customer) return NextResponse.json({ error: 'Configurazione incasso non valida' }, { status: 400 });
  const existing = await prisma.income.findFirst({ where: { id: incomeId, workspaceId: current.workspace.id, companyId: current.company.id }, select: { id: true, creditDate: true, expectedCreditDate: true } });
  if (!existing) {
    return redirectToPath(appendFlash(returnTo || '/incomes', { error: 'not_found' }));
  }
  const firstCredit = credits[0];
  const latestCredit = [...credits].sort((a, b) => b.creditDate.localeCompare(a.creditDate))[0];
  const legacyMethod = methods.find(method => method.id === (firstCredit?.paymentMethodId ?? parsed.paymentMethodId)) ?? fallbackMethod;
  const legacyBank = banks.find(bank => bank.id === (firstCredit?.bankId ?? parsed.creditBankId)) ?? fallbackBank;
  const legacyCreditDate = latestCredit?.creditDate ?? parsed.creditDate ?? existing.expectedCreditDate?.toISOString().slice(0, 10) ?? parsed.orderDate;
  const [billingYear, billingMonth] = parsed.billingPeriod.split('-').map(Number);
  await prisma.income.update({
    where: { id: incomeId },
    data: {
      customerId: customer.id,
      salesChannelId: salesChannel.id,
      incomeCategoryId: incomeCategory.id,
      description: parsed.description || null,
      amount: parsed.amount,
      paymentMethodId: legacyMethod.id,
      creditBankId: legacyBank.id,
      orderDate: new Date(parsed.orderDate),
      creditDate: new Date(legacyCreditDate),
      expectedCreditDate: credits.length ? null : new Date(legacyCreditDate),
      isCredited: creditState.isCredited,
      billingYear,
      billingMonth,
      isFiscal: parsed.isFiscal,
      invoiceStatus: parsed.isFiscal ? (parsed.invoiceStatus || 'NON_INVIATA') : null,
      vatRate: parsed.isFiscal ? parsed.vatRate : 0,
      notes: parsed.notes || null,
      credits: {
        deleteMany: {},
        create: credits.map(credit => ({
          creditDate: new Date(credit.creditDate),
          paymentMethodId: credit.paymentMethodId,
          bankId: credit.bankId,
          amount: credit.amount,
        })),
      },
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
