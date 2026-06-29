import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import type { CompanyCode, InvoiceStatus, PaidBy, PaymentStatus } from '../generated/prisma/client';
import { defaultPaymentMethods, fallbackPaymentMethodName } from '@/lib/workspace-defaults';

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

const categoryAliases: Record<string, string> = {
  BANK: 'Servizi Bancari',
  SBANC: 'Servizi Bancari',
  ASS: 'Assicurazioni',
  ASSIC: 'Assicurazioni',
  'AFF/UT': 'Affitti/Utenze',
  AFFUT: 'Affitti/Utenze',
  WEBSRV: 'Servizi Web',
  WEB: 'Servizi Web',
  SPED: 'Spedizioni/Corrieri',
  SPEDIZIONI: 'Spedizioni/Corrieri',
  'TAX/IMP': 'Tasse/Imposte',
  TAX: 'Tasse/Imposte',
  RAT: 'Rateizzazione',
  RATE: 'Rateizzazione',
  MERCE: 'Merce/Forniture',
  PROD: 'Merce/Forniture',
  PRODOTTI: 'Merce/Forniture',
  SUPP: 'Articoli di Supporto',
  PERS: 'Prestazioni/Dipendenti'
};

export type ExpenseImportResult = {
  imported: number;
  skipped: number;
  deleted: number;
  suppliersCreated: number;
  sheets: string[];
};

