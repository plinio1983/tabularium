import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const customer = await prisma.customer.findFirst({
    where: { id: Number((await params).id), workspaceId: current.workspace.id },
    select: { id: true, businessName: true, alias: true, email: true, vatNumber: true, taxCodeSdi: true, pec: true, iban: true, swift: true, internalNotes: true, defaultSalesChannelId: true }
  });
  return customer ? NextResponse.json(customer) : NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });
}
