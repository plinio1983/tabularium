import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/auth';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const { id } = await params;
  const incomeId = Number(id);

  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    return NextResponse.json({ error: 'ID incasso non valido' }, { status: 400 });
  }

  const income = await prisma.income.findFirst({
    where: { id: incomeId, workspaceId: current.workspace.id, companyId: current.company.id },
    include: { credits: { orderBy: [{creditDate: 'asc'}, {id: 'asc'}] } }
  });

  if (!income) {
    return NextResponse.json({ error: 'Incasso non trovato' }, { status: 404 });
  }

  return NextResponse.json({
    income: {
      id: income.id,
      customerId: income.customerId,
      salesChannelId: income.salesChannelId,
      orderDate: income.orderDate ?? income.creditDate,
      description: income.description,
      amount: income.amount.toString(),
      paymentMethodId: income.paymentMethodId,
      creditBankId: income.creditBankId,
      creditDate: income.creditDate,
      expectedCreditDate: income.expectedCreditDate,
      isCredited: income.isCredited,
      credits: income.credits.map(credit => ({
        id: credit.id,
        creditDate: credit.creditDate,
        amount: credit.amount.toString(),
        paymentMethodId: credit.paymentMethodId,
        bankId: credit.bankId,
      })),
      billingMonth: income.billingMonth,
      billingYear: income.billingYear,
      isFiscal: income.isFiscal,
      invoiceStatus: income.invoiceStatus,
      vatRate: income.vatRate.toString(),
      notes: income.notes
    }
  });
}
