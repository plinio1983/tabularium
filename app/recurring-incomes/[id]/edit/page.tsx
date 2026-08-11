import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireWorkspace } from '@/lib/auth';
import RecurringIncomeForm from '@/components/RecurringIncomeForm';

export default async function EditRecurringIncomePage({ params }: { params: Promise<{id:string}> }) {
  const current = await requireWorkspace('/recurring-incomes'); const workspaceId=current.workspace.id; const id=Number((await params).id);
  const [item,channels,customers,methods,banks]=await Promise.all([
    prisma.recurringIncome.findFirst({where:{id,workspaceId}}), prisma.incomeSalesChannel.findMany({where:{workspaceId},orderBy:{sortOrder:'asc'}}), prisma.customer.findMany({where:{workspaceId},orderBy:{businessName:'asc'}}), prisma.paymentMethod.findMany({where:{workspaceId,kind:{in:['INCOME','BOTH']}},orderBy:{name:'asc'}}), prisma.bank.findMany({where:{workspaceId},orderBy:{name:'asc'}})
  ]); if(!item) notFound();
  return <div className="modal-page-wrap"><div className="modal-card modal-card-wide modal-page-card recurring-wizard-page-card"><div className="toolbar-card modal-toolbar-card"><div><h2>Modifica entrata ricorrente</h2><p className="muted">Le modifiche valgono per le generazioni future.</p></div><Link className="btn btn-sm btn-default" href="/recurring-incomes">× Annulla</Link></div><RecurringIncomeForm editId={id} action="" cancelHref="/recurring-incomes" initial={item} channels={channels} customers={customers} methods={methods} banks={banks} /></div></div>;
}
