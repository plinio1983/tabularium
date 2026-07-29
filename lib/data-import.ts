import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import {
  ensureWorkspaceDefaults,
  fallbackBankName,
  fallbackPaymentMethodName
} from '@/lib/workspace-defaults';

export type DataImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  duplicates: number;
  deleted: number;
  relatedCreated: number;
  sheets: string[];
  errors: string[];
};

type ImportOptions = { clearBeforeImport?: boolean; workspaceId: number; companyId: number };
type TabularRow = { sheetName: string; rowNumber: number; row: Record<string, unknown> };

function normalizeHeader(value: string) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeIdentity(value: unknown) {
  return normalizeText(value).toLocaleLowerCase('it-IT').replace(/\s+/g, ' ');
}

function rowValue(row: Record<string, unknown>, names: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  for (const name of names) {
    const value = normalized.get(normalizeHeader(name));
    if (value !== undefined && value !== null && normalizeText(value) !== '') return value;
  }
  return null;
}

function parseMoney(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = normalizeText(value).replace(/€/g, '').replace(/\s/g, '');
  if (!text) return 0;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(parsed.y, parsed.m - 1, parsed.d) : null;
  }
  const text = normalizeText(value);
  const italian = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (italian) return new Date(Number(italian[3]), Number(italian[2]) - 1, Number(italian[1]));
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseBillingPeriod(value: unknown, fallback: Date) {
  const text = normalizeText(value);
  const iso = text.match(/^(\d{4})[-/](\d{1,2})$/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]) };
  const date = parseDate(value);
  return date
    ? { year: date.getFullYear(), month: date.getMonth() + 1 }
    : { year: fallback.getFullYear(), month: fallback.getMonth() + 1 };
}

function parseBool(value: unknown, fallback: boolean) {
  if (value === null || value === undefined || normalizeText(value) === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = normalizeText(value).toLowerCase();
  if (['0', 'no', 'false', 'n', 'non accreditato', 'non fiscale'].includes(text)) return false;
  return ['1', 'si', 'sì', 'yes', 'true', 'ok', 'x', 'accreditato', 'fiscale'].includes(text);
}

function normalizeCode(value: string) {
  return value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'OTHER';
}

function workbookRows(buffer: Buffer, expectedHeaders: string[]) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const result: TabularRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: null });
    const headers = new Set(Object.keys(rows[0] ?? {}).map(normalizeHeader));
    if (!expectedHeaders.some(header => headers.has(normalizeHeader(header)))) continue;
    rows.forEach((row, index) => result.push({ sheetName, rowNumber: index + 2, row }));
  }
  return result;
}

function resultFor(rows: TabularRow[]): DataImportResult {
  return {
    imported: 0,
    updated: 0,
    skipped: 0,
    duplicates: 0,
    deleted: 0,
    relatedCreated: 0,
    sheets: Array.from(new Set(rows.map(item => item.sheetName))),
    errors: []
  };
}

function addRowError(result: DataImportResult, item: TabularRow, message: string) {
  result.skipped++;
  if (result.errors.length < 8) result.errors.push(`${item.sheetName}, riga ${item.rowNumber}: ${message}`);
}

type ContactKind = 'customer' | 'supplier';

async function findContact(kind: ContactKind, workspaceId: number, businessName: string, vatNumber: string) {
  const delegate = kind === 'customer' ? prisma.customer : prisma.supplier;
  if (vatNumber) {
    const byVat = await (delegate as any).findFirst({
      where: { workspaceId, vatNumber: { equals: vatNumber, mode: 'insensitive' } }
    });
    if (byVat) return byVat;
  }
  return (delegate as any).findFirst({
    where: { workspaceId, businessName: { equals: businessName, mode: 'insensitive' } }
  });
}

