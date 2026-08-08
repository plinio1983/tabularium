-- Remember deleted generated occurrences so the recurring job does not recreate them.
CREATE TABLE "RecurringExpenseExclusion" (
    "id" SERIAL NOT NULL,
    "recurringExpenseId" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringExpenseExclusion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecurringExpenseExclusion_recurringExpenseId_periodKey_key"
ON "RecurringExpenseExclusion"("recurringExpenseId", "periodKey");

CREATE INDEX "RecurringExpenseExclusion_recurringExpenseId_idx"
ON "RecurringExpenseExclusion"("recurringExpenseId");

ALTER TABLE "RecurringExpenseExclusion"
ADD CONSTRAINT "RecurringExpenseExclusion_recurringExpenseId_fkey"
FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
