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
  internalNotes: z.string().trim().optional().transform(value => value || null)
});

function safePath(value: string | null, fallback: string, requestUrl: string) {
  if (!value) return fallback;
  try {
    const url = value.startsWith('http') ? new URL(value) : new URL(value, requestUrl);
    if (url.origin !== new URL(requestUrl).origin) return fallback;
    if (url.pathname === '/suppliers') url.searchParams.delete('new');
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith('/') ? value : fallback;
  }
}

function redirectAfterFormSave(request: Request, fallback: string) {
  const requestUrl = request.url;
  const explicitReturnTo = new URL(requestUrl).searchParams.get('returnTo');
  const referer = request.headers.get('referer');
  const target = safePath(explicitReturnTo, safePath(referer, fallback, requestUrl), requestUrl);
  return NextResponse.redirect(new URL(target, requestUrl), 303);
}

export async function GET(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim();
  const suppliers = await prisma.supplier.findMany({
    where: search ? {
      workspaceId: current.workspace.id,
      OR: [
        { businessName: { contains: search, mode: 'insensitive' } },
        { alias: { contains: search, mode: 'insensitive' } }
      ]
    } : { workspaceId: current.workspace.id },
    orderBy: { businessName: 'asc' },
    take: 50
  });
  return NextResponse.json(suppliers);
}

export async function POST(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const isForm = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') || request.headers.get('content-type')?.includes('multipart/form-data');
  const raw = isForm ? Object.fromEntries((await request.formData()).entries()) : await request.json();
  const data = SupplierSchema.parse(raw);
  const supplier = await prisma.supplier.create({ data: { ...data, workspaceId: current.workspace.id } });
  return isForm ? redirectAfterFormSave(request, '/suppliers') : NextResponse.json(supplier);
}
