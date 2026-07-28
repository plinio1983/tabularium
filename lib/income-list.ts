export type IncomeCashRegisterGroup = {
  key: string;
  billingYear: number;
  billingMonth: number;
  paymentMethodId: number;
  paymentMethod: string;
  paymentMethodIcon?: string | null;
  salesChannelId: number;
  salesChannel: string;
  salesChannelIcon?: string | null;
  isFiscal: boolean;
  amount: number;
  count: number;
  latestCreditDate: Date | null;
  vatRates: number[];
};

type IncomeListRecord = {
  incomeType: string;
  billingYear: number;
  billingMonth: number;
  paymentMethodId: number;
  paymentMethodRef: { name: string; icon?: string | null };
  salesChannelId: number;
  salesChannelRef: { name: string; icon?: string | null };
  isFiscal: boolean;
  amount: unknown;
  creditDate: Date | null;
  vatRate: unknown;
};

/**
 * Produces the canonical rows consumed by IncomesList.
 * Cash-register receipts are always collapsed into the same aggregate rows,
 * independently of the page that hosts the shared list.
 */
export function prepareIncomeList<T extends IncomeListRecord>(incomes: T[]) {
  const standardIncomes = incomes.filter(income => income.incomeType !== 'CASH_REGISTER');
  const cashRegisterGroups = Array.from(incomes
    .filter(income => income.incomeType === 'CASH_REGISTER')
    .reduce((groups, income) => {
      const key = [
        income.billingYear,
        income.billingMonth,
        income.paymentMethodId,
        income.salesChannelId,
        income.isFiscal ? '1' : '0'
      ].join(':');
      const current = groups.get(key) ?? {
        key,
        billingYear: income.billingYear,
        billingMonth: income.billingMonth,
        paymentMethodId: income.paymentMethodId,
        paymentMethod: income.paymentMethodRef.name,
        paymentMethodIcon: income.paymentMethodRef.icon,
        salesChannelId: income.salesChannelId,
        salesChannel: income.salesChannelRef.name,
        salesChannelIcon: income.salesChannelRef.icon,
        isFiscal: income.isFiscal,
        amount: 0,
        count: 0,
        latestCreditDate: income.creditDate,
        vatRates: [] as number[]
      };
      current.amount += Number(income.amount);
      current.count += 1;
      if (income.creditDate && (!current.latestCreditDate || income.creditDate > current.latestCreditDate)) {
        current.latestCreditDate = income.creditDate;
      }
      const vatRate = Number(income.vatRate);
      if (!current.vatRates.includes(vatRate)) current.vatRates.push(vatRate);
      groups.set(key, current);
      return groups;
    }, new Map<string, IncomeCashRegisterGroup>()).values())
    .sort((a, b) => b.billingYear - a.billingYear
      || b.billingMonth - a.billingMonth
      || a.paymentMethod.localeCompare(b.paymentMethod, 'it'));

  return {standardIncomes, cashRegisterGroups};
}
