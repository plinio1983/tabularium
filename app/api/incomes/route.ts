import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceApiAccess, getWorkspaceContext, workspaceOperationalRoles } from '@/lib/auth';
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
  dueDate: z.string().min(1),
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
  const incomes = await prisma.income.findMany({ where: { workspaceId: current.workspace.id, companyId: current.company.id }, include: {credits: true}, orderBy: { creditDate: 'desc' }, take: 500 });
  return NextResponse.json(incomes);
}

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  await ensureWorkspaceDefaults(current.workspace.id);
  const isForm = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') || request.headers.get('content-type')?.includes('multipart/form-data');
  const wantsJson = request.headers.get('accept')?.includes('application/json') || request.headers.get('x-requested-with') === 'fetch';
  const formData = isForm ? await request.formData() : null;
  const raw = formData ? Object.fromEntries(formData.entries()) : await request.json();
  const parsed = IncomeSchema.parse(raw);
  let credits = parseIncomeCredits(formData, (raw as any).credits);
  if (!credits.length && parsed.isCredited && parsed.paymentMethodId && parsed.creditBankId && parsed.creditDate) {
    credits = [{creditDate: parsed.creditDate, paymentMethodId: parsed.paymentMethodId, bankId: parsed.creditBankId, amount: parsed.amount}];
  }
  let creditState;
  try {
    creditState = validateIncomeCredits(credits, parsed.amount);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Accrediti non validi';
    return isForm && !wantsJson
      ? redirectToPath(appendFlash(redirectAfterFormSave(request, '/incomes'), {error: 'invalid'}))
      : NextResponse.json({error: message}, {status: 400});
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
  const firstCredit = credits[0];
  const latestCredit = [...credits].sort((a, b) => b.creditDate.localeCompare(a.creditDate))[0];
  const legacyMethod = methods.find(method => method.id === (firstCredit?.paymentMethodId ?? parsed.paymentMethodId)) ?? fallbackMethod;
  const legacyBank = banks.find(bank => bank.id === (firstCredit?.bankId ?? parsed.creditBankId)) ?? fallbackBank;
  const legacyCreditDate = latestCredit?.creditDate ?? parsed.creditDate ?? parsed.dueDate;
  const [billingYear, billingMonth] = parsed.billingPeriod.split('-').map(Number);
  const income = await prisma.income.create({
    data: {
      workspaceId: current.workspace.id,
      companyId: current.company.id,
      customerId: customer.id,
      salesChannelId: salesChannel.id,
      incomeCategoryId: incomeCategory.id,
      description: parsed.description || null,
      amount: parsed.amount,
      paymentMethodId: legacyMethod.id,
      creditBankId: legacyBank.id,
      orderDate: new Date(parsed.orderDate),
      creditDate: new Date(legacyCreditDate),
      dueDate: new Date(parsed.dueDate),
      isCredited: creditState.isCredited,
      billingYear,
      billingMonth,
      isFiscal: parsed.isFiscal,
      invoiceStatus: parsed.isFiscal ? (parsed.invoiceStatus || 'NON_INVIATA') : null,
      vatRate: parsed.isFiscal ? parsed.vatRate : 0,
      notes: parsed.notes || null,
      credits: credits.length ? {create: credits.map(credit => ({
        creditDate: new Date(credit.creditDate),
        paymentMethodId: credit.paymentMethodId,
        bankId: credit.bankId,
        amount: credit.amount,
      }))} : undefined,
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
