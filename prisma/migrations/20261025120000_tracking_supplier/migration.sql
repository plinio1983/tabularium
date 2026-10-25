ALTER TABLE "ProductTracking" ADD COLUMN "supplierId" INTEGER;
CREATE INDEX "ProductTracking_supplierId_idx" ON "ProductTracking"("supplierId");
ALTER TABLE "ProductTracking" ADD CONSTRAINT "ProductTracking_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
