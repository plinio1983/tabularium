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
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/expenses';
  const encodedReturnTo = encodeURIComponent(returnTo);
  const copyId = copyIdValue ? Number(copyIdValue) : null;

  const [copyExpense, categories, banks, paymentMethods, suppliers] = await Promise.all([
    copyId ? prisma.expense.findFirst({ where: { id: copyId, workspaceId: current.workspace.id }, include: { supplier: true } }) : null,
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
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
      <Link className="table-action secondary" href={returnTo}>× Annulla</Link>
    </div>
    <ExpenseCreationSwitcher
      categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name, icon: c.icon }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name, isFallback: b.isFallback }))}
      paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback }))}
      suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, phone: s.phone, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes }))}
      expenseAction={`/api/expenses?returnTo=${encodedReturnTo}`}
      recurringAction={`/api/recurring-expenses?returnTo=${encodedReturnTo}`}
      title={copyExpense ? 'Nuova spesa da copia' : 'Nuova spesa'}
      cancelHref={returnTo}
      submitLabel={copyExpense ? 'Salve spesa copiata' : 'Salva spesa'}
      initialExpense={copyExpense ? {
        receivedDate: clampDateToToday(copyExpense.receivedDate),
        dueDate: copyExpense.dueDate,
        supplierId: copyExpense.supplierId,
        merchant: copyExpense.merchant,
        categoryId: copyExpense.categoryId,
        description: copyExpense.description,
        amount: copyExpense.amount.toString(),
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
