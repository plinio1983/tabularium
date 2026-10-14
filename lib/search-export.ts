import {prisma} from './prisma';
import {resolveExpenseSearch, matchesExpenseSearch, expensesSearchInclude} from './expenses-search';
import {resolveIncomeSearch, matchesIncomeSearch, incomesSearchInclude} from './incomes-search';
import {expensesCsv, incomesCsv, expensesCsvInclude, incomesCsvInclude} from './record-csv-export';
import {orderBanks, orderPaymentMethods} from './workspace-defaults';
import {normalizeDashboardTaskParams} from './dashboard-tasks';

export async function searchExportCsv(entity: 'expenses' | 'incomes', workspaceId: number, companyId: number, timeZone: string, params: URLSearchParams, now = new Date()) {
  const normalized = normalizeDashboardTaskParams(entity, params);
  const filters: Record<string, string[]> = {};
  for (const key of normalized.keys()) filters[key] = normalized.getAll(key);
  if (entity === 'expenses') {
    const search = resolveExpenseSearch(filters, timeZone, now);
    const records = await prisma.expense.findMany({
      where: {workspaceId, companyId},
      include: {...expensesSearchInclude, ...expensesCsvInclude},
      orderBy: [{year: 'desc'}, {month: 'desc'}, {receivedDate: 'desc'}, {id: 'desc'}],
    });
    const results = records.filter(record => matchesExpenseSearch(record, search));
    return {count: results.length, csv: expensesCsv(results)};
  }
  const [records, methods, banks] = await Promise.all([
    prisma.income.findMany({
      where: {workspaceId, companyId},
      include: {...incomesSearchInclude, ...incomesCsvInclude},
      orderBy: [{creditDate: 'desc'}, {id: 'desc'}],
    }),
    prisma.paymentMethod.findMany({where: {workspaceId}}),
    prisma.bank.findMany({where: {workspaceId}}),
  ]);
  const search = resolveIncomeSearch(filters, timeZone, now, orderPaymentMethods(methods, 'INCOME'), orderBanks(banks));
  // Receipts remain individual records in CSV, even when grouped in the list.
  const results = records.filter(record => matchesIncomeSearch(record, search));
  return {count: results.length, csv: incomesCsv(results)};
}
