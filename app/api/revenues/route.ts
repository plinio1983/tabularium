import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth';

const RevenueSchema = z.object({
  companyId: z.coerce.number(),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000),
  webAmount: z.coerce.number().default(0),
  shopAmount: z.coerce.number().default(0),
  noInvoiceAmount: z.coerce.number().default(0),
  totalOrders: z.coerce.number().optional().nullable(),
  inps: z.coerce.number().default(0),
  accountant: z.coerce.number().default(0),
  tari: z.coerce.number().default(0),
  taxRate: z.coerce.number().default(28)
});

export async function POST(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const data = RevenueSchema.parse(await request.json());
  const company = await prisma.company.findFirst({ where: { id: data.companyId, workspaceId: current.workspace.id }, select: { id: true } });
  if (!company) return NextResponse.json({ error: 'Società non trovata' }, { status: 404 });
  const revenue = await prisma.monthlyRevenue.upsert({
    where: { companyId_year_month: { companyId: data.companyId, year: data.year, month: data.month } },
    update: { ...data, workspaceId: current.workspace.id },
    create: { ...data, workspaceId: current.workspace.id }
  });
  return NextResponse.json(revenue);
}
