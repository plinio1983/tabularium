UPDATE "Company" AS company
SET "primaryBankId" = NULL
FROM "Bank" AS bank
WHERE company."primaryBankId" = bank.id
  AND bank."isFallback" = true;
