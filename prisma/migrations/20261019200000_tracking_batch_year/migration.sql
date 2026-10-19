ALTER TABLE "ProductTracking" ADD COLUMN "batchYear" INTEGER;
UPDATE "ProductTracking" AS tracking
SET "batchYear" = EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE company."timeZone")::INTEGER
FROM "Company" AS company WHERE company.id = tracking."companyId";
ALTER TABLE "ProductTracking" ALTER COLUMN "batchYear" SET NOT NULL;
ALTER TABLE "ProductTracking" ADD CONSTRAINT "ProductTracking_batchYear_check" CHECK ("batchYear" BETWEEN 1000 AND 9999);
