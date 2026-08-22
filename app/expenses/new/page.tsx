import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ExpenseCreationSwitcher from '@/components/ExpenseCreationSwitcher';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderExpenseCategories, orderPaymentMethods } from '@/lib/workspace-defaults';
import { clampDateToToday, clampPeriodToCurrentMonth } from '@/lib/copy-dates';

export default async function NewExpensePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/expenses/new');
  const params = (await searchParams) ?? {};
  const copyIdValue = Array.isArray(params.copyId) ? params.copyId[0] : params.copyId;
  const requestedTypeValue = Array.isArray(params.type) ? params.type[0] : params.type;
  const requestedType = requestedTypeValue === 'recurring' || requestedTypeValue === 'vat' || requestedTypeValue === 'tax' || requestedTypeValue === 'payroll'
    ? requestedTypeValue
    : 'single';
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/expenses';
  const encodedReturnTo = encodeURIComponent(returnTo);
  const copyId = copyIdValue ? Number(copyIdValue) : null;

  const [copyExpense, categories, banks, paymentMethods, suppliers, employees] = await Promise.all([
    copyId ? prisma.expense.findFirst({ where: { id: copyId, workspaceId: current.workspace.id, companyId: current.company.id }, include: { supplier: true } }) : null,
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 }),
    prisma.employee.findMany({where: {workspaceId: current.workspace.id, companyId: current.company.id}, orderBy: [{lastName: 'asc'}, {firstName: 'asc'}]})
  ]);

  const orderedBanks = orderBanks(banks);
  const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');
  const orderedCategories = orderExpenseCategories(categories);
  const copyBillingPeriod = copyExpense ? clampPeriodToCurrentMonth(copyExpense.month, copyExpense.year) : null;

  return <div className="modal-page-wrap">
    <div className="modal-card modal-card-wide modal-page-card">
    <div className="toolbar-card modal-toolbar-card">
      <div>
        <h2>{copyExpense ? `Copia spesa #${copyExpense.id}` : 'Nuova spesa'}</h2>
        <p className="muted">{copyExpense ? 'I dati sono precompilati, pagamenti e stato pagamento restano azzerati.' : 'Inserisci una nuova spesa.'}</p>
      </div>
      <Link className="btn btn-sm btn-default" href={returnTo}><span className="btn-icon">×</span> Annulla</Link>
    </div>
    <ExpenseCreationSwitcher
      categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name, icon: c.icon, isVatSettlementDefault: c.id === current.workspace.vatSettlementCategoryId }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name, icon: b.icon, isFallback: b.isFallback, isPrimary: b.id === current.company.primaryBankId }))}
      paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, icon: method.icon, kind: method.kind, isFallback: method.isFallback, systemRole: method.systemRole }))}
      suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, vatNumber: s.vatNumber, iban: s.iban, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes, defaultExpenseCategoryId: s.defaultExpenseCategoryId, defaultVatRate: s.defaultVatRate?.toString() ?? null, systemRole: s.systemRole }))}
      employees={employees.map(employee => ({id: employee.id, firstName: employee.firstName, lastName: employee.lastName, employeeCode: employee.employeeCode, status: employee.status}))}
      expenseAction={`/api/expenses?returnTo=${encodedReturnTo}`}
      recurringAction={`/api/recurring-expenses?returnTo=${encodedReturnTo}`}
      initialType={copyExpense ? (copyExpense.expenseType === 'VAT_SETTLEMENT' ? 'vat' : copyExpense.expenseType === 'TAX_CONTRIBUTION' ? 'tax' : copyExpense.expenseType === 'PAYROLL' ? 'payroll' : 'single') : requestedType}
      skipTypeStep={Boolean(copyExpense || requestedTypeValue)}
      title={copyExpense ? 'Nuova spesa da copia' : 'Nuova spesa'}
      cancelHref={returnTo}
      submitLabel={copyExpense ? 'Salve spesa copiata' : 'Salva spesa'}
      initialExpense={copyExpense ? {
        receivedDate: clampDateToToday(copyExpense.receivedDate),
        dueDate: copyExpense.dueDate,
        supplierId: copyExpense.supplierId,
        taxAuthorityId: copyExpense.taxAuthorityId,
        employeeId: copyExpense.employeeId,
        merchant: copyExpense.merchant,
        categoryId: copyExpense.categoryId,
        description: copyExpense.description,
        amount: copyExpense.amount.toString(),
        payrollNetAmount: copyExpense.payrollNetAmount?.toString(),
        payrollExtraCompensation: copyExpense.payrollExtraCompensation?.toString(),
        payrollGrossAmount: copyExpense.payrollGrossAmount?.toString(),
        payrollEmployerCost: copyExpense.payrollEmployerCost?.toString(),
        expenseType: copyExpense.expenseType,
        vatRate: copyExpense.vatRate.toString(),
        paymentStatus: 'DA_PAGARE',
        month: copyBillingPeriod?.month,
        year: copyBillingPeriod?.year,
        hasElectronicInvoice: copyExpense.hasElectronicInvoice,
        invoiceStatus: copyExpense.invoiceStatus,
        isDeclared: copyExpense.isDeclared,
        notes: copyExpense.notes,
        payments: []
      } : undefined}
    />
    </div>
  </div>;
}
