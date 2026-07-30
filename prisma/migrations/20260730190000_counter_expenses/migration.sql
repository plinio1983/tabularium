ALTER TYPE "ExpenseType" ADD VALUE IF NOT EXISTS 'COUNTER';
ALTER TYPE "SupplierSystemRole" ADD VALUE IF NOT EXISTS 'COUNTER_MERCHANT';

ALTER TABLE "Expense" ADD COLUMN "counterExpenseRequestId" TEXT;

CREATE UNIQUE INDEX "Expense_workspaceId_counterExpenseRequestId_key"
ON "Expense"("workspaceId", "counterExpenseRequestId");
