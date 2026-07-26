import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  const customerId = Number((await params).id);
  const returnTo = pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/clients');
  const formData = await request.formData();
  const customer = await prisma.customer.findFirst({ where: { id: customerId, workspaceId: current.workspace.id } });
  if (!customer) return redirectToPath(appendFlash(returnTo, { error: 'not_found' }));

  if (String(formData.get('_action') || 'update') === 'delete') {
    const linked = await prisma.income.count({ where: { customerId, workspaceId: current.workspace.id } });
    if (customer.systemRole || linked > 0) {
      return redirectToPath(appendFlash(returnTo, { error: customer.systemRole ? 'system_protected' : 'in_use', usage: String(linked) }));
    }
    await prisma.customer.delete({ where: { id: customerId } });
    await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'DELETE',
      entityType: 'Customer', entityId: customerId, request
    });
    return redirectToPath(appendFlash('/clients', { saved: 'deleted' }));
  }

  const data = CustomerSchema.parse(Object.fromEntries(formData.entries()));
  await prisma.customer.update({ where: { id: customerId }, data });
  await writeAuditLog({
    workspaceId: current.workspace.id, userId: current.user.id, action: 'UPDATE',
    entityType: 'Customer', entityId: customerId, request
  });
  return redirectToPath(appendFlash(returnTo, { saved: 'updated' }));
}
