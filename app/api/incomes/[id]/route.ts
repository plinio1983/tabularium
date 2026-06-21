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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const { id } = await params;
  const incomeId = Number(id);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const action = String(raw._action || 'update');
  const returnTo = new URL(request.url).searchParams.get('returnTo');

  if (action === 'delete') {
    await prisma.income.deleteMany({ where: { id: incomeId, workspaceId: current.workspace.id } });
    return NextResponse.redirect(new URL(returnTo || '/incomes', request.url), 303);
  }

  const parsed = IncomeSchema.parse(raw);
  const existing = await prisma.income.findFirst({ where: { id: incomeId, workspaceId: current.workspace.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Incasso non trovato' }, { status: 404 });
  const [billingYear, billingMonth] = parsed.billingPeriod.split('-').map(Number);
  await prisma.income.update({
    where: { id: incomeId },
    data: {
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

  return NextResponse.redirect(new URL(returnTo || `/incomes/${incomeId}`, request.url), 303);
}
