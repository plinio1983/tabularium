import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incomeId = Number(id);

  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    return NextResponse.json({ error: 'ID incasso non valido' }, { status: 400 });
  }

  const income = await prisma.income.findUnique({ where: { id: incomeId } });

  if (!income) {
    return NextResponse.json({ error: 'Incasso non trovato' }, { status: 404 });
  }

  return NextResponse.json({
    income: {
      id: income.id,
      salesChannel: income.salesChannel,
      saleCategory: income.saleCategory,
      description: income.description,
      amount: income.amount.toString(),
      paymentMethod: income.paymentMethod,
      creditChannel: income.creditChannel,
      creditDate: income.creditDate,
      billingMonth: income.billingMonth,
      billingYear: income.billingYear,
      isFiscal: income.isFiscal,
      invoiceStatus: income.invoiceStatus,
      vatRate: income.vatRate.toString(),
      notes: income.notes
    }
  });
}
