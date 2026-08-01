CREATE TABLE "RecurringIncome" (
  "id" SERIAL NOT NULL,
  "workspaceId" INTEGER NOT NULL,
  "companyId" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "cadence" TEXT NOT NULL,
  "creditDay" INTEGER,
  "creditMonth" INTEGER,
  "isAutomaticCredit" BOOLEAN NOT NULL DEFAULT false,
  "billingPeriodMode" TEXT NOT NULL DEFAULT 'SAME_MONTH',
  "billingMonth" INTEGER,
  "customerId" INTEGER,
  "salesChannelId" INTEGER NOT NULL,
  "incomeCategoryId" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 22,
  "isFiscal" BOOLEAN NOT NULL DEFAULT true,
  "paymentMethodId" INTEGER,
  "bankId" INTEGER,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringIncome_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Income" ADD COLUMN "recurringIncomeId" INTEGER;
ALTER TABLE "Income" ADD COLUMN "recurringIncomePeriodKey" TEXT;
ALTER TABLE "IncomeCredit" ADD COLUMN "sourceKey" TEXT;

CREATE UNIQUE INDEX "Income_recurringIncomeId_recurringIncomePeriodKey_key" ON "Income"("recurringIncomeId", "recurringIncomePeriodKey");
CREATE UNIQUE INDEX "IncomeCredit_sourceKey_key" ON "IncomeCredit"("sourceKey");
CREATE INDEX "RecurringIncome_workspaceId_idx" ON "RecurringIncome"("workspaceId");
CREATE INDEX "RecurringIncome_workspaceId_companyId_idx" ON "RecurringIncome"("workspaceId", "companyId");
CREATE INDEX "RecurringIncome_startDate_idx" ON "RecurringIncome"("startDate");
CREATE INDEX "RecurringIncome_customerId_idx" ON "RecurringIncome"("customerId");
CREATE INDEX "RecurringIncome_isActive_idx" ON "RecurringIncome"("isActive");

ALTER TABLE "RecurringIncome" ADD CONSTRAINT "RecurringIncome_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringIncome" ADD CONSTRAINT "RecurringIncome_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringIncome" ADD CONSTRAINT "RecurringIncome_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringIncome" ADD CONSTRAINT "RecurringIncome_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "IncomeSalesChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringIncome" ADD CONSTRAINT "RecurringIncome_incomeCategoryId_fkey" FOREIGN KEY ("incomeCategoryId") REFERENCES "IncomeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringIncome" ADD CONSTRAINT "RecurringIncome_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringIncome" ADD CONSTRAINT "RecurringIncome_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_recurringIncomeId_fkey" FOREIGN KEY ("recurringIncomeId") REFERENCES "RecurringIncome"("id") ON DELETE SET NULL ON UPDATE CASCADE;
