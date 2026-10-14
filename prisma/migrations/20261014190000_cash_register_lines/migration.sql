ALTER TABLE "Income" ADD COLUMN "receiptFiscalAmount" DECIMAL(12,2), ADD COLUMN "receiptVatAmount" DECIMAL(12,2);
CREATE TABLE "IncomeReceiptLine" (
 "id" SERIAL PRIMARY KEY, "incomeId" INTEGER NOT NULL, "position" INTEGER NOT NULL,
 "amount" DECIMAL(12,2) NOT NULL, "isFiscal" BOOLEAN NOT NULL, "vatRate" DECIMAL(5,2) NOT NULL, "description" TEXT,
 CONSTRAINT "IncomeReceiptLine_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "Income"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "IncomeReceiptLine_valid_amount" CHECK ("amount" > 0),
 CONSTRAINT "IncomeReceiptLine_valid_vat" CHECK ("vatRate" IN (0,4,10,22) AND ("isFiscal" OR "vatRate" = 0))
);
CREATE UNIQUE INDEX "IncomeReceiptLine_incomeId_position_key" ON "IncomeReceiptLine"("incomeId", "position");
