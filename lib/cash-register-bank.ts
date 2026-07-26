import { prisma } from '@/lib/prisma';

type RegisterMethod = {
  id: number;
  systemRole?: string | null;
  cashRegisterDefaultBankId?: number | null;
};

export function preferredCashRegisterBankId(
  systemRole: string | null | undefined,
  ruleBankId: number | null | undefined,
  fallbackBankId: number | null | undefined
) {
  if (systemRole === 'CASH') return fallbackBankId ?? null;
  return ruleBankId ?? fallbackBankId ?? null;
}

export async function resolveCashRegisterBankId(
  workspaceId: number,
  method: RegisterMethod,
  salesChannelId: number
) {
  if (method.systemRole === 'CASH') {
    return preferredCashRegisterBankId(method.systemRole, null, method.cashRegisterDefaultBankId);
  }

  const rule = await prisma.cashRegisterBankRule.findFirst({
    where: {
      workspaceId,
      paymentMethodId: method.id,
      salesChannelId,
      bank: { workspaceId }
    },
    select: { bankId: true }
  });

  return preferredCashRegisterBankId(method.systemRole, rule?.bankId, method.cashRegisterDefaultBankId);
}
