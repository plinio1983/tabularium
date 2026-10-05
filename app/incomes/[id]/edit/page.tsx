import {ResponsiveRecordEdit} from '@/components/SingleRecordFieldsModal';
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
    prisma.income.findFirst({ where: { id: Number(id), workspaceId: current.workspace.id, companyId: current.company.id } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.incomeSalesChannel.findMany({ where: { workspaceId: current.workspace.id }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.customer.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' } })
  ]);
  if (!income) notFound();
  const orderedBanks = orderBanks(banks);
  const incomePaymentMethods = orderPaymentMethods(paymentMethods, 'INCOME');

  return <ResponsiveRecordEdit kind="incomes" returnTo={returnTo} record={{id: income.id, amount: income.amount.toString(), vatRate: income.vatRate.toString(), incomeType: income.incomeType, orderDate: income.orderDate, dueDate: income.dueDate, customerId: income.customerId, salesChannelId: income.salesChannelId, billingMonth: income.billingMonth, billingYear: income.billingYear, isFiscal: income.isFiscal, invoiceStatus: income.invoiceStatus, notes: income.notes, description: income.description}} customers={customers} salesChannels={salesChannels}><div className="modal-page-wrap">
    <div className="modal-card modal-card-wide modal-page-card income-wizard-page-card">
    <IncomeForm
      initialIncome={income}
      action={`/api/incomes/${income.id}?returnTo=${encodedReturnTo}`}
      title={`Modifica incasso #${income.id}`}
      cancelHref={returnTo}
      submitLabel="Salva modifiche"
      banks={orderedBanks.map(bank => ({ id: bank.id, name: bank.name, icon: bank.icon, isFallback: bank.isFallback, isPrimary: bank.id === current.company.primaryBankId }))}
      paymentMethods={incomePaymentMethods.map(method => ({ id: method.id, name: method.name, icon: method.icon, kind: method.kind, isFallback: method.isFallback }))}
      salesChannels={salesChannels}
      customers={customers}
    />
    </div>
  </div></ResponsiveRecordEdit>;
}
