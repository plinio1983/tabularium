import { prisma } from '../lib/prisma';

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "RecurringExpense"
    ADD COLUMN IF NOT EXISTS "isAutomaticPayment" boolean NOT NULL DEFAULT false;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'RecurringExpense'
          AND column_name = 'accrualType'
      ) THEN
        UPDATE "RecurringExpense"
        SET "isAutomaticPayment" = true
        WHERE "accrualType" IN ('AUTOMATICO', 'AUTOMATICA');

        ALTER TABLE "RecurringExpense" DROP COLUMN "accrualType";
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "Expense" e
    SET "isAutomaticPayment" = true
    FROM "RecurringExpense" r
    WHERE e."recurringExpenseId" = r.id
      AND r."isAutomaticPayment" = true;
  `);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
