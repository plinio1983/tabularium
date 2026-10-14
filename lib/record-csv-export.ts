import {existingReceiptLines} from './cash-register-lines';
import type {Prisma} from '@/generated/prisma/client';
import {createCsv} from './csv-export';

export const incomesCsvInclude = { receiptLines: {orderBy: {position: 'asc'}}, customer: true, salesChannelRef: true, paymentMethodRef: true, creditBank: true, credits: {include: {paymentMethod: true, bank: true}, orderBy: {creditDate: 'asc'}} } as const satisfies Prisma.IncomeInclude;

type IncomeCsvRecord = Prisma.IncomeGetPayload<{include: typeof incomesCsvInclude}>;

export function incomesCsv(records: IncomeCsvRecord[]) {
    return createCsv(
      ['ID', 'Data ordine', 'Data scadenza', 'Data ultimo accredito', 'Periodo contabile', 'Cliente', 'Descrizione', 'Canale di vendita', 'Importo', 'IVA %', 'Fiscale', 'Stato fattura', 'Accreditato', 'Totale accreditato', 'Residuo', 'Accrediti', 'Tipo', 'Note', 'Importi scontrino (JSON)'],
      records.map(record => [
        record.id, record.orderDate, record.dueDate, record.creditDate, `${record.billingYear}-${String(record.billingMonth).padStart(2, '0')}`,
        record.customer?.businessName, record.description, record.salesChannelRef.name,
        decimal(record.amount), decimal(record.vatRate), record.isFiscal, record.invoiceStatus, record.isCredited,
        record.credits.reduce((sum, credit) => sum + Number(credit.amount), 0),
        Math.max(0, Number(record.amount) - record.credits.reduce((sum, credit) => sum + Number(credit.amount), 0)),
        record.credits.map(credit => [credit.creditDate.toISOString().slice(0, 10), credit.paymentMethod.name, credit.bank.name, decimal(credit.amount)].join(' | ')).join(' ; '),
        record.incomeType, record.notes, record.incomeType === 'CASH_REGISTER' ? JSON.stringify(existingReceiptLines(record)) : ''
      ])
    );
}

export const expensesCsvInclude = {
        supplier: true,
        employee: true,
        category: true,
        payments: { include: { paymentMethod: true, bank: true }, orderBy: { paymentDate: 'asc' } }
      } as const satisfies Prisma.ExpenseInclude;

type ExpenseCsvRecord = Prisma.ExpenseGetPayload<{include: typeof expensesCsvInclude}>;

export function expensesCsv(records: ExpenseCsvRecord[]) {
    return createCsv(
      ['ID', 'Data riferimento', 'Data scadenza', 'Periodo contabile', 'Periodo lavorato dal', 'Periodo lavorato al', 'Fornitore/Dipendente', 'Matricola dipendente', 'Descrizione', 'Categoria', 'Importo', 'Netto cedolino', 'Compensi extra', 'Lordo cedolino', 'Costo aziendale', 'IVA %', 'Fiscale', 'Fattura elettronica', 'Stato fattura', 'Stato pagamento', 'Importo pagato', 'Pagamenti', 'Tipo', 'Ricorrente', 'Note'],
      records.map(record => [
        record.id, record.receivedDate, record.dueDate, `${record.year}-${String(record.month).padStart(2, '0')}`, record.payrollPeriodStart, record.payrollPeriodEnd,
        record.supplier?.businessName ?? (record.employee ? `${record.employee.lastName} ${record.employee.firstName}` : record.merchant), record.employee?.employeeCode, record.description, record.category?.name, decimal(record.amount), decimal(record.payrollNetAmount), decimal(record.payrollExtraCompensation), decimal(record.payrollGrossAmount), decimal(record.payrollEmployerCost), decimal(record.vatRate),
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
}

function decimal(value: {toString(): string} | null | undefined) {
  return value?.toString().replace('.', ',') ?? '';
}
