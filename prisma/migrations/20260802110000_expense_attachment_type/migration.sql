CREATE TYPE "ExpenseAttachmentType" AS ENUM ('INVOICE', 'DOCUMENT', 'PAYMENT_RECEIPT');

ALTER TABLE "ExpenseAttachment"
  ADD COLUMN "type" "ExpenseAttachmentType" NOT NULL DEFAULT 'DOCUMENT';

CREATE INDEX "ExpenseAttachment_type_idx" ON "ExpenseAttachment"("type");
