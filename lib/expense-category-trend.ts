import {aggregateIncomeChannelTrend, type IncomeChannelTrendData} from '@/lib/income-channel-trend';

export type ExpenseCategoryTrendRecord = {
  amount: unknown;
  receivedDate: Date | null;
  expenseType?: string | null;
  categoryId?: number | null;
  category?: {name: string; icon?: string | null} | null;
};

function expenseSeries(record: ExpenseCategoryTrendRecord) {
  if (record.categoryId && record.category) return {id: record.categoryId, name: record.category.name, icon: record.category.icon ?? null};
  if (record.expenseType === 'VAT_SETTLEMENT') return {id: -1, name: 'Saldo IVA', icon: 'IVA'};
  if (record.expenseType === 'TAX_CONTRIBUTION') return {id: -2, name: 'Imposte e contributi', icon: 'F24'};
  if (record.expenseType === 'PAYROLL') return {id: -3, name: 'Buste paga', icon: 'BP'};
  return {id: 0, name: 'Senza categoria', icon: '•'};
}

export function aggregateExpenseCategoryTrend(records: ExpenseCategoryTrendRecord[], year: number, timeZone: string): IncomeChannelTrendData {
  return aggregateIncomeChannelTrend(records.flatMap(record => {
    if (!record.receivedDate) return [];
    const series = expenseSeries(record);
    return [{
      amount: record.amount,
      creditDate: record.receivedDate,
      salesChannelId: series.id,
      salesChannelRef: {name: series.name, icon: series.icon},
    }];
  }), year, timeZone);
}
