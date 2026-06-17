import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import IncomeForm from '@/components/IncomeForm';
import { requireWorkspace } from '@/lib/auth';

export default async function EditIncomePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/incomes');
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : `/incomes/${id}`;
  const encodedReturnTo = encodeURIComponent(returnTo);
  const income = await prisma.income.findFirst({ where: { id: Number(id), workspaceId: current.workspace.id } });
  if (!income) notFound();

  return <div className="modal-page-wrap">
    <div className="modal-card modal-card-wide modal-page-card">
    <IncomeForm
      initialIncome={income}
      action={`/api/incomes/${income.id}?returnTo=${encodedReturnTo}`}
      title={`Modifica incasso #${income.id}`}
      cancelHref={returnTo}
      submitLabel="Salva modifiche"
    />
    </div>
  </div>;
}
