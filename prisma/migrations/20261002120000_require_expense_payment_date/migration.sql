-- Do not invent dates for existing payments. Deployment fails if any are missing;
-- those records must be corrected using their actual payment date first.
ALTER TABLE "ExpensePayment" ALTER COLUMN "paymentDate" SET NOT NULL;
