import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import IncomeForm from '@/components/IncomeForm';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderPaymentMethods } from '@/lib/workspace-defaults';
import { clampDateToToday, clampPeriodToCurrentMonth } from '@/lib/copy-dates';

export default async function NewIncomePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/incomes/new');
  const params = (await searchParams) ?? {};
  const copyIdValue = Array.isArray(params.copyId) ? params.copyId[0] : params.copyId;
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/incomes';
  const encodedReturnTo = encodeURIComponent(returnTo);
  const copyId = copyIdValue ? Number(copyIdValue) : null;
  const [copyIncome, banks, paymentMethods, salesChannels, customers] = await Promise.all([
    copyId ? prisma.income.findFirst({ where: { id: copyId, workspaceId: current.workspace.id } }) : null,
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.incomeSalesChannel.findMany({ where: { workspaceId: current.workspace.id }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.customer.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' } })
  ]);
  const orderedBanks = orderBanks(banks);
  const incomePaymentMethods = orderPaymentMethods(paymentMethods, 'INCOME');
  const copyBillingPeriod = copyIncome ? clampPeriodToCurrentMonth(copyIncome.billingMonth, copyIncome.billingYear) : null;

  return <div className="modal-page-wrap">
    <div className="modal-card modal-card-wide modal-page-card income-wizard-page-card">
    <div className="toolbar-card modal-toolbar-card">
      <div>
        <h2>{copyIncome ? `Copia incasso #${copyIncome.id}` : 'Nuovo incasso'}</h2>
        <p className="muted">{copyIncome ? 'I dati sono precompilati: puoi modificarli prima di salvare il nuovo incasso.' : 'Inserisci un nuovo incasso.'}</p>
      </div>
      <Link className="btn btn-xs btn-default" href={returnTo}><span className="btn-icon">×</span> Annulla</Link>
    </div>
    <IncomeForm
      initialIncome={copyIncome ? {
        customerId: copyIncome.customerId,
        salesChannelId: copyIncome.salesChannelId,
        orderDate: clampDateToToday(copyIncome.orderDate ?? copyIncome.creditDate),
        amount: copyIncome.amount.toString(),
        paymentMethodId: copyIncome.paymentMethodId,
        creditBankId: copyIncome.creditBankId,
        creditDate: clampDateToToday(copyIncome.creditDate),
        billingMonth: copyBillingPeriod?.month,
        billingYear: copyBillingPeriod?.year,
        isFiscal: copyIncome.isFiscal,
        invoiceStatus: copyIncome.invoiceStatus,
        vatRate: copyIncome.vatRate.toString(),
        notes: copyIncome.notes,
      } : undefined}
      action={`/api/incomes?returnTo=${encodedReturnTo}`}
      title={copyIncome ? 'Nuovo incasso da copia' : 'Nuovo incasso'}
      cancelHref={returnTo}
      submitLabel={copyIncome ? 'Crea incasso copiato' : 'Salva incasso'}
      banks={orderedBanks.map(bank => ({ id: bank.id, name: bank.name, icon: bank.icon, isFallback: bank.isFallback }))}
      paymentMethods={incomePaymentMethods.map(method => ({ id: method.id, name: method.name, icon: method.icon, kind: method.kind, isFallback: method.isFallback }))}
      salesChannels={salesChannels}
      customers={customers}
    />
    </div>
  </div>;
}
