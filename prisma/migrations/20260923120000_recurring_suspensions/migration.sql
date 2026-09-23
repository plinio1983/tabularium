ALTER TABLE "RecurringExpense" ADD COLUMN "suspensionPeriods" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "RecurringIncome" ADD COLUMN "suspensionPeriods" JSONB NOT NULL DEFAULT '[]';

-- Legacy inactive rules have no reliable suspension history. Prevent retroactive
-- generation on resume; preserve all occurrences that already exist.
UPDATE "RecurringExpense" SET "suspensionPeriods" = jsonb_build_array(jsonb_build_object('from', to_char("startDate", 'YYYY-MM-DD'), 'to', NULL)) WHERE NOT "isActive";
UPDATE "RecurringIncome" SET "suspensionPeriods" = jsonb_build_array(jsonb_build_object('from', to_char("startDate", 'YYYY-MM-DD'), 'to', NULL)) WHERE NOT "isActive";
