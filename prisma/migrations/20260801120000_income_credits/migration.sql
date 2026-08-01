ALTER TABLE "Income" ADD COLUMN "expectedCreditDate" TIMESTAMP(3);

UPDATE "Income"
SET "expectedCreditDate" = "creditDate"
WHERE "isCredited" = false;

CREATE TABLE "IncomeCredit" (
    "id" SERIAL NOT NULL,
    "incomeId" INTEGER NOT NULL,
    "creditDate" TIMESTAMP(3) NOT NULL,
    "paymentMethodId" INTEGER NOT NULL,
    "bankId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomeCredit_pkey" PRIMARY KEY ("id")
);

INSERT INTO "IncomeCredit" ("incomeId", "creditDate", "paymentMethodId", "bankId", "amount", "createdAt")
SELECT "id", "creditDate", "paymentMethodId", "creditBankId", "amount", "createdAt"
FROM "Income"
WHERE "isCredited" = true;

CREATE INDEX "IncomeCredit_incomeId_idx" ON "IncomeCredit"("incomeId");
CREATE INDEX "IncomeCredit_creditDate_idx" ON "IncomeCredit"("creditDate");
CREATE INDEX "IncomeCredit_paymentMethodId_idx" ON "IncomeCredit"("paymentMethodId");
CREATE INDEX "IncomeCredit_bankId_idx" ON "IncomeCredit"("bankId");

ALTER TABLE "IncomeCredit" ADD CONSTRAINT "IncomeCredit_incomeId_fkey"
FOREIGN KEY ("incomeId") REFERENCES "Income"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncomeCredit" ADD CONSTRAINT "IncomeCredit_paymentMethodId_fkey"
FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncomeCredit" ADD CONSTRAINT "IncomeCredit_bankId_fkey"
FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
