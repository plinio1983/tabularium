import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { createCsv, csvDownload } from '@/lib/csv-export';

const supportedEntities = ['incomes', 'expenses', 'suppliers', 'clients', 'recurring-expenses'] as const;
type ExportEntity = typeof supportedEntities[number];

function selectedIds(formData: FormData) {
  return [...new Set(
    formData.getAll('ids')
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value > 0)
  )].slice(0, 5000);
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
  const workspaceId = access.current.workspace.id;
  const companyId = access.current.company.id;

  if (entity === 'incomes') {
    const records = await prisma.income.findMany({
      where: { id: { in: ids }, workspaceId, companyId },
      include: { customer: true, salesChannelRef: true, incomeCategory: true, paymentMethodRef: true, creditBank: true },
      orderBy: [{ orderDate: 'desc' }, { id: 'desc' }]
    });
    const csv = createCsv(
      ['ID', 'Data ordine', 'Data accredito', 'Periodo contabile', 'Cliente', 'Descrizione', 'Canale di vendita', 'Categoria', 'Importo', 'IVA %', 'Fiscale', 'Stato fattura', 'Accreditato', 'Metodo pagamento', 'Banca', 'Tipo', 'Note'],
      records.map(record => [
        record.id, record.orderDate, record.creditDate, `${record.billingYear}-${String(record.billingMonth).padStart(2, '0')}`,
        record.customer?.businessName, record.description, record.salesChannelRef.name, record.incomeCategory.name,
        decimal(record.amount), decimal(record.vatRate), record.isFiscal, record.invoiceStatus, record.isCredited,
        record.paymentMethodRef.name, record.creditBank.name, record.incomeType, record.notes
      ])
    );
    return csvDownload(csv, filename(entity));
  }

  if (entity === 'expenses') {
    const records = await prisma.expense.findMany({
      where: { id: { in: ids }, workspaceId, companyId },
      include: {
        supplier: true,
        category: true,
        payments: { include: { paymentMethod: true, bank: true }, orderBy: { paymentDate: 'asc' } }
      },
      orderBy: [{ receivedDate: 'desc' }, { id: 'desc' }]
    });
    const csv = createCsv(
      ['ID', 'Data ordine', 'Data scadenza', 'Periodo contabile', 'Fornitore', 'Descrizione', 'Categoria', 'Importo', 'IVA %', 'Fiscale', 'Fattura elettronica', 'Stato fattura', 'Stato pagamento', 'Importo pagato', 'Pagamenti', 'Tipo', 'Ricorrente', 'Note'],
      records.map(record => [
        record.id, record.receivedDate, record.dueDate, `${record.year}-${String(record.month).padStart(2, '0')}`,
        record.supplier.businessName, record.description, record.category?.name, decimal(record.amount), decimal(record.vatRate),
        record.isDeclared, record.hasElectronicInvoice, record.invoiceStatus, record.paymentStatus, decimal(record.paidAmount),
        record.payments.map(payment => [
          payment.paymentDate?.toISOString().slice(0, 10) ?? '',
          payment.paymentMethod.name,
          payment.bank?.name ?? '',
          decimal(payment.amount)
        ].join(' | ')).join(' / '),
        record.expenseType, record.isRecurring, record.notes
      ])
    );
    return csvDownload(csv, filename(entity));
  }

  if (entity === 'suppliers') {
    const records = await prisma.supplier.findMany({
      where: { id: { in: ids }, workspaceId },
      include: { defaultExpenseCategory: true },
      orderBy: { businessName: 'asc' }
    });
    const csv = createCsv(
      ['ID', 'Ragione sociale', 'Alias', 'Email', 'P.IVA', 'Codice SDI/Fiscale', 'PEC', 'IBAN', 'Categoria predefinita', 'Note interne'],
      records.map(record => [
        record.id, record.businessName, record.alias, record.email, record.vatNumber, record.taxCodeSdi,
        record.pec, record.iban, record.defaultExpenseCategory?.name, record.internalNotes
      ])
    );
    return csvDownload(csv, filename(entity));
  }

  if (entity === 'clients') {
    const records = await prisma.customer.findMany({
      where: { id: { in: ids }, workspaceId },
      orderBy: { businessName: 'asc' }
    });
    const csv = createCsv(
      ['ID', 'Ragione sociale', 'Alias', 'Email', 'P.IVA', 'Codice SDI/Fiscale', 'PEC', 'IBAN', 'SWIFT', 'Note interne'],
      records.map(record => [
        record.id, record.businessName, record.alias, record.email, record.vatNumber, record.taxCodeSdi,
        record.pec, record.iban, record.swift, record.internalNotes
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
    ['ID', 'Data inizio', 'Cadenza', 'Giorno scadenza', 'Mese scadenza', 'Fornitore', 'Descrizione', 'Categoria', 'Importo', 'IVA %', 'Fiscale', 'Fattura elettronica', 'Periodo fatturazione', 'Pagamento automatico', 'Metodo pagamento', 'Banca', 'Attiva', 'Note'],
    records.map(record => [
      record.id, record.startDate, record.cadence, record.dueDay, record.dueMonth, record.supplier?.businessName ?? record.merchant,
      record.description, record.category?.name, decimal(record.amount), decimal(record.vatRate), record.isDeclared,
      record.hasElectronicInvoice, record.billingPeriodMode, record.isAutomaticPayment, record.paymentMethod?.name,
      record.bank?.name, record.isActive, record.notes
    ])
  );
  return csvDownload(csv, filename(entity));
}
