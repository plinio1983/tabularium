ALTER TABLE "IncomeSalesChannel"
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isFallback" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PaymentMethod"
ADD COLUMN "isExpenseDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isIncomeDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "IncomeSalesChannel_one_default_per_workspace"
ON "IncomeSalesChannel" ("workspaceId")
WHERE "isDefault" = true;

CREATE UNIQUE INDEX "IncomeSalesChannel_one_fallback_per_workspace"
ON "IncomeSalesChannel" ("workspaceId")
WHERE "isFallback" = true;

CREATE UNIQUE INDEX "PaymentMethod_one_expense_default_per_workspace"
ON "PaymentMethod" ("workspaceId")
WHERE "isExpenseDefault" = true;

CREATE UNIQUE INDEX "PaymentMethod_one_income_default_per_workspace"
ON "PaymentMethod" ("workspaceId")
WHERE "isIncomeDefault" = true;
