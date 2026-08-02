ALTER TYPE "ExpenseAttachmentType" RENAME TO "AttachmentType";

CREATE TABLE "IncomeAttachment" (
    "id" SERIAL NOT NULL,
    "incomeId" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "type" "AttachmentType" NOT NULL DEFAULT 'DOCUMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IncomeAttachment_incomeId_idx" ON "IncomeAttachment"("incomeId");
CREATE INDEX "IncomeAttachment_type_idx" ON "IncomeAttachment"("type");

ALTER TABLE "IncomeAttachment"
ADD CONSTRAINT "IncomeAttachment_incomeId_fkey"
FOREIGN KEY ("incomeId") REFERENCES "Income"("id") ON DELETE CASCADE ON UPDATE CASCADE;
