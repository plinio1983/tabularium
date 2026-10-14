import {searchExportCsv} from '@/lib/search-export';
import {expensesCsv, incomesCsv, expensesCsvInclude, incomesCsvInclude} from '@/lib/record-csv-export';
import {ledgerFilters, type LedgerParams} from '@/lib/movement-ledger';
import {loadMovementLedgerExport} from '@/lib/movement-ledger-data';
import {ledgerExportLimit, movementLedgerCsv} from '@/lib/movement-ledger-export';
import {dateInputInTimeZone} from '@/lib/company-time';
import {filteredListHref} from '@/lib/live-search';
import {appendFlash} from '@/lib/flash';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { createCsv, csvDownload } from '@/lib/csv-export';
import {exportReceiptCsv, parseReceiptCsv, receiptCsvLimit} from '@/lib/receipt-csv';
import {receiptInclude, receiptToCsvRow} from '@/lib/receipt-import';

const supportedEntities = ['incomes', 'expenses', 'suppliers', 'clients', 'recurring-expenses', 'receipts'] as const;
type ExportEntity = typeof supportedEntities[number];

function selectedIds(formData: FormData) {
  return [...new Set(
    formData.getAll('ids')
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value > 0)
  )];
}

function filename(entity: ExportEntity) {
  return `${entity}-${new Date().toISOString().slice(0, 10)}.csv`;
}

function decimal(value: { toString(): string } | null | undefined) {
  return value?.toString().replace('.', ',') ?? '';
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { entity: rawEntity } = await params;
  if (!supportedEntities.includes(rawEntity as ExportEntity)) {
    return NextResponse.json({ error: 'Esportazione non supportata' }, { status: 404 });
  }
  const entity = rawEntity as ExportEntity;
  const ids = selectedIds(await request.formData());
  if (!ids.length) return NextResponse.json({ error: 'Seleziona almeno un record' }, { status: 400 });
  if (ids.length > (entity === 'receipts' ? receiptCsvLimit : 5000)) return NextResponse.json({error: `Seleziona al massimo ${entity === 'receipts' ? receiptCsvLimit : 5000} record.`}, {status: 400});
  const workspaceId = access.current.workspace.id;
  const companyId = access.current.company.id;

  if (entity === 'receipts') {
    const records = await prisma.income.findMany({where: {id: {in: ids}, workspaceId, companyId, incomeType: 'CASH_REGISTER'}, include: receiptInclude, orderBy: [{creditDate: 'desc'}, {id: 'desc'}]});
    if (records.length !== ids.length) return NextResponse.json({error: 'Uno o più scontrini selezionati non sono disponibili nella società corrente.'}, {status: 404});
    try {
      const csv = exportReceiptCsv(records.map(receiptToCsvRow));
      const parsed = parseReceiptCsv(csv);
      const invalidIndex = parsed.findIndex(row => row.error);
      if (invalidIndex !== -1) throw new Error(`Scontrino #${records[invalidIndex].id}: ${parsed[invalidIndex].error}`);
      return csvDownload(csv, filename(entity));
    }
    catch (error) {return NextResponse.json({error: error instanceof Error ? error.message : 'Esportazione non completata'}, {status: 409});}
  }

  if (entity === 'incomes') {
    const records = await prisma.income.findMany({
      where: { id: { in: ids }, workspaceId, companyId },
      include: incomesCsvInclude,
      orderBy: [{ orderDate: 'desc' }, { id: 'desc' }]
    });
    const csv = incomesCsv(records);
    return csvDownload(csv, filename(entity));
  }

  if (entity === 'expenses') {
    const records = await prisma.expense.findMany({
      where: { id: { in: ids }, workspaceId, companyId },
      include: expensesCsvInclude,
      orderBy: [{ receivedDate: 'desc' }, { id: 'desc' }]
    });
    const csv = expensesCsv(records);
    return csvDownload(csv, filename(entity));
  }

  if (entity === 'suppliers') {
    const records = await prisma.supplier.findMany({
      where: { id: { in: ids }, workspaceId },
      include: { defaultExpenseCategory: true },
      orderBy: { businessName: 'asc' }
    });
    const csv = createCsv(
      ['ID', 'Ragione sociale', 'Alias', 'Email', 'P.IVA', 'Codice SDI/Fiscale', 'PEC', 'IBAN', 'Categoria predefinita', 'Aliquota IVA predefinita', 'Note interne'],
      records.map(record => [
        record.id, record.businessName, record.alias, record.email, record.vatNumber, record.taxCodeSdi,
        record.pec, record.iban, record.defaultExpenseCategory?.name,
        record.defaultVatRate == null ? null : `${record.defaultVatRate.toString()}%`, record.internalNotes
      ])
    );
    return csvDownload(csv, filename(entity));
  }

  if (entity === 'clients') {
    const records = await prisma.customer.findMany({
      where: { id: { in: ids }, workspaceId },
      include: {defaultSalesChannel: true},
      orderBy: { businessName: 'asc' }
    });
    const csv = createCsv(
      ['ID', 'Ragione sociale', 'Alias', 'Email', 'P.IVA', 'Codice SDI/Fiscale', 'PEC', 'IBAN', 'SWIFT', 'Canale di vendita predefinito', 'Note interne'],
      records.map(record => [
        record.id, record.businessName, record.alias, record.email, record.vatNumber, record.taxCodeSdi,
        record.pec, record.iban, record.swift, record.defaultSalesChannel?.name, record.internalNotes
      ])
    );
    return csvDownload(csv, filename(entity));
  }

  const records = await prisma.recurringExpense.findMany({
    where: { id: { in: ids }, workspaceId, companyId },
    include: { supplier: true, category: true, paymentMethod: true, bank: true },
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }]
  });
  const csv = createCsv(
    ['ID', 'Data inizio', 'Cadenza', 'Giorno scadenza', 'Mese scadenza', 'Generazione spesa', 'Fornitore', 'Descrizione', 'Categoria', 'Importo', 'IVA %', 'Fiscale', 'Fattura elettronica', 'Periodo fatturazione', 'Pagamento automatico', 'Metodo pagamento', 'Banca', 'Attiva', 'Note'],
    records.map(record => [
      record.id, record.startDate, record.cadence, record.dueDay, record.dueMonth, record.generationTiming, record.supplier?.businessName ?? record.merchant,
      record.description, record.category?.name, decimal(record.amount), decimal(record.vatRate), record.isDeclared,
      record.hasElectronicInvoice, record.billingPeriodMode, record.isAutomaticPayment, record.paymentMethod?.name,
      record.bank?.name, record.isActive, record.notes
    ])
  );
  return csvDownload(csv, filename(entity));
}

