import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {allocateBulkPayment, bulkPaymentRows, paymentCents} from '@/lib/expense-bulk-payment';
import {resolveExpensePaymentInputs} from '@/lib/expense-payments';
import {requirePaymentDate} from '@/lib/payment-date';

function parseIds(values: unknown) {
  if (!Array.isArray(values) || !values.length || values.length > 1000 || values.some(v => !Number.isSafeInteger(v) || v <= 0)) throw new Error('Selezione non valida.');
  return [...new Set(values as number[])];
}
export async function GET(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  try {
    const ids = parseIds(new URL(request.url).searchParams.getAll('ids').map(Number));
    const expenses = await prisma.expense.findMany({where: {id: {in: ids}, workspaceId: access.current.workspace.id, companyId: access.current.company.id}, include: {payments: true}});
    if (expenses.length !== ids.length) throw new Error('Una o più spese non sono disponibili.');
    return NextResponse.json({rows: bulkPaymentRows(expenses)});
  } catch (error) {return NextResponse.json({error: error instanceof Error ? error.message : 'Selezione non valida.'}, {status: 400});}
}
export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const {current} = access;
  try {
    const body = await request.json();
    if (typeof body.amount !== 'number' || body.amount > 9999999999.99 || typeof body.paymentDate !== 'string'
      || !Number.isSafeInteger(body.paymentMethodId) || body.paymentMethodId <= 0
      || (body.bankId != null && (!Number.isSafeInteger(body.bankId) || body.bankId <= 0))) throw new Error('Dati pagamento non validi.');
    const ids = parseIds(body.ids);
    const cents = paymentCents(body.amount);
    if (Math.abs(Number(body.amount) * 100 - cents) > 0.00001) throw new Error('Usa al massimo due decimali.');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await prisma.$transaction(async tx => {
          const expenses = await tx.expense.findMany({where: {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id}, include: {payments: {orderBy: {id: 'asc'}}}});
          if (expenses.length !== ids.length) throw new Error('Una o più spese non sono disponibili.');
          const rows = bulkPaymentRows(expenses);
          if (JSON.stringify(rows) !== JSON.stringify(body.preview)) throw new Error('Le spese sono cambiate. Chiudi e riapri il form per aggiornare la ripartizione.');
          const allocations = allocateBulkPayment(rows, cents);
          const [payment] = await resolveExpensePaymentInputs(tx, [{amount: cents / 100, paymentDate: body.paymentDate, paymentMethodId: body.paymentMethodId, bankId: body.bankId}], current.workspace.id, expenses.some(e => e.expenseType === 'VAT_SETTLEMENT'));
          for (const row of allocations) {
            if (!row.allocatedCents) continue;
            const expense = expenses.find(e => e.id === row.id)!;
            const paidCents = expense.payments.reduce((sum, p) => sum + paymentCents(p.amount), 0) + row.allocatedCents;
            const complete = paidCents >= paymentCents(expense.amount);
            const paymentDate = requirePaymentDate(payment.paymentDate);
            await tx.expensePayment.create({data: {expenseId: row.id, paymentDate, paymentMethodId: payment.paymentMethodId!, bankId: payment.bankId ?? null, amount: row.allocatedCents / 100}});
            await tx.expense.update({where: {id: row.id}, data: {paidAmount: paidCents / 100, paymentStatus: complete ? 'COMPLETATO' : 'PAGATO_PARZIALMENTE', isComplete: complete, paymentDate: expense.payments[0]?.paymentDate ?? paymentDate}});
          }
          await tx.auditLog.create({data: {workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_UPDATE', entityType: 'Expense', metadata: {operation: 'bulk_payment', amount: cents / 100, allocations: allocations.filter(r => r.allocatedCents > 0)}}});
        }, {isolationLevel: 'Serializable'});
        return NextResponse.json({ok: true});
      } catch (error) {
        if ((error as {code?: string}).code === 'P2034' && attempt < 2) continue;
        throw error;
      }
    }
  } catch (error) {
    const dbError = Boolean((error as {code?: string}).code);
    if (dbError) console.error('Errore pagamento bulk', error);
    return NextResponse.json({error: dbError ? 'Impossibile salvare il pagamento. Riprova.' : error instanceof Error ? error.message : 'Dati non validi.'}, {status: 400});
  }
}
