ALTER TABLE "RecurringExpense"
  ADD COLUMN "endDate" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "RecurringIncome"
  ADD COLUMN "endDate" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "RecurringExpense_endDate_idx" ON "RecurringExpense"("endDate");
CREATE INDEX "RecurringIncome_endDate_idx" ON "RecurringIncome"("endDate");
