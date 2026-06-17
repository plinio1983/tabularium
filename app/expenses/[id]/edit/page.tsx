import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ExpenseForm from '@/components/ExpenseForm';
import { requireWorkspace } from '@/lib/auth';

const allowedBankOrder = ['MyTu', 'Unicredit', 'Wise', 'Altra Banca'];
const allowedCategoryOrder = [
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

export default async function EditExpensePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/expenses');
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : `/expenses/${id}`;
  const encodedReturnTo = encodeURIComponent(returnTo);
  const [expense, categories, banks, suppliers] = await Promise.all([
    prisma.expense.findFirst({ where: { id: Number(id), workspaceId: current.workspace.id }, include: { payments: { orderBy: { id: 'asc' } }, supplier: true } }),
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  if (!expense) notFound();

  const orderedBanks = allowedBankOrder
    .map(name => banks.find(bank => bank.name === name))
    .filter(Boolean) as typeof banks;

  const orderedCategories = allowedCategoryOrder
    .map(name => categories.find(category => category.name === name))
    .filter(Boolean) as typeof categories;

  return <div className="grid edit-expense-dedicated-page page-no-site-header">
    <ExpenseForm
          title="Modifica spesa"
          cancelHref={returnTo}
          submitLabel="Salva modifiche"
          action={`/api/expenses/${expense.id}?returnTo=${encodedReturnTo}`}
          categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name }))}
          banks={orderedBanks.map(b => ({ id: b.id, name: b.name }))}
          suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, phone: s.phone, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes }))}
          initialExpense={{
            id: expense.id,
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
              channel: payment.channel,
              bankId: payment.bankId,
              amount: payment.amount.toString(),
              paidBy: payment.paidBy
            }))
          }}
        />
  </div>;
}
