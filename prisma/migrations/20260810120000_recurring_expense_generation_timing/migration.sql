CREATE TYPE "RecurringExpenseGenerationTiming" AS ENUM (
  'FIRST_OF_MONTH',
  'DAYS_7_BEFORE',
  'DAYS_10_BEFORE',
  'DAYS_15_BEFORE',
  'DAYS_30_BEFORE',
  'ON_DUE_DATE'
);

ALTER TABLE "RecurringExpense"
ADD COLUMN "generationTiming" "RecurringExpenseGenerationTiming" NOT NULL DEFAULT 'FIRST_OF_MONTH';
