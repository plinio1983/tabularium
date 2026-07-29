ALTER TABLE "Company"
ADD COLUMN "primaryBankId" INTEGER;

CREATE INDEX "Company_primaryBankId_idx" ON "Company"("primaryBankId");

ALTER TABLE "Company"
ADD CONSTRAINT "Company_primaryBankId_fkey"
FOREIGN KEY ("primaryBankId") REFERENCES "Bank"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
