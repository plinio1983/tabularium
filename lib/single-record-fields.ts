import type {PrismaClient, Prisma} from '@/generated/prisma/client';
import {z} from 'zod';

const Details = z.object({amount: z.coerce.number().finite().nonnegative().max(9999999999.99), description: z.string()});
/** Partial document updates never replace, create or remove payments/credits. */
export async function updateSingleRecordFields(db: PrismaClient, kind: 'expenses' | 'incomes', workspaceId: number, companyId: number, ids: number[], form: FormData, audit?: (tx: Prisma.TransactionClient) => Promise<void>) {
  if (ids.length !== 1) throw new Error('Seleziona un solo documento.');
  const action = String(form.get('bulkAction'));
  if (action !== 'change_details' && action !== 'change_notes' && action !== 'change_amount' && action !== 'change_identity') throw new Error('Operazione non valida.');
  const details = (action === 'change_details' || action === 'change_amount') ? Details.parse({amount: form.get('amount'), description: action === 'change_amount' ? '' : form.get('description')}) : null;
  if (details && (!String(form.get('amount') ?? '').trim() || !Number.isSafeInteger(Math.round(details.amount * 100)) || Math.abs(details.amount * 100 - Math.round(details.amount * 100)) > 0.0001)) throw new Error('Importo non valido.');
  const notes = String(form.get('notes') ?? '');
  await db.$transaction(async tx => {
    async function update() {
      const where = {id: ids[0], workspaceId, companyId};
      if (action === 'change_identity') {
        const description = z.string().parse(form.get('description'));
        const id = (name: string) => z.coerce.number().int().positive().parse(form.get(name));
        if (kind === 'expenses') {
          const record = await tx.expense.findFirst({where});
          if (!record || record.expenseType !== 'STANDARD' || !description.trim()) throw new Error('Documento non modificabile.');
          const supplier = await tx.supplier.findFirst({where: {id: id('supplierId'), workspaceId, systemRole: null}});
          const category = await tx.expenseCategory.findFirst({where: {id: id('categoryId'), workspaceId}});
          if (!supplier || !category) throw new Error('Esercente o categoria non validi.');
          await tx.expense.update({where: {id: record.id}, data: {supplierId: supplier.id, merchant: supplier.businessName, categoryId: category.id, description}});
        } else {
          const record = await tx.income.findFirst({where});
          if (!record || record.incomeType !== 'STANDARD') throw new Error('Documento non modificabile.');
          const rawCustomer = String(form.get('customerId') ?? '');
          const customer = rawCustomer ? await tx.customer.findFirst({where: {id: id('customerId'), workspaceId, systemRole: null}}) : null;
          const channel = await tx.incomeSalesChannel.findFirst({where: {id: id('salesChannelId'), workspaceId}});
          if ((rawCustomer && !customer) || !channel) throw new Error('Cliente o canale non validi.');
          await tx.income.update({where: {id: record.id}, data: {customerId: customer?.id ?? null, salesChannelId: channel.id, description}});
        }
        return;
      }

      if (kind === 'expenses') {
        const record = await tx.expense.findFirst({where, include: {payments: true}});
        if (!record || record.expenseType !== 'STANDARD') throw new Error('Documento non modificabile.');
        if (!details) {await tx.expense.update({where: {id: record.id}, data: {notes}}); return;}
        if (action === 'change_details' && !details.description.trim()) throw new Error('Inserisci una descrizione.');
        const paid = Math.max(Number(record.paidAmount), record.payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
        if (details.amount + 0.005 < paid) throw new Error('Importo inferiore ai pagamenti registrati.');
        await tx.expense.update({where: {id: record.id}, data: {
          amount: details.amount, ...(action === 'change_details' ? {description: details.description} : {}),
          paymentStatus: paid > 0 ? (paid >= details.amount - 0.005 ? 'COMPLETATO' : 'PAGATO_PARZIALMENTE') : 'DA_PAGARE'
        }});
      } else {
        const record = await tx.income.findFirst({where, include: {credits: true}});
        if (!record || record.incomeType !== 'STANDARD') throw new Error('Documento non modificabile.');
        if (!details) {await tx.income.update({where: {id: record.id}, data: {notes}}); return;}
        const credited = record.credits.length ? record.credits.reduce((sum, credit) => sum + Number(credit.amount), 0) : record.isCredited ? Number(record.amount) : 0;
        if (details.amount + 0.005 < credited) throw new Error('Importo inferiore agli accrediti registrati.');
        await tx.income.update({where: {id: record.id}, data: {amount: details.amount, ...(action === 'change_details' ? {description: details.description} : {}), isCredited: details.amount > 0 && credited >= details.amount - 0.005}});
      }
    }
    await update();
    await audit?.(tx);
  }, {isolationLevel: 'Serializable'});
}
