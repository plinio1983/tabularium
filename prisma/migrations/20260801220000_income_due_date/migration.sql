ALTER TABLE "Income"
RENAME COLUMN "expectedCreditDate" TO "dueDate";

-- Existing open incomes used creditDate as their expected collection date.
UPDATE "Income"
SET "dueDate" = "creditDate"
WHERE "isCredited" = false
  AND "dueDate" IS NULL;

CREATE INDEX "Income_dueDate_idx" ON "Income"("dueDate");
