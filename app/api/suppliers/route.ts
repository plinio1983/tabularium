import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceApiAccess, getWorkspaceContext, workspaceOperationalRoles } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';
import {isSupplierDefaultVatRate} from '@/lib/supplier-defaults';

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
  defaultVatRate: z.preprocess(value => value === '' || value == null ? null : value, z.coerce.number().refine(isSupplierDefaultVatRate, 'Aliquota IVA non valida').nullable())
});

function safePath(value: string | null, fallback: string, requestUrl: string) {
  const path = pathFromUrl(value, fallback);
  const url = new URL(path, 'http://tabularium.local');
  if (url.pathname === '/suppliers') url.searchParams.delete('new');
  return `${url.pathname}${url.search}`;
}

function redirectAfterFormSave(request: Request, fallback: string) {
  const requestUrl = request.url;
  const explicitReturnTo = new URL(requestUrl).searchParams.get('returnTo');
  const referer = request.headers.get('referer');
  const target = safePath(explicitReturnTo, safePath(referer, fallback, requestUrl), requestUrl);
  return target;
}

export async function GET(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim();
  const suppliers = await prisma.supplier.findMany({
    where: search ? {
      workspaceId: current.workspace.id,
      systemRole: null,
      OR: [
        { businessName: { contains: search, mode: 'insensitive' } },
        { alias: { contains: search, mode: 'insensitive' } },
        { vatNumber: { contains: search, mode: 'insensitive' } },
        { iban: { contains: search, mode: 'insensitive' } }
      ]
    } : { workspaceId: current.workspace.id, systemRole: null },
    orderBy: { businessName: 'asc' },
    take: 50
  });
  return NextResponse.json(suppliers);
}

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const current = access.current;
  const isForm = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') || request.headers.get('content-type')?.includes('multipart/form-data');
  const raw = isForm ? Object.fromEntries((await request.formData()).entries()) : await request.json();
  const data = SupplierSchema.parse(raw);
  if (data.defaultExpenseCategoryId) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: data.defaultExpenseCategoryId, workspaceId: current.workspace.id },
      select: { id: true }
    });
    if (!category) {
      return isForm
        ? redirectToPath(appendFlash(redirectAfterFormSave(request, '/suppliers'), { error: 'invalid' }))
        : NextResponse.json({ error: 'Categoria predefinita non valida' }, { status: 400 });
    }
  }
  const supplier = await prisma.supplier.create({ data: { ...data, workspaceId: current.workspace.id } });
  await writeAuditLog({
    workspaceId: current.workspace.id, userId: current.user.id, action: 'CREATE',
    entityType: 'Supplier', entityId: supplier.id, request
  });
  return isForm
    ? redirectToPath(appendFlash(redirectAfterFormSave(request, '/suppliers'), { saved: 'created' }))
    : NextResponse.json(supplier);
}