function normalizeCode(value: string) {
  return value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function categoryCode(name: string) {
  return categoryAcronyms[name] ?? normalizeCode(name);
}

function normalizeHeader(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rowValue(row: Record<string, unknown>, names: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  for (const name of names) {
    const value = normalized.get(normalizeHeader(name));
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function parseMoney(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').replace(/€/g, '').replace(/\s/g, '').trim();
  if (!text) return 0;
  const decimal = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = Number(decimal.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(parsed.y, parsed.m - 1, parsed.d) : null;
  }
  const text = String(value).trim();
  const italian = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (italian) return new Date(Number(italian[3]), Number(italian[2]) - 1, Number(italian[1]));
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseBool(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value ?? '').trim().toLowerCase();
  return ['1', 'si', 'sì', 'yes', 'true', 'ok', 'x', 'completato', 'pagato'].includes(text);
}

function textValue(value: unknown) {
  return String(value ?? '').trim();
}

function mapCategoryName(value: unknown) {
  const text = textValue(value);
  if (!text) return 'Altri Servizi';
  const upper = text.toUpperCase().trim();
  const alias = categoryAliases[upper];
  if (alias) return alias;
  if (text === 'Merce/Prodotti') return 'Merce/Forniture';
  if (text === 'Spedizioni') return 'Spedizioni/Corrieri';
  return fixedCategories.includes(text) ? text : 'Altri Servizi';
}

function mapBankName(value: unknown) {
  const text = textValue(value);
  return fixedBanks.includes(text) ? text : 'Altra Banca';
}

function mapChannel(value: unknown) {
  const text = textValue(value);
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

function mapPaymentMethodKind(name: string) {
  const found = defaultPaymentMethods.find(([methodName]) => methodName === name);
  return found ? found[1] : 'BOTH';
}

function mapPaidBy(value: unknown): PaidBy {
  const text = textValue(value).toLowerCase();
  return text.includes('altro') ? 'ALTRO_OPERATORE' : 'HERBAL_MARKET';
}

function mapCompanyCode(value: unknown): CompanyCode {
  const text = textValue(value).toLowerCase();
  if (text.includes('altro') || text.includes('other')) return 'OTHER';
  if (text === 'ts') return 'TS';
  return 'HM';
}

function mapInvoiceStatus(value: unknown, hasElectronicInvoice: boolean): InvoiceStatus {
  const text = textValue(value).toLowerCase();
  if (['non prevista', 'non previsto', 'nonprevista', 'n/a', 'na'].includes(text)) return 'NON_PREVISTA';
  if (['ok', 'emessa', 'ricevuta'].includes(text)) return 'RICEVUTA';
  if (['inviata sdi', 'sdi', 'emessa sdi'].includes(text)) return 'RICEVUTA';
  if (text.includes('contest')) return 'CONTESTAZIONE';
  return 'IN_ATTESA';
}

async function ensureReferenceData(workspaceId?: number) {
  await prisma.company.upsert({ where: { code: 'HM' }, update: { name: 'Herbal Market', ...(workspaceId ? { workspaceId } : {}) }, create: { code: 'HM', name: 'Herbal Market', ...(workspaceId ? { workspaceId } : {}) } });
  await prisma.company.upsert({ where: { code: 'OTHER' }, update: { name: 'Altro Operatore', ...(workspaceId ? { workspaceId } : {}) }, create: { code: 'OTHER', name: 'Altro Operatore', ...(workspaceId ? { workspaceId } : {}) } });

  for (const categoryName of fixedCategories) {
    const code = categoryCode(categoryName);
    const existing = await prisma.expenseCategory.findFirst({ where: { workspaceId: workspaceId ?? null, code } });
    if (existing) await prisma.expenseCategory.update({ where: { id: existing.id }, data: { name: categoryName } });
    else await prisma.expenseCategory.create({ data: { code, name: categoryName, workspaceId: workspaceId ?? null } });
  }
  for (const bankName of fixedBanks) {
    const existing = await prisma.bank.findFirst({ where: { workspaceId: workspaceId ?? null, name: bankName } });
    if (!existing) await prisma.bank.create({ data: { name: bankName, workspaceId: workspaceId ?? null } });
  }
  for (const [name, kind] of defaultPaymentMethods) {
    const existing = await prisma.paymentMethod.findFirst({ where: { workspaceId: workspaceId ?? null, name } });
    if (!existing) {
      await prisma.paymentMethod.create({ data: { workspaceId: workspaceId ?? null, name, kind, isFallback: name === fallbackPaymentMethodName } });
    } else if (name === fallbackPaymentMethodName && !existing.isFallback) {
      await prisma.paymentMethod.update({ where: { id: existing.id }, data: { isFallback: true } });
    }
  }

  return {
    categories: Object.fromEntries((await prisma.expenseCategory.findMany()).map(category => [category.name, category])),
    banks: Object.fromEntries((await prisma.bank.findMany()).map(bank => [bank.name, bank])),
    companies: Object.fromEntries((await prisma.company.findMany()).map(company => [company.code, company])),
    paymentMethods: Object.fromEntries((await prisma.paymentMethod.findMany({ where: workspaceId ? { workspaceId } : {} })).map(method => [method.name, method]))
  };
}

async function getOrCreatePaymentMethod(nameRaw: unknown, workspaceId?: number) {
  const name = textValue(nameRaw);
  if (!name) return null;
  const existing = await prisma.paymentMethod.findFirst({
    where: {
      workspaceId: workspaceId ?? null,
      name: { equals: name, mode: 'insensitive' }
    }
  });
  if (existing) return existing;
  return prisma.paymentMethod.create({
    data: {
      workspaceId: workspaceId ?? null,
      name,
      kind: mapPaymentMethodKind(name),
      isFallback: name === fallbackPaymentMethodName
    }
  });
}

async function getOrCreateSupplier(businessNameRaw: unknown, metadata: { alias?: string; email?: string; phone?: string; pec?: string; taxCodeSdi?: string; internalNotes?: string; workspaceId?: number } = {}) {
  const businessName = textValue(businessNameRaw) || 'Senza esercente';
  const data = {
    alias: metadata.alias || null,
    email: metadata.email || null,
    phone: metadata.phone || null,
    pec: metadata.pec || null,
    taxCodeSdi: metadata.taxCodeSdi || null,
    internalNotes: metadata.internalNotes || null
  };
  const existing = await prisma.supplier.findFirst({ where: { businessName, ...(metadata.workspaceId ? { workspaceId: metadata.workspaceId } : {}) } });
  if (existing) {
    const updateData = Object.fromEntries(Object.entries(data).filter(([, value]) => value));
    if (Object.keys(updateData).length) {
      const supplier = await prisma.supplier.update({ where: { id: existing.id }, data: updateData });
      return { supplier, created: false };
    }
    return { supplier: existing, created: false };
  }
  const supplier = await prisma.supplier.create({ data: { businessName, ...data, ...(metadata.workspaceId ? { workspaceId: metadata.workspaceId } : {}) } });
  return { supplier, created: true };
}

function getTabularRows(workbook: XLSX.WorkBook) {
  const result: Array<{ sheetName: string; row: Record<string, unknown> }> = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: null });
    const hasExpectedHeaders = rows.some(row => rowValue(row, ['Data ordine', 'Fornitore', 'Esercente', 'Costo', 'Descrizione']) !== null);
    if (!hasExpectedHeaders) continue;
    for (const row of rows) result.push({ sheetName, row });
  }
  return result;
}

function getRecurringDefinitionRows(workbook: XLSX.WorkBook) {
  const result: Array<{ sheetName: string; row: Record<string, unknown> }> = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: null });
    const hasExpectedHeaders = rows.some(row => rowValue(row, ['Data inizio', 'Fornitore', 'Esercente', 'Importo', 'Cadenza']) !== null);
    if (!hasExpectedHeaders) continue;
    for (const row of rows) result.push({ sheetName, row });
  }
  return result;
}

