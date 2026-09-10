import {createHash} from 'node:crypto';
import {Prisma} from '@/generated/prisma/client';
import {parseReceiptCsv, receiptImportKey, receiptOrigin, type ReceiptCsvRow} from './receipt-csv';

export const receiptInclude = {salesChannelRef: true, paymentMethodRef: true, creditBank: true, credits: true} satisfies Prisma.IncomeInclude;
type Receipt = Prisma.IncomeGetPayload<{include: typeof receiptInclude}>;
export function receiptToCsvRow(item: Receipt): ReceiptCsvRow {
  const credit = item.credits[0];
  if (!item.isCredited || item.credits.length !== 1 || !credit.amount.equals(item.amount) || credit.creditDate.getTime() !== item.creditDate.getTime() || credit.bankId !== item.creditBankId || credit.paymentMethodId !== item.paymentMethodId) throw new Error(`Scontrino #${item.id}: accredito non coerente. Verifica il dettaglio prima di esportare.`);
  return {
    origin: receiptOrigin(item), date: item.creditDate.toISOString(), description: item.description ?? '', amount: item.amount.toFixed(2),
    fiscal: item.isFiscal, vat: item.vatRate.toString(), channelCode: item.salesChannelRef.code, channel: item.salesChannelRef.name,
    method: item.paymentMethodRef.name, bank: item.creditBank.name, period: `${item.billingYear}-${String(item.billingMonth).padStart(2, '0')}`, notes: item.notes ?? '',
  };
}
export type ReceiptImportContext = {workspaceId: number; companyId: number};
type Prepared = ReceiptCsvRow & {channelId: number; methodId: number; bankId: number; categoryId: number; customerId: number};
export type ReceiptPreviewRow = {line: number; origin: string; description: string; amount: string; status: 'new' | 'duplicate' | 'conflict' | 'invalid'; message: string};
export type ReceiptPreview = {rows: ReceiptPreviewRow[]; counts: Record<ReceiptPreviewRow['status'], number>; token: string};
const identity = (value: string) => value.trim().toLocaleLowerCase('it-IT');
function comparable(row: Prepared) {
  return JSON.stringify([row.date, row.description, row.amount, row.fiscal, row.vat, row.channelId, row.methodId, row.bankId, row.period, row.notes]);
}

