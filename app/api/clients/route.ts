import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getWorkspaceApiAccess, getWorkspaceContext, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { prisma } from '@/lib/prisma';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';

const CustomerSchema = z.object({
  businessName: z.string().trim().min(1),
  alias: z.string().trim().optional().transform(value => value || null),
  email: z.string().trim().optional().transform(value => value || null),
  vatNumber: z.string().trim().optional().transform(value => value || null),
  taxCodeSdi: z.string().trim().optional().transform(value => value || null),
  pec: z.string().trim().optional().transform(value => value || null),
  iban: z.string().trim().optional().transform(value => value || null),
  swift: z.string().trim().optional().transform(value => value || null),
  internalNotes: z.string().trim().optional().transform(value => value || null)
});

function returnPath(request: Request) {
  const url = new URL(request.url);
  const target = pathFromUrl(url.searchParams.get('returnTo') || request.headers.get('referer'), '/clients');
  const parsed = new URL(target, 'http://tabularium.local');
  if (parsed.pathname === '/clients') parsed.searchParams.delete('new');
  return `${parsed.pathname}${parsed.search}`;
}

export async function GET(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const search = new URL(request.url).searchParams.get('search')?.trim();
  const customers = await prisma.customer.findMany({
    where: {
      workspaceId: current.workspace.id,
      ...(search ? { OR: [
        { businessName: { contains: search, mode: 'insensitive' as const } },
        { alias: { contains: search, mode: 'insensitive' as const } },
        { vatNumber: { contains: search, mode: 'insensitive' as const } },
        { taxCodeSdi: { contains: search, mode: 'insensitive' as const } }
      ] } : {})
    },
    orderBy: { businessName: 'asc' },
    take: 50
  });
  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  const isForm = request.headers.get('content-type')?.includes('form');
  const raw = isForm ? Object.fromEntries((await request.formData()).entries()) : await request.json();
  const data = CustomerSchema.parse(raw);
  const customer = await prisma.customer.create({ data: { ...data, workspaceId: current.workspace.id } });
  await writeAuditLog({
    workspaceId: current.workspace.id, userId: current.user.id, action: 'CREATE',
    entityType: 'Customer', entityId: customer.id, request
  });
  return isForm
    ? redirectToPath(appendFlash(returnPath(request), { saved: 'created' }))
    : NextResponse.json(customer);
}
