ALTER TABLE "Supplier"
ADD COLUMN "defaultVatRate" DECIMAL(5,2);

ALTER TABLE "Supplier"
ADD CONSTRAINT "Supplier_defaultVatRate_check"
CHECK ("defaultVatRate" IS NULL OR "defaultVatRate" IN (0, 4, 10, 22));
