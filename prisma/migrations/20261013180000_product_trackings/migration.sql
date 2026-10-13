CREATE TYPE "ProductTrackingAttachmentKind" AS ENUM ('INVOICE', 'TRACKING');
CREATE TABLE "ProductTracking" (
 "id" SERIAL PRIMARY KEY, "workspaceId" INTEGER NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
 "companyId" INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
 "name" TEXT NOT NULL, "batch" TEXT NOT NULL, "alias" TEXT, "entryDate" DATE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ProductTrackingAttachment" (
 "id" SERIAL PRIMARY KEY, "trackingId" INTEGER NOT NULL REFERENCES "ProductTracking"("id") ON DELETE CASCADE,
 "kind" "ProductTrackingAttachmentKind" NOT NULL, "invoiceDate" DATE,
 "originalName" TEXT NOT NULL, "path" TEXT NOT NULL, "mimeType" TEXT, "sizeBytes" INTEGER,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "invoice_date_required" CHECK ("kind" <> 'INVOICE' OR "invoiceDate" IS NOT NULL)
);
CREATE INDEX "ProductTracking_workspaceId_companyId_createdAt_idx" ON "ProductTracking"("workspaceId", "companyId", "createdAt");
CREATE INDEX "ProductTracking_companyId_entryDate_idx" ON "ProductTracking"("companyId", "entryDate");
CREATE INDEX "ProductTrackingAttachment_trackingId_kind_idx" ON "ProductTrackingAttachment"("trackingId", "kind");
