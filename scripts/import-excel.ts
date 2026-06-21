import XLSX from 'xlsx';
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, CompanyCode, InvoiceStatus } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL ?? "postgresql://dms:dms@localhost:5433/dms_spese_ricavi?schema=public";


const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const filePath = process.argv[2] || 'data/Spese-Ricavi.xlsx';
const months: Record<string, number> = { GEN: 1, FEB: 2, MAR: 3, APR: 4, MAG: 5, GIU: 6, LUG: 7, AGO: 8, SET: 9, OTT: 10, NOV: 11, DIC: 12 };

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
const fixedPaymentMethods = [
  ['Bonifico', 'BOTH'],
  ['Carta di Debito/Credit', 'BOTH'],
  ['Criptovaluta', 'INCOME'],
  ['Stripe', 'INCOME'],
  ['Cash', 'BOTH'],
  ['Addebito', 'EXPENSE'],
  ['RID Bancario', 'EXPENSE'],
  ['Modello F24', 'EXPENSE'],
  ['PayPal', 'EXPENSE'],
  ['Mooney', 'EXPENSE'],
  ['Altro metodo', 'BOTH']
] as const;
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

function mapCategoryName(value?: string) {
  const text = String(value || '').trim();
  if (!text) return 'Altri Servizi';
  if (text === 'Merce/Prodotti') return 'Merce/Forniture';
  if (text === 'Spedizioni') return 'Spedizioni/Corrieri';
  return fixedCategories.includes(text) ? text : 'Altri Servizi';
}
function mapBankName(value?: string) {
  const text = String(value || '').trim();
  return fixedBanks.includes(text) ? text : 'Altra Banca';
}
function mapChannel(value?: string) {
  const text = String(value || '').trim();
  const lower = text.toLowerCase();
  if (!text) return null;
  if (lower === 'rid') return 'RID Bancario';
  if (lower.includes('mooney')) return 'Mooney';
  if (lower.includes('bonifico')) return 'Bonifico';
  if (lower.includes('paypal')) return 'PayPal';
  if (lower.includes('addebito')) return 'Addebito';
  if (lower.includes('f24')) return 'Modello F24';
  if (lower.includes('cash') || lower.includes('contanti')) return 'Cash';
  return text;
}
function paymentMethodKind(name: string) {
  const found = fixedPaymentMethods.find(([methodName]) => methodName === name);
  return found ? found[1] : 'BOTH';
}


function asNumber(value: unknown) { return typeof value === 'number' ? value : Number(value || 0); }
function excelDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(parsed.y, parsed.m - 1, parsed.d) : null;
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}
async function getOrCreateCategory(name?: string) {
  const categoryName = mapCategoryName(name);
  const code = categoryCode(categoryName);
  const existing = await prisma.expenseCategory.findFirst({ where: { workspaceId: null, code } });
  return existing ? prisma.expenseCategory.update({ where: { id: existing.id }, data: { name: categoryName } }) : prisma.expenseCategory.create({ data: { code, name: categoryName } });
}
async function getOrCreateBank(name?: string) {
  const bankName = mapBankName(name);
  const existing = await prisma.bank.findFirst({ where: { workspaceId: null, name: bankName } });
  return existing ?? prisma.bank.create({ data: { name: bankName } });
}
async function getOrCreatePaymentMethod(name?: string) {
  const methodName = mapChannel(name);
  if (!methodName) return null;
  const existing = await prisma.paymentMethod.findFirst({ where: { workspaceId: null, name: { equals: methodName, mode: 'insensitive' } } });
  return existing ?? prisma.paymentMethod.create({ data: { name: methodName, kind: paymentMethodKind(methodName), isFallback: methodName === 'Altro metodo' } });
}
async function getOrCreateSupplier(name?: string) {
  const businessName = String(name || '').trim() || 'Senza esercente';
  const existing = await prisma.supplier.findFirst({ where: { businessName } });
  return existing ?? prisma.supplier.create({ data: { businessName } });
}