export async function GET(request: Request, {params}: {params: Promise<{entity: string}>}) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const {entity} = await params;
  if (entity === 'expenses' || entity === 'incomes') {
    const url = new URL(request.url);
    const query = Object.fromEntries([...url.searchParams.keys()].map(key => [key, url.searchParams.getAll(key)]));
    const returnHref = filteredListHref(`/${entity}`, query);
    const errorResponse = (error: string) => NextResponse.redirect(new URL(appendFlash(returnHref, {error}), request.url), 303);
    const {workspace, company} = access.current;
    try {
      const result = await searchExportCsv(entity, workspace.id, company.id, company.timeZone, url.searchParams);
      if (!result.count) return errorResponse('export_empty');
      return csvDownload(result.csv, `${entity}-${dateInputInTimeZone(company.timeZone)}.csv`);
    } catch {
      return errorResponse('export_failed');
    }
  }
  if (entity !== 'payments' && entity !== 'credits') return NextResponse.json({error: 'Esportazione non supportata'}, {status: 404});
  const url = new URL(request.url);
  const query: LedgerParams = {};
  for (const key of url.searchParams.keys()) query[key] = url.searchParams.getAll(key);
  const exportFrom = url.searchParams.get('exportFrom');
  const exportTo = url.searchParams.get('exportTo');
  delete query.exportFrom;
  delete query.exportTo;
  const path = entity === 'payments' ? '/expenses/payments' : '/incomes/credits';
  const errorResponse = (error: string) => NextResponse.redirect(new URL(appendFlash(filteredListHref(path, query), {error}), request.url), 303);
  const {workspace, company} = access.current;
  const today = dateInputInTimeZone(company.timeZone);
  const filters = ledgerFilters({...query, ...(exportFrom && exportTo ? {dateFrom: exportFrom, dateTo: exportTo} : {})}, today);
  try {
    const rows = await loadMovementLedgerExport(prisma, entity, workspace.id, company.id, company.timeZone, filters, ledgerExportLimit);
    if (rows.length > ledgerExportLimit) return errorResponse('export_limit');
    if (!rows.length) return errorResponse('export_empty');
    return csvDownload(movementLedgerCsv(entity, rows, company.timeZone), `${entity === 'payments' ? 'pagamenti' : 'accrediti'}-${today}.csv`);
  } catch {
    return errorResponse('export_failed');
  }
}
