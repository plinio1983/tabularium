import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import IncomeForm from '@/components/IncomeForm';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderPaymentMethods } from '@/lib/workspace-defaults';

export default async function EditIncomePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/incomes');
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : `/incomes/${id}`;
  const encodedReturnTo = encodeURIComponent(returnTo);
  const [income, banks, paymentMethods, salesChannels, customers] = await Promise.all([
    prisma.income.findFirst({ where: { id: Number(id), workspaceId: current.workspace.id } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.incomeSalesChannel.findMany({ where: { workspaceId: current.workspace.id }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.customer.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' } })
  ]);
  if (!income) notFound();
  const orderedBanks = orderBanks(banks);
  const incomePaymentMethods = orderPaymentMethods(paymentMethods, 'INCOME');

  return <div className="modal-page-wrap">
    <div className="modal-card modal-card-wide modal-page-card income-wizard-page-card">
    <IncomeForm
      initialIncome={income}
      action={`/api/incomes/${income.id}?returnTo=${encodedReturnTo}`}
      title={`Modifica incasso #${income.id}`}
      cancelHref={returnTo}
      submitLabel="Salva modifiche"
      banks={orderedBanks.map(bank => ({ id: bank.id, name: bank.name, icon: bank.icon, isFallback: bank.isFallback }))}
      paymentMethods={incomePaymentMethods.map(method => ({ id: method.id, name: method.name, icon: method.icon, kind: method.kind, isFallback: method.isFallback }))}
      salesChannels={salesChannels}
      customers={customers}
    />
    </div>
  </div>;
}
