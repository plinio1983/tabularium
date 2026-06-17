import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth';

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
    await prisma.expense.updateMany({ where: { supplierId, workspaceId: current.workspace.id }, data: { supplierId: null } });
    await prisma.supplier.deleteMany({ where: { id: supplierId, workspaceId: current.workspace.id } });
    return NextResponse.redirect(new URL('/suppliers', request.url), 303);
  }

  const data = SupplierSchema.parse(raw);
  const existing = await prisma.supplier.findFirst({ where: { id: supplierId, workspaceId: current.workspace.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 });
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
  return NextResponse.redirect(new URL('/suppliers', request.url), 303);
}
