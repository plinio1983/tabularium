import { prisma } from '@/lib/prisma';

const defaultCategories = [
  ['SBANC', 'Servizi Bancari'],
  ['ASSIC', 'Assicurazioni'],
  ['AFFUT', 'Affitti/Utenze'],
  ['WEB', 'Servizi Web'],
  ['SPED', 'Spedizioni/Corrieri'],
  ['TAX', 'Tasse/Imposte'],
  ['ALSRV', 'Altri Servizi'],
  ['MERCE', 'Merce/Forniture'],
  ['SUPP', 'Articoli di Supporto'],
  ['PERS', 'Prestazioni/Dipendenti'],
  ['RATE', 'Rateizzazione']
] as const;

const defaultBanks = ['MyTu', 'Unicredit', 'Wise', 'Altra Banca'];

export async function ensureWorkspaceDefaults(workspaceId: number) {
  for (const [code, name] of defaultCategories) {
    const existing = await prisma.expenseCategory.findFirst({ where: { workspaceId, code } });
    if (existing) await prisma.expenseCategory.update({ where: { id: existing.id }, data: { name } });
    else await prisma.expenseCategory.create({ data: { workspaceId, code, name } });
  }

  for (const name of defaultBanks) {
    const existing = await prisma.bank.findFirst({ where: { workspaceId, name } });
    if (!existing) await prisma.bank.create({ data: { workspaceId, name } });
  }
}
