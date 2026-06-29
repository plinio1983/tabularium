import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';

const BooleanFromForm = z.preprocess((value) => value === true || value === 'true' || value === 'on' || value === '1', z.boolean());

const IncomeSchema = z.object({
  salesChannel: z.enum(['Shop', 'Online Shop', 'Altro Canale']),
  saleCategory: z.enum(['B2C', 'B2B', 'Altro']).default('B2C'),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().nonnegative(),
  paymentMethod: z.string().optional(),
  paymentMethodId: z.coerce.number(),
  creditChannel: z.string().optional(),
  creditBankId: z.coerce.number(),
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
  const rawReturnTo = new URL(request.url).searchParams.get('returnTo');
  const returnTo = pathFromUrl(rawReturnTo, `/incomes/${incomeId}`);

  if (action === 'delete') {
    await prisma.income.deleteMany({ where: { id: incomeId, workspaceId: current.workspace.id } });
    return redirectToPath(appendFlash(pathFromUrl(rawReturnTo, '/incomes'), { saved: 'deleted' }));
  }

  const parsed = IncomeSchema.parse(raw);
  const [paymentMethod, creditBank] = await Promise.all([
    prisma.paymentMethod.findFirst({ where: { id: parsed.paymentMethodId, workspaceId: current.workspace.id } }),
    prisma.bank.findFirst({ where: { id: parsed.creditBankId, workspaceId: current.workspace.id } })
  ]);
  if (!paymentMethod || !creditBank) return NextResponse.json({ error: 'Metodo o banca non validi' }, { status: 400 });
  const existing = await prisma.income.findFirst({ where: { id: incomeId, workspaceId: current.workspace.id }, select: { id: true } });
  if (!existing) {
    return redirectToPath(appendFlash(returnTo || '/incomes', { error: 'not_found' }));
  }
  const [billingYear, billingMonth] = parsed.billingPeriod.split('-').map(Number);
  await prisma.income.update({
    where: { id: incomeId },
    data: {
      salesChannel: parsed.salesChannel,
      saleCategory: parsed.saleCategory,
      description: parsed.description || null,
      amount: parsed.amount,
      paymentMethod: paymentMethod.name,
      paymentMethodId: paymentMethod.id,
      creditChannel: creditBank.name,
      creditBankId: creditBank.id,
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

  return redirectToPath(appendFlash(returnTo || `/incomes/${incomeId}`, { saved: 'updated' }));
}
