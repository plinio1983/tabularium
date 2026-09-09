import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireWorkspace } from '@/lib/auth';
import RecurringIncomeForm from '@/components/RecurringIncomeForm';

export default async function EditRecurringIncomePage({ params, searchParams }: { params: Promise<{id:string}>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo === '/recurring-incomes' || rawReturnTo?.startsWith('/recurring-incomes?') ? rawReturnTo : '/recurring-incomes';
  const current = await requireWorkspace('/recurring-incomes'); const workspaceId=current.workspace.id; const id=Number((await params).id);
  const [item,channels,customers,methods,banks]=await Promise.all([
    prisma.recurringIncome.findFirst({where:{id,workspaceId}}), prisma.incomeSalesChannel.findMany({where:{workspaceId},orderBy:{sortOrder:'asc'}}), prisma.customer.findMany({where:{workspaceId},orderBy:{businessName:'asc'}}), prisma.paymentMethod.findMany({where:{workspaceId,kind:{in:['INCOME','BOTH']}},orderBy:{name:'asc'}}), prisma.bank.findMany({where:{workspaceId},orderBy:{name:'asc'}})
  ]); if(!item) notFound();
  return <div className="modal-page-wrap"><div className="modal-card modal-card-wide modal-page-card recurring-wizard-page-card"><div className="toolbar-card modal-toolbar-card"><div><h2>Modifica entrata ricorrente</h2><p className="muted">Le modifiche valgono per le generazioni future.</p></div><Link className="btn btn-sm btn-default" href={returnTo}>× Annulla</Link></div><RecurringIncomeForm editId={id} action="" cancelHref={returnTo} initial={item} channels={channels} customers={customers} methods={methods} banks={banks} /></div></div>;
}