async function importContactsWorkbook(buffer: Buffer, options: ImportOptions, kind: ContactKind): Promise<DataImportResult> {
  const rows = workbookRows(buffer, ['Ragione sociale', 'Cliente', 'Fornitore']);
  const result = resultFor(rows);
  for (const item of rows) {
    try {
      const businessName = normalizeText(rowValue(item.row, ['Ragione sociale', 'Nome / Ragione sociale', kind === 'customer' ? 'Cliente' : 'Fornitore']));
      if (!businessName) {
        addRowError(result, item, 'ragione sociale mancante');
        continue;
      }
      const vatNumber = normalizeText(rowValue(item.row, ['Partita IVA', 'P.IVA', 'PIVA', 'VAT']));
      const existing = await findContact(kind, options.workspaceId, businessName, vatNumber);
      const common = {
        businessName,
        alias: normalizeText(rowValue(item.row, ['Referente', 'Alias'])),
        email: normalizeText(rowValue(item.row, ['Email'])),
        vatNumber,
        taxCodeSdi: normalizeText(rowValue(item.row, ['Codice fiscale/SDI', 'Codice SDI', 'SDI', 'Codice destinatario'])),
        pec: normalizeText(rowValue(item.row, ['PEC'])),
        iban: normalizeText(rowValue(item.row, ['IBAN'])),
        internalNotes: normalizeText(rowValue(item.row, ['Note interne', 'Note']))
      };
      const populated = Object.fromEntries(Object.entries(common).filter(([, value]) => value !== ''));
      const swift = normalizeText(rowValue(item.row, ['SWIFT', 'BIC']));
      if (swift) Object.assign(populated, { swift });
      if (existing) {
        if (existing.systemRole) {
          result.duplicates++;
          continue;
        }
        if (kind === 'customer') {
          await prisma.customer.update({ where: { id: existing.id }, data: populated as any });
        } else {
          await prisma.supplier.update({ where: { id: existing.id }, data: populated as any });
        }
        result.updated++;
      } else {
        if (kind === 'customer') {
          await prisma.customer.create({ data: { ...populated, workspaceId: options.workspaceId } as any });
        } else {
          await prisma.supplier.create({ data: { ...populated, workspaceId: options.workspaceId } as any });
        }
        result.imported++;
      }
    } catch (error) {
      addRowError(result, item, error instanceof Error ? error.message : 'errore imprevisto');
    }
  }
  return result;
}

export function importCustomersWorkbook(buffer: Buffer, options: ImportOptions) {
  return importContactsWorkbook(buffer, options, 'customer');
}

export function importSuppliersWorkbook(buffer: Buffer, options: ImportOptions) {
  return importContactsWorkbook(buffer, options, 'supplier');
}

async function getOrCreateCustomer(workspaceId: number, businessName: string) {
  const existing = await prisma.customer.findFirst({
    where: { workspaceId, businessName: { equals: businessName, mode: 'insensitive' } }
  });
  if (existing) return { record: existing, created: false };
  const record = await prisma.customer.create({ data: { workspaceId, businessName } });
  return { record, created: true };
}

async function getOrCreateIncomeEntity(kind: 'category' | 'channel', workspaceId: number, raw: unknown) {
  const name = normalizeText(raw);
  const delegate = kind === 'category' ? prisma.incomeCategory : prisma.incomeSalesChannel;
  if (!name) {
    const fallback = await (delegate as any).findFirst({ where: { workspaceId, code: 'OTHER' } });
    return { record: fallback, created: false };
  }
  const existing = await (delegate as any).findFirst({
    where: {
      workspaceId,
      OR: [
        { code: { equals: name, mode: 'insensitive' } },
        { name: { equals: name, mode: 'insensitive' } }
      ]
    }
  });
  if (existing) return { record: existing, created: false };
  const code = normalizeCode(name);
  const existingByNormalizedCode = await (delegate as any).findFirst({ where: { workspaceId, code } });
  if (existingByNormalizedCode) return { record: existingByNormalizedCode, created: false };
  const record = await (delegate as any).create({ data: { workspaceId, code, name } });
  return { record, created: true };
}

async function configuredIncomeReferences(workspaceId: number, paymentMethodRaw: unknown, bankRaw: unknown) {
  const paymentName = normalizeText(paymentMethodRaw);
  const bankName = normalizeText(bankRaw);
  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: paymentName
      ? { workspaceId, name: { equals: paymentName, mode: 'insensitive' }, kind: { in: ['INCOME', 'BOTH'] } }
      : { workspaceId, isFallback: true, kind: { in: ['INCOME', 'BOTH'] } }
  }) ?? await prisma.paymentMethod.findFirst({ where: { workspaceId, name: fallbackPaymentMethodName } });
  const bank = await prisma.bank.findFirst({
    where: bankName
      ? { workspaceId, name: { equals: bankName, mode: 'insensitive' } }
      : { workspaceId, isFallback: true }
  }) ?? await prisma.bank.findFirst({ where: { workspaceId, name: fallbackBankName } });
  return { paymentMethod, bank };
}

