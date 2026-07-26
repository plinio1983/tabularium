import {NextResponse} from 'next/server';
import {getWorkspaceContext} from '@/lib/auth';
import {prisma} from '@/lib/prisma';

export async function GET(_request: Request, {params}: { params: Promise<{ id: string }> }) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
  const {id} = await params;
  const supplier = await prisma.supplier.findFirst({
    where: {id: Number(id), workspaceId: current.workspace.id},
    select: {
      id: true,
      businessName: true,
      alias: true,
      email: true,
      vatNumber: true,
      iban: true,
      pec: true,
      taxCodeSdi: true,
      internalNotes: true,
      defaultExpenseCategoryId: true
    }
  });
  if (!supplier) return NextResponse.json({error: 'Fornitore non trovato'}, {status: 404});
  return NextResponse.json(supplier);
}