function parseInteger(value: unknown) {
  const parsed = Math.trunc(parseMoney(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function mapCadence(value: unknown) {
  const text = textValue(value).toLowerCase();
  if (text.includes('2') || text.includes('bimes')) return 'EVERY_2_MONTHS';
  if (text.includes('3') || text.includes('trim')) return 'EVERY_3_MONTHS';
  if (text.includes('6') || text.includes('semes')) return 'EVERY_6_MONTHS';
  if (text.includes('bien')) return 'EVERY_2_YEARS';
  if (text.includes('ann')) return 'YEARLY';
  return 'MONTHLY';
}

function mapBillingPeriodMode(value: unknown) {
  const text = textValue(value).toLowerCase();
  if (text.includes('success')) return 'NEXT_MONTH';
  if (text.includes('custom') || text.includes('impost') || text.includes('specific')) return 'CUSTOM_MONTH';
  return 'SAME_MONTH';
}

function mapAccrualType(value: unknown) {
  const text = textValue(value).toLowerCase();
  return text.includes('auto') ? 'AUTOMATICA' : 'MANUALE';
}

export async function importRecurringExpenseDefinitionsWorkbook(buffer: Buffer, options: { clearBeforeImport?: boolean; workspaceId?: number } = {}): Promise<ExpenseImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const rows = getRecurringDefinitionRows(workbook);
  const sheets = Array.from(new Set(rows.map(item => item.sheetName)));
  let deleted = 0;

  if (options.clearBeforeImport) {
    const deleteResult = await prisma.recurringExpense.deleteMany({ where: options.workspaceId ? { workspaceId: options.workspaceId } : {} });
    deleted = deleteResult.count;
  }

  const refs = await ensureReferenceData(options.workspaceId);
  let imported = 0;
  let skipped = 0;
  let suppliersCreated = 0;

  for (const { row } of rows) {
    const amount = parseMoney(rowValue(row, ['Importo', 'Costo', 'Costo IVA inclusa']));
    const supplierName = rowValue(row, ['Fornitore', 'Esercente']);
    const description = textValue(rowValue(row, ['Descrizione', 'Prodotto/servizio', 'Prodotto / Servizio']));
    const startDate = parseDate(rowValue(row, ['Data inizio', 'Inizio', 'Start date']));
    if (!supplierName && !description && amount <= 0) {
      skipped++;
      continue;
    }
    if (!startDate || amount <= 0) {
      skipped++;
      continue;
    }

    const categoryName = mapCategoryName(rowValue(row, ['Categoria']));
    const category = refs.categories[categoryName] ?? refs.categories['Altri Servizi'];
    const bankName = mapBankName(rowValue(row, ['Banca']));
    const bank = refs.banks[bankName] ?? refs.banks['Altra Banca'];
    const channel = mapChannel(rowValue(row, ['Canale Pagamento', 'Canale']));
    const paymentMethod = channel ? (refs.paymentMethods[channel] ?? await getOrCreatePaymentMethod(channel, options.workspaceId)) : null;
    const vatRate = parseMoney(rowValue(row, ['Aliquota IVA', '% IVA', 'Applicazione IVA', 'IVA']));
    const isDeclared = parseBool(rowValue(row, ['Detrazione', 'Dich.', 'Dichiarazione']));
    const hasElectronicInvoice = parseBool(rowValue(row, ['Fattura elettronica', 'F. Elett.', 'Fattura Elettronica']));
    const cadence = mapCadence(rowValue(row, ['Cadenza', 'Frequenza', 'Ricorrenza']));
    const dueDay = parseInteger(rowValue(row, ['Giorno scadenza', 'Giorno pagamento', 'Scadenza giorno']));
    const dueMonth = parseInteger(rowValue(row, ['Mese scadenza', 'Scadenza mese']));
    const billingPeriodMode = mapBillingPeriodMode(rowValue(row, ['Competenza', 'Periodo fatturazione', 'Modalità periodo fatturazione']));
    const billingMonth = parseInteger(rowValue(row, ['Mese competenza', 'Mese fatturazione']));
    const accrualType = mapAccrualType(rowValue(row, ['Generazione pagamento', 'Tipo generazione', 'Accrual']));
    const notes = textValue(rowValue(row, ['Note', 'Annotazioni', 'Memo']));
    const isActive = rowValue(row, ['Attiva', 'Attivo', 'Active']) === null ? true : parseBool(rowValue(row, ['Attiva', 'Attivo', 'Active']));
    const { supplier, created } = await getOrCreateSupplier(supplierName, {
      alias: textValue(rowValue(row, ['Alias fornitore', 'Alias'])),
      email: textValue(rowValue(row, ['Email fornitore', 'Email'])),
      phone: textValue(rowValue(row, ['Telefono fornitore', 'Telefono', 'Phone'])),
      pec: textValue(rowValue(row, ['PEC fornitore', 'PEC'])),
      taxCodeSdi: textValue(rowValue(row, ['Codice SDI', 'SDI', 'Codice destinatario', 'Codice fiscale/SDI'])),
      internalNotes: textValue(rowValue(row, ['Note fornitore', 'Note interne fornitore'])),
      workspaceId: options.workspaceId
    });
    if (created) suppliersCreated++;

    const existing = await prisma.recurringExpense.findFirst({
      where: {
        supplierId: supplier.id,
        categoryId: category?.id ?? null,
        description: description || null,
        amount,
        cadence,
        startDate
      }
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.recurringExpense.create({
      data: {
        startDate,
        workspaceId: options.workspaceId,
        cadence,
        dueDay,
        dueMonth,
        accrualType,
        billingPeriodMode,
        billingMonth: billingPeriodMode === 'CUSTOM_MONTH' ? billingMonth : null,
        merchant: supplier.businessName,
        supplierId: supplier.id,
        categoryId: category?.id ?? null,
        description: description || null,
        amount,
        vatRate,
        isDeclared,
        hasElectronicInvoice,
        paymentChannel: paymentMethod?.name ?? channel,
        paymentMethodId: paymentMethod?.id ?? null,
        bankId: bank?.id ?? null,
        notes: notes || null,
        isActive
      }
    });
    imported++;
  }

  return { imported, skipped, deleted, suppliersCreated, sheets };
}

export async function importExpensesWorkbook(buffer: Buffer, options: { clearBeforeImport?: boolean; workspaceId?: number } = {}): Promise<ExpenseImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const rows = getTabularRows(workbook);
  const sheets = Array.from(new Set(rows.map(item => item.sheetName)));
  let deleted = 0;

  if (options.clearBeforeImport) {
    const [, , deleteResult] = await prisma.$transaction([
      prisma.expenseAttachment.deleteMany({ where: options.workspaceId ? { expense: { workspaceId: options.workspaceId } } : {} }),
      prisma.expensePayment.deleteMany({ where: options.workspaceId ? { expense: { workspaceId: options.workspaceId } } : {} }),
      prisma.expense.deleteMany({ where: options.workspaceId ? { workspaceId: options.workspaceId } : {} })
    ]);
    deleted = deleteResult.count;
  }

  const refs = await ensureReferenceData(options.workspaceId);
  let imported = 0;
  let skipped = 0;
  let suppliersCreated = 0;

  for (const { row } of rows) {
    const amount = parseMoney(rowValue(row, ['Costo', 'Costo IVA inclusa', 'Importo']));
    const supplierName = rowValue(row, ['Fornitore', 'Esercente']);
    const description = textValue(rowValue(row, ['Descrizione', 'Prodotto/servizio', 'Prodotto / Servizio']));
    const orderDateRaw = parseDate(rowValue(row, ['Data ordine', 'Data Ricez', 'Data ricezione']));
    const dueDateRaw = parseDate(rowValue(row, ['Data scadenza', 'Scadenza']));
    const orderDate = orderDateRaw ?? dueDateRaw;
    if (!supplierName && !description && amount <= 0) {
      skipped++;
      continue;
    }

    const paymentDateRaw = parseDate(rowValue(row, ['Data pagamento', 'Data Pag']));
    const dueDate = dueDateRaw ?? orderDateRaw;
    const effectivePaymentDate = paymentDateRaw ?? dueDate ?? orderDate;
    const vatRate = parseMoney(rowValue(row, ['Aliquota IVA', '% IVA', 'Applicazione IVA', 'IVA']));
    const hasElectronicInvoice = parseBool(rowValue(row, ['Fattura elettronica', 'F. Elett.', 'Fattura Elettronica']));
    const isDeclared = parseBool(rowValue(row, ['Detrazione', 'Dich.', 'Dichiarazione']));
    const mappedInvoiceStatus = mapInvoiceStatus(rowValue(row, ['Stato fattura', 'Fattura']), hasElectronicInvoice);
    const invoiceStatus = !isDeclared ? 'NON_PREVISTA' : (mappedInvoiceStatus === 'NON_PREVISTA' ? 'IN_ATTESA' : mappedInvoiceStatus);
    const categoryName = mapCategoryName(rowValue(row, ['Categoria']));
    const category = refs.categories[categoryName] ?? refs.categories['Altri Servizi'];
    const bankName = mapBankName(rowValue(row, ['Banca']));
    const bank = refs.banks[bankName] ?? refs.banks['Altra Banca'];
    const channel = mapChannel(rowValue(row, ['Canale Pagamento', 'Canale']));
    const paymentMethod = channel ? (refs.paymentMethods[channel] ?? await getOrCreatePaymentMethod(channel, options.workspaceId)) : null;
    const paidBy = mapPaidBy(rowValue(row, ['Pagamento effettuato da', 'Pagato da']));
    const paidCompleted = parseBool(rowValue(row, ['Pagamento completato', 'Compl.', 'Completato']));
    const explicitPaidAmount = parseMoney(rowValue(row, ['Importo pagamento', 'Importo pagato']));
    const paidAmount = paidCompleted ? amount : explicitPaidAmount;
    const paymentStatus: PaymentStatus = paidAmount >= amount && amount > 0 ? 'COMPLETATO' : paidAmount > 0 ? 'PAGATO_PARZIALMENTE' : 'DA_PAGARE';
    const billingDate = parseDate(rowValue(row, ['Periodo fatturazione', 'Mese fatturazione', 'Periodo Fatt.'])) ?? orderDate ?? new Date();
    const companyCode = mapCompanyCode(rowValue(row, ['Società', 'Societa', 'Azienda', 'Company', 'Operatore']));
    const company = refs.companies[companyCode] ?? refs.companies.HM;
    const notes = textValue(rowValue(row, ['Note', 'Annotazioni', 'Memo']));
    const isRecurring = parseBool(rowValue(row, ['Ricorrente', 'Spesa ricorrente', 'Recurring']));
    const isAutomaticPayment = parseBool(rowValue(row, ['Pagamento automatico', 'Automatico', 'Addebito automatico']));
    const { supplier, created } = await getOrCreateSupplier(supplierName, {
      internalNotes: textValue(rowValue(row, ['Note fornitore', 'Note interne fornitore'])),
      workspaceId: options.workspaceId
    });
    if (created) suppliersCreated++;

    await prisma.expense.create({
      data: {
        receivedDate: orderDate,
        workspaceId: options.workspaceId,
        dueDate,
        merchant: supplier.businessName,
        supplierId: supplier.id,
        categoryId: category?.id ?? null,
        description: description || null,
        amount,
        paymentDate: paymentStatus === 'DA_PAGARE' ? null : effectivePaymentDate,
        vatRate,
        channel,
        bankId: bank?.id ?? null,
        isComplete: paymentStatus === 'COMPLETATO',
        isDeclared,
        hasElectronicInvoice,
        isRecurring,
        isAutomaticPayment,
        invoiceStatus,
        companyId: company?.id ?? null,
        notes: notes || null,
        paidByCurrentAccount: paidBy === 'HERBAL_MARKET',
        paymentStatus,
        paidAmount,
        paidBy,
        month: billingDate.getMonth() + 1,
        year: billingDate.getFullYear(),
        payments: paidAmount > 0 ? { create: [{ paymentDate: effectivePaymentDate, channel: paymentMethod?.name ?? channel, paymentMethodId: paymentMethod?.id ?? null, bankId: bank?.id ?? null, amount: paidAmount, paidBy }] } : undefined
      }
    });
    imported++;
  }

  return { imported, skipped, deleted, suppliersCreated, sheets };
}
