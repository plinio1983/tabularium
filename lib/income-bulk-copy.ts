import {addExpenseDays, expenseDateDayOffset} from '@/lib/expense-bulk-copy';

export type IncomeCreditCopyMode = 'NONE' | 'ORIGINAL' | 'TODAY' | 'RELATIVE_TO_ORDER';

export function copiedIncomeCreditDate(mode: IncomeCreditCopyMode, originalOrder: Date | null, copiedOrder: Date | null, originalCredit: Date, today: Date) {
  if (mode === 'TODAY') return new Date(today);
  if (mode === 'RELATIVE_TO_ORDER') {
    const offset = expenseDateDayOffset(originalOrder, originalCredit);
    return offset === null || !copiedOrder ? new Date(today) : addExpenseDays(copiedOrder, offset);
  }
  return new Date(originalCredit);
}

export function copiedIncomeIsCredited(amount: number, copiedCreditAmounts: number[]) {
  const credited = copiedCreditAmounts.reduce((sum, value) => sum + value, 0);
  return amount > 0 && credited >= amount - 0.005;
}
