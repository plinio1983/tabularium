import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';

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
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  const data = RevenueSchema.parse(await request.json());
  const companyId = current.company.id;
  const revenue = await prisma.monthlyRevenue.upsert({
    where: { companyId_year_month: { companyId, year: data.year, month: data.month } },
    update: { ...data, companyId, workspaceId: current.workspace.id },
    create: { ...data, companyId, workspaceId: current.workspace.id }
  });
  return NextResponse.json(revenue);
}
