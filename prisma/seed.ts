import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, CompanyCode, InvoiceStatus } from "../generated/prisma/client";
import seed from '../data/seed.generated.json';

const connectionString = process.env.DATABASE_URL ?? "postgresql://dms:dms@localhost:5433/dms_spese_ricavi?schema=public";


const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const fixedCategories = [
  'Servizi Bancari',
  'Assicurazioni',
  'Affitti/Utenze',
  'Servizi Web',
  'Spedizioni/Corrieri',
  'Tasse/Imposte',
  'Altri Servizi',
  'Merce/Forniture',
  'Articoli di Supporto',
  'Prestazioni/Dipendenti',
  'Rateizzazione'
];

const fixedBanks = ['MyTu', 'Unicredit', 'Wise', 'Altra Banca'];

function normalizeCode(value: string) {
  return value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}


const categoryAcronyms: Record<string, string> = {
  'Servizi Bancari': 'SBANC',
  'Assicurazioni': 'ASSIC',
  'Affitti/Utenze': 'AFFUT',
  'Servizi Web': 'WEB',
  'Spedizioni/Corrieri': 'SPED',
  'Tasse/Imposte': 'TAX',
  'Altri Servizi': 'ALSRV',
  'Merce/Forniture': 'MERCE',
  'Articoli di Supporto': 'SUPP',
  'Prestazioni/Dipendenti': 'PERS',
  'Rateizzazione': 'RATE'
};

function categoryCode(name: string) {
  return categoryAcronyms[name] ?? normalizeCode(name);
}

const categoryCodeAliases: Record<string, string> = {
  SPEDIZIONI: categoryCode('Spedizioni/Corrieri'),
  SPEDIZIONI_CORRIERI: categoryCode('Spedizioni/Corrieri'),
  MERCE_PRODOTTI: categoryCode('Merce/Forniture'),
  MERCE_FORNITURE: categoryCode('Merce/Forniture'),
  SERVIZI_BANCARI: categoryCode('Servizi Bancari'),
  ASSICURAZIONI: categoryCode('Assicurazioni'),
  AFFITTI_UTENZE: categoryCode('Affitti/Utenze'),
  SERVIZI_WEB: categoryCode('Servizi Web'),
  TASSE_IMPOSTE: categoryCode('Tasse/Imposte'),
  ALTRI_SERVIZI: categoryCode('Altri Servizi'),
  ARTICOLI_DI_SUPPORTO: categoryCode('Articoli di Supporto'),
  PRESTAZIONI_DIPENDENTI: categoryCode('Prestazioni/Dipendenti'),
  RATEIZZAZIONE: categoryCode('Rateizzazione')
};

async function main() {
  await prisma.company.upsert({ where: { code: 'HM' }, update: { name: 'Herbal Market' }, create: { code: 'HM', name: 'Herbal Market' } });
  await prisma.company.upsert({ where: { code: 'TS' }, update: { name: 'TS' }, create: { code: 'TS', name: 'TS' } });
  await prisma.company.upsert({ where: { code: 'OTHER' }, update: { name: 'Altro Operatore' }, create: { code: 'OTHER', name: 'Altro Operatore' } });

  for (const categoryName of fixedCategories) {
    const code = categoryCode(categoryName);
    const existing = await prisma.expenseCategory.findFirst({ where: { workspaceId: null, code } });
    if (existing) await prisma.expenseCategory.update({ where: { id: existing.id }, data: { name: categoryName } });
    else await prisma.expenseCategory.create({ data: { code, name: categoryName } });
  }
  for (const bankName of fixedBanks) {
    const existing = await prisma.bank.findFirst({ where: { workspaceId: null, name: bankName } });
    if (!existing) await prisma.bank.create({ data: { name: bankName } });
  }

  await prisma.monthlyRevenue.deleteMany({});
  await prisma.expenseAttachment.deleteMany({});
  await prisma.expensePayment.deleteMany({});
  await prisma.expense.deleteMany({});

  const companies = Object.fromEntries((await prisma.company.findMany()).map(c => [c.code, c.id]));
  const categories = Object.fromEntries((await prisma.expenseCategory.findMany()).map(c => [c.code, c.id]));
  const fallbackCategoryId = categories[categoryCode('Altri Servizi')] ?? null;
  const banks = Object.fromEntries((await prisma.bank.findMany()).map(b => [b.name, b.id]));

  const supplierNames = Array.from(new Set(seed.expenses.map((expense: any) => String(expense.merchant || '').trim()).filter(Boolean)));
  for (const businessName of supplierNames) {
    const existing = await prisma.supplier.findFirst({ where: { businessName } });
    if (!existing) await prisma.supplier.create({ data: { businessName } });
  }
  const suppliers = Object.fromEntries((await prisma.supplier.findMany()).map(supplier => [supplier.businessName, supplier.id]));

  for (const revenue of seed.revenues) {
    const { companyCode, ...rest } = revenue;
    const companyId = companies[companyCode];
    await prisma.monthlyRevenue.create({ data: { ...rest, companyId } });
  }

  for (const expense of seed.expenses) {
    const paidAmount = expense.paymentDate || expense.isComplete ? expense.amount : 0;
    await prisma.expense.create({ data: {
      receivedDate: expense.receivedDate ? new Date(expense.receivedDate) : null,
      merchant: expense.merchant,
      supplierId: suppliers[expense.merchant] ?? null,
      categoryId: expense.categoryCode ? (categories[categoryCodeAliases[expense.categoryCode] ?? expense.categoryCode] ?? fallbackCategoryId) : fallbackCategoryId,
      description: expense.description,
      amount: expense.amount,
      paymentDate: expense.paymentDate ? new Date(expense.paymentDate) : null,
      vatRate: expense.vatRate || 22,
      channel: expense.channel,
      bankId: expense.bankName ? banks[expense.bankName] : null,
      isComplete: expense.isComplete,
      isDeclared: expense.isDeclared ?? true,
      hasElectronicInvoice: expense.hasElectronicInvoice ?? true,
      invoiceStatus: (expense.hasElectronicInvoice ? 'IN_ATTESA' : 'RICEVUTA') as InvoiceStatus,
      companyId: expense.companyCode ? companies[expense.companyCode] : null,
      paidByCurrentAccount: expense.paidByCurrentAccount,
      paymentStatus: expense.isComplete ? 'COMPLETATO' : (paidAmount > 0 ? 'PAGATO_PARZIALMENTE' : 'DA_PAGARE'),
      paidAmount,
      paidBy: 'HERBAL_MARKET',
      year: expense.year,
      month: expense.month,
      payments: paidAmount > 0 ? { create: [{
        paymentDate: expense.paymentDate ? new Date(expense.paymentDate) : null,
        channel: expense.channel,
        bankId: expense.bankName ? banks[expense.bankName] : null,
        amount: paidAmount,
        paidBy: 'HERBAL_MARKET'
      }] } : undefined
    }});
  }

  console.log(`Seed completato: ${seed.expenses.length} spese, ${seed.revenues.length} mesi importati.`);
}

main().finally(() => prisma.$disconnect());
