import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';

export async function POST(request: Request, {params}: {params: Promise<{id: string; paymentId: string}>}) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const ids = await params;
  const id = Number(ids.id);
  const paymentId = Number(ids.paymentId);
  if (![id, paymentId].every(value => Number.isSafeInteger(value) && value > 0)) {
    return NextResponse.json({error: 'Pagamento non valido.'}, {status: 400});
  }
  const form = await request.formData();
  if (form.get('_action') !== 'delete') return NextResponse.json({error: 'Azione non valida.'}, {status: 400});
  const {current} = access;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const deleted = await prisma.$transaction(async tx => {
        const expense = await tx.expense.findFirst({
          where: {id, workspaceId: current.workspace.id, companyId: current.company.id},
          include: {payments: {orderBy: {id: 'asc'}}},
        });
        if (!expense || !expense.payments.some(payment => payment.id === paymentId)) return false;
        const remaining = expense.payments.filter(payment => payment.id !== paymentId);
        const paidCents = remaining.reduce((sum, payment) => sum + Math.round(Number(payment.amount) * 100), 0);
        const paymentStatus = paidCents <= 0 ? 'DA_PAGARE'
          : paidCents >= Math.round(Number(expense.amount) * 100) ? 'COMPLETATO' : 'PAGATO_PARZIALMENTE';
        await tx.expensePayment.delete({where: {id: paymentId}});
        await tx.expense.update({where: {id}, data: {
          paidAmount: paidCents / 100,
          paymentStatus,
          isComplete: paymentStatus === 'COMPLETATO',
          paymentDate: paymentStatus === 'DA_PAGARE' ? null : remaining[0]?.paymentDate ?? null,
        }});
        await tx.auditLog.create({data: {
          workspaceId: current.workspace.id, userId: current.user.id,
          action: 'UPDATE', entityType: 'Expense', entityId: String(id),
          metadata: {action: 'delete_payment', paymentId},
        }});
        return true;
      }, {isolationLevel: 'Serializable'});
      return deleted ? NextResponse.json({ok: true})
        : NextResponse.json({error: 'Pagamento non trovato. Aggiorna la pagina e riprova.'}, {status: 404});
    } catch (error) {
      if ((error as {code?: string}).code === 'P2034' && attempt < 2) continue;
      console.error('Errore eliminazione pagamento spesa', error);
      return NextResponse.json({error: 'Non è stato possibile eliminare il pagamento. Riprova.'}, {status: 500});
    }
  }
}
