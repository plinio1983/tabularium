import {prisma} from '@/lib/prisma';
import {calendarDateInput} from '@/lib/company-time';
import {formatItalianCompactDate} from '@/lib/date-format';
import {euro} from '@/lib/money';

export type DashboardSearchItem = {id: number; title: string; subtitle: string; href: string};
export type DashboardSearchGroup = {key: string; label: string; items: DashboardSearchItem[]};
const limit = 5;
const text = (value: string, exact: boolean) => exact
  ? {equals: value, mode: 'insensitive' as const}
  : {contains: value, mode: 'insensitive' as const};
const dateLabel = (date: Date | null) => date ? formatItalianCompactDate(calendarDateInput(date)) : '';
const join = (...values: (string | null | undefined)[]) => values.filter(Boolean).join(' · ');

export function normalizeDashboardSearch(value: string) {return value.trim().replace(/\s+/g, ' ').slice(0, 120);}

// Two bounded queries ensure an exact match cannot be displaced by newer partial matches.
async function group<T extends {id: number}>(key: string, label: string, find: (exact: boolean) => Promise<T[]>, item: (row: T) => DashboardSearchItem): Promise<DashboardSearchGroup> {
  const [exact, partial] = await Promise.all([find(true), find(false)]);
  const unique = new Map<number, T>();
  [...exact, ...partial].forEach(row => {if (!unique.has(row.id)) unique.set(row.id, row);});
  return {key, label, items: [...unique.values()].slice(0, limit).map(item)};
}

export async function searchDashboard(raw: string, context: {workspaceId: number; companyId: number}): Promise<DashboardSearchGroup[]> {
  const q = normalizeDashboardSearch(raw);
  if (q.length < 2) return [];
  const scope = {workspaceId: context.workspaceId, companyId: context.companyId};
  function matches<T>(exact: boolean, fields: (value: string, exact: boolean) => T[]) {
    return exact ? {OR: fields(q, true)} : {AND: q.split(' ').map(term => ({OR: fields(term, false)}))};
  }
  const expenseMatch = (exact: boolean) => matches(exact, (value, isExact) => [
    {description: text(value, isExact)}, {merchant: text(value, isExact)},
    {supplier: {businessName: text(value, isExact)}}, {supplier: {alias: text(value, isExact)}},
    {employee: {firstName: text(value, isExact)}}, {employee: {lastName: text(value, isExact)}},
    {taxAuthority: {name: text(value, isExact)}},
  ]);
  const incomeMatch = (exact: boolean) => matches(exact, (value, isExact) => [
    {description: text(value, isExact)}, {customer: {businessName: text(value, isExact)}}, {customer: {alias: text(value, isExact)}},
  ]);
  const expenseRelations = {supplier: {select: {businessName: true}}, employee: {select: {firstName: true, lastName: true}}, taxAuthority: {select: {name: true}}} as const;
  const counterparty = (row: {merchant: string; supplier: {businessName: string} | null; employee: {firstName: string; lastName: string} | null; taxAuthority: {name: string} | null}) =>
    row.supplier?.businessName || (row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '') || row.taxAuthority?.name || row.merchant;
  const groups = await Promise.all([
    group('expenses', 'Spese', exact => prisma.expense.findMany({where: {...scope, ...expenseMatch(exact)}, take: limit, orderBy: [{createdAt: 'desc'}, {id: 'desc'}], select: {id: true, description: true, merchant: true, amount: true, receivedDate: true, paymentDate: true, ...expenseRelations}}),
      row => ({id: row.id, title: row.description || counterparty(row) || `Spesa #${row.id}`, subtitle: join(counterparty(row), euro(Number(row.amount)), dateLabel(row.receivedDate || row.paymentDate)), href: `/expenses/${row.id}`})),
    group('incomes', 'Incassi', exact => prisma.income.findMany({where: {...scope, ...incomeMatch(exact)}, take: limit, orderBy: [{createdAt: 'desc'}, {id: 'desc'}], select: {id: true, description: true, amount: true, creditDate: true, customer: {select: {businessName: true}}}}),
      row => ({id: row.id, title: row.description || row.customer?.businessName || `Incasso #${row.id}`, subtitle: join(row.customer?.businessName, euro(Number(row.amount)), dateLabel(row.creditDate)), href: `/incomes/${row.id}`})),
    group('recurring-expenses', 'Spese ricorrenti', exact => prisma.recurringExpense.findMany({where: {...scope, ...expenseMatch(exact)}, take: limit, orderBy: [{createdAt: 'desc'}, {id: 'desc'}], select: {id: true, description: true, merchant: true, amount: true, startDate: true, ...expenseRelations}}),
      row => ({id: row.id, title: row.description || counterparty(row) || `Ricorrenza #${row.id}`, subtitle: join(counterparty(row), euro(Number(row.amount)), `Dal ${dateLabel(row.startDate)}`), href: `/recurring-expenses/${row.id}`})),
    group('recurring-incomes', 'Incassi ricorrenti', exact => prisma.recurringIncome.findMany({where: {...scope, ...incomeMatch(exact)}, take: limit, orderBy: [{createdAt: 'desc'}, {id: 'desc'}], select: {id: true, description: true, amount: true, startDate: true, customer: {select: {businessName: true}}}}),
      row => ({id: row.id, title: row.description || row.customer?.businessName || `Ricorrenza #${row.id}`, subtitle: join(row.customer?.businessName, euro(Number(row.amount)), `Dal ${dateLabel(row.startDate)}`), href: `/recurring-incomes/${row.id}`})),
    group('suppliers', 'Fornitori', exact => prisma.supplier.findMany({where: {workspaceId: context.workspaceId, systemRole: null, ...matches(exact, (value, isExact) => [{businessName: text(value, isExact)}, {alias: text(value, isExact)}, {vatNumber: text(value, isExact)}])}, take: limit, orderBy: [{businessName: 'asc'}, {id: 'asc'}], select: {id: true, businessName: true, alias: true, vatNumber: true}}),
      row => ({id: row.id, title: row.businessName, subtitle: join(row.alias, row.vatNumber ? `P. IVA ${row.vatNumber}` : ''), href: `/suppliers/${row.id}`})),
    group('clients', 'Clienti', exact => prisma.customer.findMany({where: {workspaceId: context.workspaceId, systemRole: null, ...matches(exact, (value, isExact) => [{businessName: text(value, isExact)}, {alias: text(value, isExact)}, {vatNumber: text(value, isExact)}])}, take: limit, orderBy: [{businessName: 'asc'}, {id: 'asc'}], select: {id: true, businessName: true, alias: true, vatNumber: true}}),
      row => ({id: row.id, title: row.businessName, subtitle: join(row.alias, row.vatNumber ? `P. IVA ${row.vatNumber}` : ''), href: `/clients/${row.id}`})),
    group('employees', 'Dipendenti', exact => prisma.employee.findMany({where: {...scope, ...matches(exact, (value, isExact) => [{firstName: text(value, isExact)}, {lastName: text(value, isExact)}, {employeeCode: text(value, isExact)}, {taxCode: text(value, isExact)}])}, take: limit, orderBy: [{lastName: 'asc'}, {firstName: 'asc'}, {id: 'asc'}], select: {id: true, firstName: true, lastName: true, employeeCode: true, taxCode: true}}),
      row => ({id: row.id, title: `${row.firstName} ${row.lastName}`, subtitle: join(row.employeeCode ? `Matricola ${row.employeeCode}` : '', row.taxCode), href: `/employees/${row.id}`})),
  ]);
  return groups.filter(result => result.items.length > 0);
}
