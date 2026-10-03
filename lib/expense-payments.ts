import type {PrismaClient} from '../generated/prisma/client';
import {requirePaymentDate} from './payment-date';

export type ExpensePaymentInput = {
  paymentDate?: string;
  paymentMethodId?: number | null;
  bankId?: number | null;
  amount: number;
};

// Creation and editing must validate references against the same workspace.
export async function resolveExpensePaymentInputs(
  db: Pick<PrismaClient, 'paymentMethod' | 'bank'>,
  payments: ExpensePaymentInput[],
  workspaceId: number,
  forbidCash = false,
) {
  if (!payments.length) return payments;
  const bankIds = [...new Set(payments.flatMap(payment => payment.bankId == null ? [] : [payment.bankId]))];
  const [methods, banks] = await Promise.all([
    db.paymentMethod.findMany({where: {workspaceId}}),
    bankIds.length ? db.bank.findMany({where: {workspaceId, id: {in: bankIds}}}) : [],
  ]);
  return payments.map(payment => {
    requirePaymentDate(payment.paymentDate);
    if (!Number.isFinite(payment.amount) || payment.amount <= 0) throw new Error('Importo pagamento non valido');
    const method = methods.find(item => item.id === payment.paymentMethodId);
    if (!method) throw new Error('Metodo pagamento non valido');
    if (forbidCash && (method.systemRole === 'CASH' || method.name.trim().toLowerCase() === 'cash')) {
      throw new Error('Cash non è disponibile per i saldi IVA');
    }
    if (payment.bankId != null && !banks.some(bank => bank.id === payment.bankId)) throw new Error('Banca non valida');
    return {...payment, paymentMethodId: method.id};
  });
}
