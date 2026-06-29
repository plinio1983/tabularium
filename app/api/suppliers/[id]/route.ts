import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { redirectToPath } from '@/lib/redirect';

const SupplierSchema = z.object({
  businessName: z.string().trim().min(1),
  email: z.string().trim().optional().transform(value => value || null),
  phone: z.string().trim().optional().transform(value => value || null),
  pec: z.string().trim().optional().transform(value => value || null),
  taxCodeSdi: z.string().trim().optional().transform(value => value || null),
  alias: z.string().trim().optional().transform(value => value || null),
  internalNotes: z.string().trim().optional().transform(value => value || null),
  _action: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const { id } = await params;
  const supplierId = Number(id);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const action = String(raw._action || 'update');

  if (action === 'delete') {
    const linkedUsage = await prisma.expense.count({ where: { supplierId, workspaceId: current.workspace.id } })
      + await prisma.recurringExpense.count({ where: { supplierId, workspaceId: current.workspace.id } });
    if (linkedUsage > 0) {
      return redirectToPath(appendFlash('/suppliers', { error: 'in_use', usage: String(linkedUsage) }));
    }
    await prisma.supplier.deleteMany({ where: { id: supplierId, workspaceId: current.workspace.id } });
    return redirectToPath(appendFlash('/suppliers', { saved: 'deleted' }));
  }

  const data = SupplierSchema.parse(raw);
  const existing = await prisma.supplier.findFirst({ where: { id: supplierId, workspaceId: current.workspace.id }, select: { id: true } });
  if (!existing) return redirectToPath(appendFlash('/suppliers', { error: 'not_found' }));
  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      businessName: data.businessName,
      email: data.email,
      phone: data.phone,
      pec: data.pec,
      taxCodeSdi: data.taxCodeSdi,
      alias: data.alias,
      internalNotes: data.internalNotes
    }
  });
  return redirectToPath(appendFlash('/suppliers', { saved: 'updated' }));
}
