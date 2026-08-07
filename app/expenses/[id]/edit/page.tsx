import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ExpenseForm from '@/components/ExpenseForm';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderExpenseCategories, orderPaymentMethods } from '@/lib/workspace-defaults';

export default async function EditExpensePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/expenses');
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : `/expenses/${id}`;
  const encodedReturnTo = encodeURIComponent(returnTo);
  const [expense, categories, banks, paymentMethods, suppliers] = await Promise.all([
    prisma.expense.findFirst({ where: { id: Number(id), workspaceId: current.workspace.id, companyId: current.company.id }, include: { payments: { orderBy: { id: 'asc' } }, supplier: true } }),
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  if (!expense) notFound();

  const orderedBanks = orderBanks(banks);
  const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');

  const orderedCategories = orderExpenseCategories(categories);

  return <div className="grid edit-expense-dedicated-page page-no-site-header">
    <ExpenseForm
          title="Modifica spesa"
          cancelHref={returnTo}
          submitLabel="Salva modifiche"
          action={`/api/expenses/${expense.id}?returnTo=${encodedReturnTo}`}
          categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name, icon: c.icon, isVatSettlementDefault: c.id === current.workspace.vatSettlementCategoryId }))}
          banks={orderedBanks.map(b => ({ id: b.id, name: b.name, icon: b.icon, isFallback: b.isFallback, isPrimary: b.id === current.company.primaryBankId }))}
          paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, icon: method.icon, kind: method.kind, isFallback: method.isFallback, systemRole: method.systemRole }))}
          suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, vatNumber: s.vatNumber, iban: s.iban, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes, defaultExpenseCategoryId: s.defaultExpenseCategoryId, defaultVatRate: s.defaultVatRate?.toString() ?? null, systemRole: s.systemRole }))}
          initialExpense={{
            id: expense.id,
            expenseType: expense.expenseType,
            receivedDate: expense.receivedDate,
            dueDate: expense.dueDate,
            merchant: expense.merchant,
            supplierId: expense.supplierId,
            categoryId: expense.categoryId,
            description: expense.description,
            amount: expense.amount.toString(),
            vatRate: expense.vatRate.toString(),
            paymentStatus: expense.paymentStatus,
            month: expense.month,
            year: expense.year,
            hasElectronicInvoice: expense.hasElectronicInvoice,
            invoiceStatus: expense.invoiceStatus,
            isDeclared: expense.isDeclared,
            isRecurring: expense.isRecurring,
            notes: expense.notes,
            payments: expense.payments.map(payment => ({
              id: payment.id,
              paymentDate: payment.paymentDate,
              paymentMethodId: payment.paymentMethodId,
              bankId: payment.bankId,
              amount: payment.amount.toString()
            }))
          }}
        />
  </div>;
}
