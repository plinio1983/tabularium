import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RecurringExpenseForm from '@/components/RecurringExpenseForm';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderExpenseCategories, orderPaymentMethods } from '@/lib/workspace-defaults';

export default async function NewRecurringExpensePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/recurring-expenses/new');
  const params = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/recurring-expenses';
  const encodedReturnTo = encodeURIComponent(returnTo);

  const [categories, banks, paymentMethods, suppliers] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  const orderedBanks = orderBanks(banks);
  const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');
  const orderedCategories = orderExpenseCategories(categories);

  return <div className="modal-page-wrap">
    <div className="modal-card modal-card-wide modal-page-card recurring-wizard-page-card">
      <div className="toolbar-card modal-toolbar-card">
        <div><h2>Spesa ricorrente</h2><p className="muted">Configura una regola ricorrente.</p></div>
        <Link className="btn btn-xs btn-default" href={returnTo}><span className="btn-icon">×</span> Annulla</Link>
      </div>
      <RecurringExpenseForm
        categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name, icon: c.icon }))}
        banks={orderedBanks.map(b => ({ id: b.id, name: b.name, icon: b.icon, isFallback: b.isFallback, isPrimary: b.id === current.company.primaryBankId }))}
        paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, icon: method.icon, kind: method.kind, isFallback: method.isFallback }))}
        suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, defaultExpenseCategoryId: s.defaultExpenseCategoryId, defaultVatRate: s.defaultVatRate?.toString() ?? null }))}
        action={`/api/recurring-expenses?returnTo=${encodedReturnTo}`}
        mobileStepOffset={1}
        cancelHref={returnTo}
      />
    </div>
  </div>;
}