async function main() {
  await prisma.company.upsert({ where: { code: 'HM' }, update: {}, create: { code: 'HM', name: 'Herbal Market' } });
  await prisma.company.upsert({ where: { code: 'TS' }, update: {}, create: { code: 'TS', name: 'TS' } });
  await prisma.company.upsert({ where: { code: 'OTHER' }, update: {}, create: { code: 'OTHER', name: 'Altro' } });
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
  for (const [name, kind] of fixedPaymentMethods) {
    const existing = await prisma.paymentMethod.findFirst({ where: { workspaceId: null, name } });
    if (!existing) await prisma.paymentMethod.create({ data: { name, kind, isFallback: name === 'Altro metodo' } });
  }
  const companies = Object.fromEntries((await prisma.company.findMany()).map(c => [c.code, c]));

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  let imported = 0;
  for (const sheetName of workbook.SheetNames) {
    const match = sheetName.toUpperCase().match(/^([A-Z]{3})\s+(\d{4})$/);
    if (!match) continue;
    const month = months[match[1]];
    const year = Number(match[2]);
    const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null });
    const revenue = rows[1] || [];
    const orders = rows[2] || [];
    await prisma.monthlyRevenue.upsert({
      where: { companyId_year_month: { companyId: companies.HM.id, year, month } },
      create: { companyId: companies.HM.id, year, month, webAmount: asNumber(revenue[5]), shopAmount: asNumber(revenue[6]), noInvoiceAmount: asNumber(revenue[7]), totalOrders: orders[5] ? Number(orders[5]) : null, inps: asNumber(revenue[16]), accountant: asNumber(revenue[17]), tari: asNumber(revenue[18]), taxRate: 28 },
      update: { webAmount: asNumber(revenue[5]), shopAmount: asNumber(revenue[6]), noInvoiceAmount: asNumber(revenue[7]), totalOrders: orders[5] ? Number(orders[5]) : null, inps: asNumber(revenue[16]), accountant: asNumber(revenue[17]), tari: asNumber(revenue[18]) }
    });

    await prisma.expense.deleteMany({ where: { year, month } });
    for (const row of rows.slice(7)) {
      if (!row?.some(Boolean)) continue;
      if (!row[1] && !row[4]) continue;
      const category = await getOrCreateCategory(row[2]?.toString().trim());
      const bank = await getOrCreateBank(row[8]?.toString().trim());
      const paymentMethod = await getOrCreatePaymentMethod(row[7]?.toString().trim());
      const supplier = await getOrCreateSupplier(row[1]?.toString().trim());
      const code = row[13]?.toString().trim().toUpperCase();
      const company = code === 'HM' || code === 'TS' ? companies[code] : code ? companies.OTHER : null;
      const paidAmount = Boolean(row[9]) || row[5] ? asNumber(row[4]) : 0;
      await prisma.expense.create({ data: {
        receivedDate: excelDate(row[0]), merchant: supplier.businessName, supplierId: supplier.id, categoryId: category?.id,
        description: row[3]?.toString().trim() || null, amount: asNumber(row[4]), paymentDate: excelDate(row[5]), vatRate: asNumber(row[6]),
        channel: paymentMethod?.name ?? row[7]?.toString().trim() ?? null, bankId: bank?.id, isComplete: Boolean(row[9]),
        isDeclared: row[10]?.toString().toLowerCase() === 'si', hasElectronicInvoice: row[11]?.toString().toLowerCase() === 'si',
        invoiceStatus: (row[11]?.toString().toLowerCase() === 'si' ? 'IN_ATTESA' : 'RICEVUTA') as InvoiceStatus,
        companyId: company?.id, paidByCurrentAccount: Boolean(row[14]),
        paymentStatus: Boolean(row[9]) || row[5] ? 'COMPLETATO' : 'DA_PAGARE',
        paidAmount,
        paidBy: 'HERBAL_MARKET',
        year, month,
        payments: paidAmount > 0 ? { create: [{
          paymentDate: excelDate(row[5]),
          channel: paymentMethod?.name ?? row[7]?.toString().trim() ?? null,
          paymentMethodId: paymentMethod?.id ?? null,
          bankId: bank?.id,
          amount: paidAmount,
          paidBy: 'HERBAL_MARKET'
        }] } : undefined
      }});
      imported++;
    }
  }
  console.log(`Import completato da ${filePath}: ${imported} righe spesa.`);
}

main().finally(() => prisma.$disconnect());
