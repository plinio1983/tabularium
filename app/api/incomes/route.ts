import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth';

const BooleanFromForm = z.preprocess((value) => value === true || value === 'true' || value === 'on' || value === '1', z.boolean());

const IncomeSchema = z.object({
  salesChannel: z.enum(['Shop', 'Online Shop', 'Altro Canale']),
  saleCategory: z.enum(['B2C', 'B2B', 'Altro']).default('B2C'),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().nonnegative(),
  paymentMethod: z.enum(['Bonifico', 'Carta di Debito/Credit', 'Criptovaluta', 'Stripe', 'Cash']),
  creditChannel: z.enum(['Cash', 'Unicredit', 'MyTu', 'Wise']),
  creditDate: z.string().min(1),
  isCredited: BooleanFromForm.default(true),
  billingPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  isFiscal: BooleanFromForm.default(true),
  invoiceStatus: z.string().optional().nullable(),
  vatRate: z.coerce.number().default(22),
  notes: z.string().optional().nullable()
});


function safePath(value: string | null, fallback: string, requestUrl: string) {
  if (!value) return fallback;
  try {
    const url = value.startsWith('http') ? new URL(value) : new URL(value, requestUrl);
    if (url.origin !== new URL(requestUrl).origin) return fallback;
    if (url.pathname === '/incomes') url.searchParams.delete('new');
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith('/') ? value : fallback;
  }
}

function redirectAfterFormSave(request: Request, fallback: string) {
  const requestUrl = request.url;
  const explicitReturnTo = new URL(requestUrl).searchParams.get('returnTo');
  const referer = request.headers.get('referer');
  const target = safePath(explicitReturnTo, safePath(referer, fallback, requestUrl), requestUrl);
  return NextResponse.redirect(new URL(target, requestUrl), 303);
}

export async function GET() {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const incomes = await prisma.income.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { creditDate: 'desc' }, take: 500 });
  return NextResponse.json(incomes);
}

export async function POST(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const isForm = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') || request.headers.get('content-type')?.includes('multipart/form-data');
  const raw = isForm ? Object.fromEntries((await request.formData()).entries()) : await request.json();
  const parsed = IncomeSchema.parse(raw);
  const [billingYear, billingMonth] = parsed.billingPeriod.split('-').map(Number);
  const income = await prisma.income.create({
    data: {
      workspaceId: current.workspace.id,
      salesChannel: parsed.salesChannel,
      saleCategory: parsed.saleCategory,
      description: parsed.description || null,
      amount: parsed.amount,
      paymentMethod: parsed.paymentMethod,
      creditChannel: parsed.creditChannel,
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
  return isForm ? redirectAfterFormSave(request, '/incomes') : NextResponse.json(income);
}
