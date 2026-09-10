import {Prisma} from '@/generated/prisma/client';
import {resolveReceiptPeriod} from './receipt-period';
import {addCalendarDays, zonedMidnightUtc} from './company-time';

export type LedgerKind = 'payments' | 'credits';
export type LedgerParams = Record<string, string | string[] | undefined>;
export const ledgerPageSize = 50;
export const ledgerSortColumns = ['date', 'party', 'description', 'method', 'bank', 'amount', 'documentId'] as const;
export type LedgerSortColumn = typeof ledgerSortColumns[number];
export const paramValue = (params: LedgerParams, name: string) => {
  const value = params[name];
  return (Array.isArray(value) ? value[0] : value) ?? '';
};
export function ledgerFilters(params: LedgerParams, today: string) {
  const id = (name: string) => {
    const value = Number(paramValue(params, name));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  };
  const page = Number(paramValue(params, 'page'));
  const requestedSort = paramValue(params, 'sort');
  const sort: LedgerSortColumn = ledgerSortColumns.includes(requestedSort as LedgerSortColumn) ? requestedSort as LedgerSortColumn : 'date';
  return {
    period: resolveReceiptPeriod(params, today),
    search: paramValue(params, 'search').trim(),
    methodId: id('methodId'),
    bankId: id('bankId'),
    noBank: paramValue(params, 'bankId') === 'none',
    dateMode: ['all', 'undated'].includes(paramValue(params, 'dateMode')) ? paramValue(params, 'dateMode') : 'period',
    type: paramValue(params, 'type'),
    salesChannelId: id('salesChannelId'),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1000000) : 1,
    sort,
    direction: paramValue(params, 'direction') === 'asc' ? 'asc' as const : 'desc' as const,
  };
}

export function ledgerOrder(filters: ReturnType<typeof ledgerFilters>) {
  const columns: Record<LedgerSortColumn, Prisma.Sql> = {
    date: Prisma.sql`date`, party: Prisma.sql`lower(party)`, description: Prisma.sql`lower(description)`,
    method: Prisma.sql`lower(method)`, bank: Prisma.sql`lower(bank)`, amount: Prisma.sql`filtered.amount`, documentId: Prisma.sql`"documentId"`,
  };
  const direction = filters.direction === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  return Prisma.sql`ORDER BY ${columns[filters.sort]} ${direction} NULLS LAST, id DESC`;
}

export function ledgerSource(kind: LedgerKind, workspaceId: number, companyId: number) {
  if (kind === 'payments') return Prisma.sql`
    SELECT p.id, p."expenseId" AS "documentId", p."paymentDate" AS date, p.amount,
      p."paymentMethodId" AS "methodId", p."bankId", m.name AS method, m.icon AS "methodIcon",
      coalesce(b.name, 'Non specificato') AS bank,
      coalesce(nullif(concat_ws(' ', e."firstName", e."lastName"), ''), s."businessName", d.merchant) AS party,
      coalesce(d.description, '') AS description, d."expenseType"::text AS type,
      NULL::integer AS "salesChannelId"
    FROM "ExpensePayment" p JOIN "Expense" d ON d.id = p."expenseId"
    JOIN "PaymentMethod" m ON m.id = p."paymentMethodId"
    LEFT JOIN "Bank" b ON b.id = p."bankId"
    LEFT JOIN "Supplier" s ON s.id = d."supplierId"
    LEFT JOIN "Employee" e ON e.id = d."employeeId"
    WHERE d."workspaceId" = ${workspaceId} AND d."companyId" = ${companyId}`;
  return Prisma.sql`
    SELECT p.id, p."incomeId" AS "documentId", p."creditDate" AS date, p.amount,
      p."paymentMethodId" AS "methodId", p."bankId", m.name AS method, m.icon AS "methodIcon", b.name AS bank,
      coalesce(c."businessName", ch.name) AS party,
      coalesce(d.description, '') AS description, d."incomeType"::text AS type,
      d."salesChannelId"
    FROM "IncomeCredit" p JOIN "Income" d ON d.id = p."incomeId"
    JOIN "PaymentMethod" m ON m.id = p."paymentMethodId"
    JOIN "Bank" b ON b.id = p."bankId"
    LEFT JOIN "Customer" c ON c.id = d."customerId"
    JOIN "IncomeSalesChannel" ch ON ch.id = d."salesChannelId"
    WHERE d."workspaceId" = ${workspaceId} AND d."companyId" = ${companyId}`;
}
export function ledgerWhere(filters: ReturnType<typeof ledgerFilters>, timeZone: string) {
  const clauses: Prisma.Sql[] = [];
  if (filters.dateMode === 'undated') clauses.push(Prisma.sql`date IS NULL`);
  else if (filters.dateMode !== 'all') clauses.push(Prisma.sql`date >= ${zonedMidnightUtc(filters.period.from, timeZone)} AND date < ${zonedMidnightUtc(addCalendarDays(filters.period.to, 1), timeZone)}`);
  if (filters.search) clauses.push(Prisma.sql`strpos(lower(concat_ws(' ', party, description, "documentId"::text)), lower(${filters.search})) > 0`);
  if (filters.methodId) clauses.push(Prisma.sql`"methodId" = ${filters.methodId}`);
  if (filters.noBank) clauses.push(Prisma.sql`"bankId" IS NULL`);
  else if (filters.bankId) clauses.push(Prisma.sql`"bankId" = ${filters.bankId}`);
  if (filters.type) clauses.push(Prisma.sql`type = ${filters.type}`);
  if (filters.salesChannelId) clauses.push(Prisma.sql`"salesChannelId" = ${filters.salesChannelId}`);
  return clauses.length ? Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}` : Prisma.empty;
}
export const movementTypeLabels: Record<string, string> = {
  STANDARD: 'Standard', PAYROLL: 'Busta paga', VAT_SETTLEMENT: 'Saldo IVA', COUNTER: 'Spesa al banco', TAX_CONTRIBUTION: 'Imposte e contributi', CASH_REGISTER: 'Scontrino',
};
