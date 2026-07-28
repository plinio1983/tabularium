import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';

const SupplierSchema = z.object({
  businessName: z.string().trim().min(1),
  email: z.string().trim().optional().transform(value => value || null),
  vatNumber: z.string().trim().optional().transform(value => value || null),
  iban: z.string().trim().optional().transform(value => value || null),
  pec: z.string().trim().optional().transform(value => value || null),
  taxCodeSdi: z.string().trim().optional().transform(value => value || null),
  alias: z.string().trim().optional().transform(value => value || null),
  swift: z.string().trim().optional().transform(value => value || null),
  internalNotes: z.string().trim().optional().transform(value => value || null),
  defaultExpenseCategoryId: z.preprocess(value => value === '' || value == null ? null : value, z.coerce.number().int().positive().nullable()),
  _action: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  const { id } = await params;
  const returnTo = pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/suppliers');
  const supplierId = Number(id);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const action = String(raw._action || 'update');

  const protectedSupplier = await prisma.supplier.findFirst({ where: { id: supplierId, workspaceId: current.workspace.id }, select: { systemRole: true } });
  if (protectedSupplier?.systemRole) return redirectToPath(appendFlash(returnTo, { error: 'system_protected' }));

  if (action === 'delete') {
    const linkedUsage = await prisma.expense.count({ where: { supplierId, workspaceId: current.workspace.id } })
      + await prisma.recurringExpense.count({ where: { supplierId, workspaceId: current.workspace.id } });
    if (linkedUsage > 0) {
      return redirectToPath(appendFlash('/suppliers', { error: 'in_use', usage: String(linkedUsage) }));
    }
    const deleted = await prisma.supplier.deleteMany({ where: { id: supplierId, workspaceId: current.workspace.id } });
    if (deleted.count) await writeAuditLog({
      workspaceId: current.workspace.id, userId: current.user.id, action: 'DELETE',
      entityType: 'Supplier', entityId: supplierId, request
    });
    return redirectToPath(appendFlash('/suppliers', { saved: 'deleted' }));
  }

  const data = SupplierSchema.parse(raw);
  const existing = await prisma.supplier.findFirst({ where: { id: supplierId, workspaceId: current.workspace.id }, select: { id: true } });
  if (!existing) return redirectToPath(appendFlash(returnTo, { error: 'not_found' }));
  if (data.defaultExpenseCategoryId) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: data.defaultExpenseCategoryId, workspaceId: current.workspace.id },
      select: { id: true }
    });
    if (!category) return redirectToPath(appendFlash(returnTo, { error: 'invalid' }));
  }
  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      businessName: data.businessName,
      email: data.email,
      vatNumber: data.vatNumber,
      iban: data.iban,
      pec: data.pec,
      taxCodeSdi: data.taxCodeSdi,
      alias: data.alias,
      swift: data.swift,
      internalNotes: data.internalNotes,
      defaultExpenseCategoryId: data.defaultExpenseCategoryId
    }
  });
  await writeAuditLog({
    workspaceId: current.workspace.id, userId: current.user.id, action: 'UPDATE',
    entityType: 'Supplier', entityId: supplierId, request
  });
  return redirectToPath(appendFlash(returnTo, { saved: 'updated' }));
}
