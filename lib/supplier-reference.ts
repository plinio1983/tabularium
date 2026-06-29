import { prisma } from '@/lib/prisma';

export class SupplierReferenceError extends Error {
  code = 'supplier_not_found' as const;

  constructor(message = 'Il fornitore non esiste. Aggiungilo prima con la funzione Nuovo fornitore, poi selezionalo nel form.') {
    super(message);
    this.name = 'SupplierReferenceError';
  }
}

export async function resolveExistingSupplierReference(
  data: { supplierId?: number | null; merchant?: string | null },
  workspaceId: number
) {
  const submittedName = String(data.merchant ?? '').trim();

  if (data.supplierId) {
    const existing = await prisma.supplier.findFirst({ where: { id: data.supplierId, workspaceId } });
    if (existing) return { id: existing.id, businessName: existing.businessName };
  }

  if (!submittedName) {
    throw new SupplierReferenceError('Esercente obbligatorio. Seleziona un fornitore esistente o crealo con la funzione Nuovo.');
  }

  const existingByName = await prisma.supplier.findFirst({
    where: { businessName: { equals: submittedName, mode: 'insensitive' }, workspaceId }
  });

  if (existingByName) return { id: existingByName.id, businessName: existingByName.businessName };

  throw new SupplierReferenceError();
}
