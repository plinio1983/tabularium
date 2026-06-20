import { prisma } from '@/lib/prisma';

export const defaultCategories = [
  ['SBANC', 'Servizi Bancari', '🏦'],
  ['ASSIC', 'Assicurazioni', '🛡️'],
  ['AFFUT', 'Affitti/Utenze', '🏠'],
  ['WEB', 'Servizi Web', '🌐'],
  ['SPED', 'Spedizioni/Corrieri', '🚚'],
  ['TAX', 'Tasse/Imposte', '🧾'],
  ['ALSRV', 'Altri Servizi', '🧰'],
  ['MERCE', 'Merce/Forniture', '📦'],
  ['SUPP', 'Articoli di Supporto', '🧩'],
  ['PERS', 'Prestazioni/Dipendenti', '👥'],
  ['RATE', 'Rateizzazione', '📆']
] as const;

export const categoryIconOptions = [
  '🏦',
  '🛡️',
  '🏠',
  '🌐',
  '🚚',
  '🧾',
  '🧰',
  '📦',
  '🧩',
  '👥',
  '📆',
  '💳',
  '🛒',
  '⚙️',
  '📄',
  '💼',
  '🔧',
  '📊',
  '💡',
  '⭐'
] as const;

const defaultBanks = ['MyTu', 'Unicredit', 'Wise', 'Altra Banca'];

export function orderExpenseCategories<T extends { id: number; code: string; name: string }>(categories: T[]) {
  const defaultCodes = defaultCategories.map(([code]) => code);
  const defaultItems = defaultCodes
    .map(code => categories.find(category => category.code === code))
    .filter(Boolean) as T[];
  const defaultIds = new Set(defaultItems.map(category => category.id));
  const customItems = categories
    .filter(category => !defaultIds.has(category.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));

  return [...defaultItems, ...customItems];
}

export async function ensureWorkspaceDefaults(workspaceId: number) {
  const existingCategories = await prisma.expenseCategory.count({ where: { workspaceId } });
  if (existingCategories === 0) {
    for (const [code, name, icon] of defaultCategories) {
      await prisma.expenseCategory.create({ data: { workspaceId, code, name, icon } });
    }
  }

  for (const name of defaultBanks) {
    const existing = await prisma.bank.findFirst({ where: { workspaceId, name } });
    if (!existing) await prisma.bank.create({ data: { workspaceId, name } });
  }
}
