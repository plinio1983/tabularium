import {prisma} from '@/lib/prisma';

export const defaultIncomeCategoryCode = 'DEFAULT';
export const defaultIncomeCategoryName = 'Predefinita';
export const defaultIncomeCategoryIcon = '•';

/**
 * IncomeCategory is retained as a dormant compatibility model. The application
 * assigns one technical category for ordinary incomes. The cash register
 * exposes configured income categories alongside sales channels.
 */
export async function resolveDefaultIncomeCategory(workspaceId: number) {
  return prisma.incomeCategory.findFirst({
    where: {workspaceId, code: defaultIncomeCategoryCode}
  }).then(category => category ?? prisma.incomeCategory.findFirst({
    where: {workspaceId, code: 'B2C'}
  })).then(category => category ?? prisma.incomeCategory.findFirst({
    where: {workspaceId},
    orderBy: {id: 'asc'}
  }));
}