export async function importIncomesWorkbook(buffer: Buffer, options: ImportOptions): Promise<DataImportResult> {
  const rows = workbookRows(buffer, ['Data accredito', 'Cliente', 'Importo']);
  const result = resultFor(rows);
  await ensureWorkspaceDefaults(options.workspaceId);
  const hasImportableRow = rows.some(item => {
    const customer = normalizeText(rowValue(item.row, ['Cliente', 'Ragione sociale', 'Nome cliente']));
    const amount = parseMoney(rowValue(item.row, ['Importo', 'Incasso', 'Totale']));
    const date = parseDate(rowValue(item.row, ['Data accredito', 'Data incasso', 'Data']));
    return Boolean(customer && amount > 0 && date);
  });
  if (options.clearBeforeImport && hasImportableRow) {
    const deleted = await prisma.income.deleteMany({ where: { workspaceId: options.workspaceId, companyId: options.companyId } });
    result.deleted = deleted.count;
  }

  for (const item of rows) {
    try {
      const customerName = normalizeText(rowValue(item.row, ['Cliente', 'Ragione sociale', 'Nome cliente']));
      const amount = parseMoney(rowValue(item.row, ['Importo', 'Incasso', 'Totale']));
      const creditDate = parseDate(rowValue(item.row, ['Data accredito', 'Data incasso', 'Data']));
      const orderDate = parseDate(rowValue(item.row, ['Data ordine'])) ?? creditDate;
      if (!customerName || amount <= 0 || !creditDate) {
        addRowError(result, item, 'cliente, importo positivo e data accredito sono obbligatori');
        continue;
      }
      const customerResult = await getOrCreateCustomer(options.workspaceId, customerName);
      if (customerResult.created) result.relatedCreated++;
      const channelResult = await getOrCreateIncomeEntity('channel', options.workspaceId, rowValue(item.row, ['Canale vendita', 'Canale']));
      if (channelResult.created) result.relatedCreated++;
      const incomeCategory = await prisma.incomeCategory.findFirst({
        where: { workspaceId: options.workspaceId, code: 'B2C' }
      }) ?? await prisma.incomeCategory.findFirst({
        where: { workspaceId: options.workspaceId },
        orderBy: { id: 'asc' }
      });
      const refs = await configuredIncomeReferences(
        options.workspaceId,
        rowValue(item.row, ['Metodo accredito', 'Metodo pagamento', 'Metodo']),
        rowValue(item.row, ['Banca', 'Banca accredito'])
      );
      if (!incomeCategory || !channelResult.record || !refs.paymentMethod || !refs.bank) {
        addRowError(result, item, 'configurazione di categoria, canale, metodo o banca non disponibile');
        continue;
      }
      const description = normalizeText(rowValue(item.row, ['Descrizione', 'Prodotto/servizio']));
      const billing = parseBillingPeriod(rowValue(item.row, ['Periodo fatturazione', 'Competenza']), creditDate);
      if (billing.month < 1 || billing.month > 12) {
        addRowError(result, item, 'periodo fatturazione non valido');
        continue;
      }
      const existingCandidates = await prisma.income.findMany({
        where: {
          workspaceId: options.workspaceId,
          companyId: options.companyId,
          customerId: customerResult.record.id,
          amount,
          creditDate,
          billingYear: billing.year,
          billingMonth: billing.month,
          salesChannelId: channelResult.record.id,
          incomeCategoryId: incomeCategory.id
        },
        select: { description: true }
      });
      if (existingCandidates.some(candidate => normalizeIdentity(candidate.description) === normalizeIdentity(description))) {
        result.duplicates++;
        continue;
      }
      const isFiscal = parseBool(rowValue(item.row, ['Fiscale', 'Incasso fiscale']), true);
      const isCredited = parseBool(rowValue(item.row, ['Accreditato', 'Incassato']), true);
      const vatRate = isFiscal ? parseMoney(rowValue(item.row, ['Aliquota IVA', 'IVA', '% IVA'])) || 22 : 0;
      const rawInvoiceStatus = normalizeText(rowValue(item.row, ['Stato fattura', 'Fattura'])).toUpperCase();
      const invoiceStatus = !isFiscal ? null
        : ['EMESSA', 'INVIATA', 'OK', 'RICEVUTA'].includes(rawInvoiceStatus) ? 'EMESSA'
          : ['PARZIALE', 'FATTURATO PARZIALMENTE', 'FATTURATA PARZIALMENTE'].includes(rawInvoiceStatus) ? 'PARZIALE'
            : 'NON_INVIATA';
      await prisma.income.create({
        data: {
          workspaceId: options.workspaceId,
          companyId: options.companyId,
          customerId: customerResult.record.id,
          salesChannelId: channelResult.record.id,
          incomeCategoryId: incomeCategory.id,
          description: description || null,
          amount,
          paymentMethodId: refs.paymentMethod.id,
          creditBankId: refs.bank.id,
          orderDate,
          creditDate,
          isCredited,
          billingYear: billing.year,
          billingMonth: billing.month,
          isFiscal,
          invoiceStatus,
          vatRate,
          notes: normalizeText(rowValue(item.row, ['Note', 'Annotazioni'])) || null
        }
      });
      result.imported++;
    } catch (error) {
      addRowError(result, item, error instanceof Error ? error.message : 'errore imprevisto');
    }
  }
  return result;
}
