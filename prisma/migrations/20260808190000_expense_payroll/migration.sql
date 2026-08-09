ALTER TYPE "ExpenseType" ADD VALUE 'PAYROLL';

ALTER TABLE "Expense"
  ALTER COLUMN "supplierId" DROP NOT NULL,
  ADD COLUMN "employeeId" INTEGER,
  ADD COLUMN "payrollNetAmount" DECIMAL(12,2),
  ADD COLUMN "payrollExtraCompensation" DECIMAL(12,2),
  ADD COLUMN "payrollGrossAmount" DECIMAL(12,2),
  ADD COLUMN "payrollEmployerCost" DECIMAL(12,2);

CREATE INDEX "Expense_employeeId_idx" ON "Expense"("employeeId");

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
