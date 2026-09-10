import {Prisma} from '@/generated/prisma/client';
import {ledgerPageSize, ledgerSource, ledgerWhere, type LedgerKind, type ledgerFilters} from './movement-ledger';

export type Movement = {id: number; documentId: number; date: Date | null; amount: string; party: string; description: string; method: string; bank: string; type: string};
export type Group = {dimension: string; id: number | null; name: string; count: number; total: string};
type Summary = {count: number; total: string};

export async function loadMovementLedger(db: Prisma.TransactionClient, kind: LedgerKind, workspaceId: number, companyId: number, timeZone: string, filters: ReturnType<typeof ledgerFilters>) {
  const source = ledgerSource(kind, workspaceId, companyId);
  const where = ledgerWhere(filters, timeZone);
  const filtered = Prisma.sql`WITH movements AS (${source}), filtered AS (SELECT * FROM movements ${where})`;
  const [summaries, groups, options, channels] = await Promise.all([
    db.$queryRaw<Summary[]>(Prisma.sql`${filtered} SELECT count(*)::int AS count, coalesce(sum(amount), 0)::text AS total FROM filtered`),
    db.$queryRaw<Group[]>(Prisma.sql`${filtered}
      SELECT 'method' AS dimension, "methodId" AS id, method AS name, count(*)::int AS count, sum(amount)::text AS total FROM filtered GROUP BY "methodId", method
      UNION ALL
      SELECT 'bank' AS dimension, "bankId" AS id, bank AS name, count(*)::int AS count, sum(amount)::text AS total FROM filtered GROUP BY "bankId", bank`),
    db.$queryRaw<Array<{dimension: string; id: string; name: string}>>(Prisma.sql`WITH movements AS (${source})
      SELECT DISTINCT 'method' AS dimension, "methodId"::text AS id, method AS name FROM movements
      UNION SELECT DISTINCT 'bank', "bankId"::text, bank FROM movements WHERE "bankId" IS NOT NULL
      UNION SELECT DISTINCT 'type', type, type FROM movements`),
    kind === 'payments' ? Promise.resolve([]) : db.$queryRaw<Array<{id: number; name: string}>>(Prisma.sql`SELECT id, name FROM "IncomeSalesChannel" WHERE "workspaceId" = ${workspaceId} ORDER BY name`),
  ]);
  const summary = summaries[0];
  const total = Number(summary.total);
  const pages = Math.max(1, Math.ceil(summary.count / ledgerPageSize));
  const page = Math.min(filters.page, pages);
  const rows = await db.$queryRaw<Movement[]>(Prisma.sql`${filtered} SELECT id, "documentId", date, amount::text, party, description, method, bank, type FROM filtered ORDER BY date DESC NULLS LAST, id DESC LIMIT ${ledgerPageSize} OFFSET ${(page - 1) * ledgerPageSize}`);
  return {summary, total, groups, options, channels, rows, page, pages};
}
