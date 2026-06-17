import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import IncomeForm from '@/components/IncomeForm';
import { requireWorkspace } from '@/lib/auth';

export default async function NewIncomePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/incomes/new');
  const params = (await searchParams) ?? {};
  const copyIdValue = Array.isArray(params.copyId) ? params.copyId[0] : params.copyId;
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/incomes';
  const encodedReturnTo = encodeURIComponent(returnTo);
  const copyId = copyIdValue ? Number(copyIdValue) : null;
  const copyIncome = copyId ? await prisma.income.findFirst({ where: { id: copyId, workspaceId: current.workspace.id } }) : null;

  return <div className="modal-page-wrap">
    <div className="modal-card modal-card-wide modal-page-card">
    <div className="toolbar-card modal-toolbar-card">
      <div>
        <h2>{copyIncome ? `Copia incasso #${copyIncome.id}` : 'Nuovo incasso'}</h2>
        <p className="muted">{copyIncome ? 'I dati sono precompilati: puoi modificarli prima di salvare il nuovo incasso.' : 'Inserisci un nuovo incasso.'}</p>
      </div>
      <Link className="table-action secondary" href={returnTo}>↩ Annulla</Link>
    </div>
    <IncomeForm
      initialIncome={copyIncome ? {
        salesChannel: copyIncome.salesChannel,
        saleCategory: copyIncome.saleCategory,
        amount: copyIncome.amount.toString(),
        paymentMethod: copyIncome.paymentMethod,
        creditChannel: copyIncome.creditChannel,
        creditDate: copyIncome.creditDate,
        billingMonth: copyIncome.billingMonth,
        billingYear: copyIncome.billingYear,
        isFiscal: copyIncome.isFiscal,
        invoiceStatus: copyIncome.invoiceStatus,
        vatRate: copyIncome.vatRate.toString(),
        notes: copyIncome.notes,
      } : undefined}
      action={`/api/incomes?returnTo=${encodedReturnTo}`}
      title={copyIncome ? 'Nuovo incasso da copia' : 'Nuovo incasso'}
      cancelHref={returnTo}
      submitLabel={copyIncome ? 'Crea incasso copiato' : 'Salva incasso'}
    />
    </div>
  </div>;
}