export async function prepareReceiptImport(db: Prisma.TransactionClient, text: string, context: ReceiptImportContext) {
  const parsed = parseReceiptCsv(text);
  const {workspaceId, companyId} = context;
  const [channels, methods, banks, categories, customer] = await Promise.all([
    db.incomeSalesChannel.findMany({where: {workspaceId}}),
    db.paymentMethod.findMany({where: {workspaceId}}),
    db.bank.findMany({where: {workspaceId}}),
    db.incomeCategory.findMany({where: {workspaceId}, orderBy: {id: 'asc'}}),
    db.customer.findFirst({where: {workspaceId, systemRole: 'CASH_REGISTER'}}),
  ]);
  const category = categories.find(item => item.code === 'DEFAULT') ?? categories.find(item => item.code === 'B2C') ?? categories[0];
  const origins = parsed.flatMap(item => item.row ? [item.row.origin] : []);
  const keys = origins.flatMap(origin => [receiptImportKey(companyId, origin), ...(origin.startsWith('request:') ? [origin.slice(8)] : [])]);
  const legacyIds = origins.flatMap(origin => {
    const match = origin.match(/^legacy:(\d+):(\d+):(\d+)$/);
    return match && Number(match[1]) === workspaceId && Number(match[2]) === companyId ? [Number(match[3])] : [];
  });
  const existing = await db.income.findMany({where: {workspaceId, companyId, OR: [{cashRegisterRequestId: {in: keys}}, {id: {in: legacyIds}}]}, include: receiptInclude});
  const existingByOrigin = new Map(existing.map(item => [receiptOrigin(item), item]));
  const counts = {new: 0, duplicate: 0, conflict: 0, invalid: 0};
  const pending = new Map<string, Prepared>();
  const rows: ReceiptPreviewRow[] = [];
  const resolve = <T extends {name: string}>(items: T[], name: string, label: string) => {
    const matches = items.filter(item => identity(item.name) === identity(name));
    if (matches.length !== 1) throw new Error(`${label} non trovato o ambiguo: ${name}. Configuralo prima di importare.`);
    return matches[0];
  };
  for (const input of parsed) {
    const row = input.row;
    let status: ReceiptPreviewRow['status'] = 'new', message = 'Da importare';
    try {
      if (!row) throw new Error(input.error);
      if (!category || !customer) throw new Error('Completa la configurazione del registratore di cassa prima di importare.');
      const channel = row.channelCode ? channels.find(item => item.code === row.channelCode) : resolve(channels, row.channel, 'Canale');
      if (!channel) throw new Error(`Codice canale non trovato: ${row.channelCode}.`);
      if (row.channel && identity(row.channel) !== identity(channel.name)) throw new Error('Codice e nome del canale non corrispondono.');
      const method = resolve(methods, row.method, 'Metodo');
      if (!method.cashRegisterEnabled || !['INCOME', 'BOTH'].includes(method.kind)) throw new Error('Metodo non abilitato per il registratore di cassa.');
      if (!row.fiscal && method.systemRole !== 'CASH') throw new Error('Gli scontrini non fiscali richiedono il metodo contanti.');
      const bank = resolve(banks, row.bank, 'Banca');
      const prepared: Prepared = {...row, channelId: channel.id, methodId: method.id, bankId: bank.id, categoryId: category.id, customerId: customer.id};
      const previous = pending.get(row.origin), stored = existingByOrigin.get(row.origin);
      if (previous || stored) {
        let same = previous ? comparable(previous) === comparable(prepared) : false;
        if (stored?.incomeType === 'CASH_REGISTER') {
          try {same = comparable({...receiptToCsvRow(stored), channelId: stored.salesChannelId, methodId: stored.paymentMethodId, bankId: stored.creditBankId, categoryId: stored.incomeCategoryId, customerId: stored.customerId ?? 0}) === comparable(prepared);}
          catch {same = false;}
        }
        status = same ? 'duplicate' : 'conflict';
        message = same ? 'Già presente: sarà ignorato' : 'Identificativo già presente con dati diversi: nessuna sovrascrittura';
      } else pending.set(row.origin, prepared);
    } catch (error) {status = 'invalid'; message = error instanceof Error ? error.message : 'Riga non valida';}
    counts[status]++;
    rows.push({line: input.line, origin: row?.origin ?? '', description: row?.description ?? '', amount: row?.amount ?? '', status, message});
  }
  const token = createHash('sha256').update(JSON.stringify({context, rows, pending: [...pending.values()]})).digest('hex');
  return {preview: {rows, counts, token} satisfies ReceiptPreview, pending: [...pending.values()]};
}

export async function commitReceiptImport(db: Prisma.TransactionClient, text: string, context: ReceiptImportContext, token: string) {
  const plan = await prepareReceiptImport(db, text, context);
  if (plan.preview.token !== token) throw new Error('Anteprima cambiata: analizza nuovamente il file prima di importare.');
  if (plan.preview.counts.invalid || plan.preview.counts.conflict) throw new Error('Correggi errori e conflitti nel file prima di importare.');
  for (const row of plan.pending) {
    const date = new Date(row.date);
    await db.income.create({data: {
      ...context, incomeType: 'CASH_REGISTER', cashRegisterRequestId: receiptImportKey(context.companyId, row.origin),
      customerId: row.customerId, incomeCategoryId: row.categoryId, salesChannelId: row.channelId,
      paymentMethodId: row.methodId, creditBankId: row.bankId, description: row.description || null, notes: row.notes || null,
      amount: row.amount, vatRate: row.vat, isFiscal: row.fiscal, invoiceStatus: row.fiscal ? 'EMESSA' : null,
      creditDate: date, orderDate: date, isCredited: true, billingYear: Number(row.period.slice(0, 4)), billingMonth: Number(row.period.slice(5)),
      credits: {create: {amount: row.amount, creditDate: date, paymentMethodId: row.methodId, bankId: row.bankId}},
    }});
  }
  return {imported: plan.pending.length, duplicates: plan.preview.counts.duplicate};
}
