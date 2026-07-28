-- Convert the legacy fixed company code to a workspace-local free code.
ALTER TABLE "Company" ALTER COLUMN "code" TYPE TEXT USING "code"::text;
DROP INDEX IF EXISTS "Company_code_key";

ALTER TABLE "Company"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "vatNumber" TEXT,
  ADD COLUMN "taxCode" TEXT,
  ADD COLUMN "pec" TEXT,
  ADD COLUMN "sdiCode" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Attach legacy global companies when all of their movements identify one
-- unambiguous workspace.
WITH company_workspaces AS (
  SELECT "companyId", MIN("workspaceId") AS "workspaceId"
  FROM (
    SELECT "companyId", "workspaceId" FROM "Expense"
    WHERE "companyId" IS NOT NULL AND "workspaceId" IS NOT NULL
    UNION ALL
    SELECT "companyId", "workspaceId" FROM "MonthlyRevenue"
    WHERE "workspaceId" IS NOT NULL
  ) references_by_workspace
  GROUP BY "companyId"
  HAVING COUNT(DISTINCT "workspaceId") = 1
)
UPDATE "Company" c
SET "workspaceId" = cw."workspaceId"
FROM company_workspaces cw
WHERE c.id = cw."companyId" AND c."workspaceId" IS NULL;

-- Legacy orphan companies were global defaults. Duplicate them only where needed
-- through the workspace default created below instead of guessing ownership.
INSERT INTO "Company" ("code", "name", "workspaceId", "isActive", "isDefault", "createdAt", "updatedAt")
SELECT 'MAIN', w."name", w."id", true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workspace" w
WHERE NOT EXISTS (
  SELECT 1 FROM "Company" c WHERE c."workspaceId" = w."id"
);

-- Ensure one deterministic default for every workspace that already had companies.
WITH ranked AS (
  SELECT id, "workspaceId", ROW_NUMBER() OVER (PARTITION BY "workspaceId" ORDER BY id) AS rn
  FROM "Company"
  WHERE "workspaceId" IS NOT NULL
)
UPDATE "Company" c
SET "isDefault" = true
FROM ranked r
WHERE c.id = r.id AND r.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM "Company" d WHERE d."workspaceId" = r."workspaceId" AND d."isDefault" = true
  );

ALTER TABLE "Income" ADD COLUMN "companyId" INTEGER;
ALTER TABLE "RecurringExpense" ADD COLUMN "companyId" INTEGER;
ALTER TABLE "AuthSession" ADD COLUMN "activeCompanyId" INTEGER;

-- Preserve valid legacy expense assignments; otherwise use the workspace default.
UPDATE "Expense" e
SET "companyId" = (
  SELECT id FROM "Company"
  WHERE "workspaceId" = e."workspaceId"
  ORDER BY "isDefault" DESC, id
  LIMIT 1
)
WHERE e."companyId" IS NULL
   OR NOT EXISTS (
     SELECT 1 FROM "Company" existing
     WHERE existing.id = e."companyId" AND existing."workspaceId" = e."workspaceId"
   );

UPDATE "Income" i
SET "companyId" = (
  SELECT id FROM "Company"
  WHERE "workspaceId" = i."workspaceId"
  ORDER BY "isDefault" DESC, id
  LIMIT 1
);

UPDATE "RecurringExpense" r
SET "companyId" = (
  SELECT id FROM "Company"
  WHERE "workspaceId" = r."workspaceId"
  ORDER BY "isDefault" DESC, id
  LIMIT 1
);

UPDATE "MonthlyRevenue" r
SET "companyId" = (
  SELECT id FROM "Company"
  WHERE "workspaceId" = r."workspaceId"
  ORDER BY "isDefault" DESC, id
  LIMIT 1
)
WHERE r."workspaceId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Company" existing
    WHERE existing.id = r."companyId" AND existing."workspaceId" = r."workspaceId"
  );

UPDATE "AuthSession" s
SET "activeCompanyId" = (
  SELECT id FROM "Company"
  WHERE "workspaceId" = s."workspaceId" AND "isActive" = true
  ORDER BY "isDefault" DESC, id
  LIMIT 1
);

DELETE FROM "Company" WHERE "workspaceId" IS NULL;

ALTER TABLE "Company" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Income" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "RecurringExpense" ALTER COLUMN "companyId" SET NOT NULL;

CREATE UNIQUE INDEX "Company_workspaceId_code_key" ON "Company"("workspaceId", "code");
CREATE INDEX "AuthSession_activeCompanyId_idx" ON "AuthSession"("activeCompanyId");
CREATE INDEX "Expense_workspaceId_companyId_idx" ON "Expense"("workspaceId", "companyId");
CREATE INDEX "Income_workspaceId_companyId_idx" ON "Income"("workspaceId", "companyId");
CREATE INDEX "RecurringExpense_workspaceId_companyId_idx" ON "RecurringExpense"("workspaceId", "companyId");

ALTER TABLE "Company" DROP CONSTRAINT IF EXISTS "Company_workspaceId_fkey";
ALTER TABLE "Company"
  ADD CONSTRAINT "Company_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthSession"
  ADD CONSTRAINT "AuthSession_activeCompanyId_fkey"
  FOREIGN KEY ("activeCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Income"
  ADD CONSTRAINT "Income_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringExpense"
  ADD CONSTRAINT "RecurringExpense_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Expense already had a nullable legacy foreign key; replace it with RESTRICT.
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_companyId_fkey";
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TYPE IF EXISTS "CompanyCode";
