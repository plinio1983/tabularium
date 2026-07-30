import {redirect} from 'next/navigation';
import CounterExpenseRegister from '@/components/CounterExpenseRegister';
import {requireWorkspace} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {
  ensureWorkspaceDefaults,
  orderBanks,
  orderExpenseCategories,
  orderPaymentMethods
} from '@/lib/workspace-defaults';

export const dynamic = 'force-dynamic';

function romeDateLocal(date: Date) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find(value => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export default async function CounterExpensePage() {
  const current = await requireWorkspace('/expenses/counter');
  await ensureWorkspaceDefaults(current.workspace.id);
  const [categories, methods, banks] = await Promise.all([
    prisma.expenseCategory.findMany({where: {workspaceId: current.workspace.id}}),
    prisma.paymentMethod.findMany({
      where: {workspaceId: current.workspace.id, kind: {in: ['EXPENSE', 'BOTH']}}
    }),
    prisma.bank.findMany({where: {workspaceId: current.workspace.id, isFallback: false}})
  ]);
  if (!categories.length || !methods.length) redirect('/settings/payment-credit');

  return <CounterExpenseRegister
    initialDate={romeDateLocal(new Date())}
    categories={orderExpenseCategories(categories).map(category => ({
      id: category.id,
      name: category.name,
      icon: category.icon
    }))}
    methods={orderPaymentMethods(methods, 'EXPENSE').map(method => ({
      id: method.id,
      name: method.name,
      icon: method.icon,
      systemRole: method.systemRole
    }))}
    banks={orderBanks(banks).map(bank => ({
      id: bank.id,
      name: bank.name,
      icon: bank.icon,
      isPrimary: bank.id === current.company.primaryBankId
    }))}
  />;
}
