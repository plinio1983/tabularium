ALTER TABLE "RecurringExpense"
  ADD COLUMN "expenseType" "ExpenseType" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "taxAuthorityId" INTEGER,
  ADD COLUMN "employeeId" INTEGER,
  ADD COLUMN "payrollNetAmount" DECIMAL(12,2),
  ADD COLUMN "payrollExtraCompensation" DECIMAL(12,2),
  ADD COLUMN "payrollGrossAmount" DECIMAL(12,2),
  ADD COLUMN "payrollEmployerCost" DECIMAL(12,2),
  ADD COLUMN "payrollPeriodMode" TEXT,
  ADD COLUMN "payrollPeriodMonthOffset" INTEGER,
  ADD COLUMN "payrollPeriodStartDay" INTEGER,
  ADD COLUMN "payrollPeriodEndDay" INTEGER,
  ADD COLUMN "affectsFiscalProfit" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "RecurringExpense"
  ADD CONSTRAINT "RecurringExpense_taxAuthorityId_fkey"
  FOREIGN KEY ("taxAuthorityId") REFERENCES "TaxAuthority"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecurringExpense"
  ADD CONSTRAINT "RecurringExpense_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "RecurringExpense_taxAuthorityId_idx" ON "RecurringExpense"("taxAuthorityId");
CREATE INDEX "RecurringExpense_employeeId_idx" ON "RecurringExpense"("employeeId");
CREATE INDEX "RecurringExpense_expenseType_idx" ON "RecurringExpense"("expenseType");
