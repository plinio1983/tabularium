-- IncomeCategory remains available for a possible future feature, but the
-- current application uses one technical category per workspace.
INSERT INTO "IncomeCategory" ("code", "name", "icon", "workspaceId")
SELECT 'DEFAULT', 'Predefinita', '•', w."id"
FROM "Workspace" w
WHERE NOT EXISTS (
  SELECT 1 FROM "IncomeCategory" c WHERE c."workspaceId" = w."id"
);

DO $$
DECLARE
  current_workspace_id INTEGER;
  default_category_id INTEGER;
BEGIN
  FOR current_workspace_id IN SELECT "id" FROM "Workspace" LOOP
    SELECT c."id"
      INTO default_category_id
    FROM "IncomeCategory" c
    WHERE c."workspaceId" = current_workspace_id
    ORDER BY
      CASE c."code"
        WHEN 'DEFAULT' THEN 0
        WHEN 'B2C' THEN 1
        ELSE 2
      END,
      c."id"
    LIMIT 1;

    UPDATE "Income"
    SET "incomeCategoryId" = default_category_id
    WHERE "workspaceId" = current_workspace_id
      AND "incomeCategoryId" <> default_category_id;

    UPDATE "RecurringIncome"
    SET "incomeCategoryId" = default_category_id
    WHERE "workspaceId" = current_workspace_id
      AND "incomeCategoryId" <> default_category_id;

    UPDATE "Workspace"
    SET "cashRegisterIncomeCategoryId" = default_category_id
    WHERE "id" = current_workspace_id
      AND "cashRegisterIncomeCategoryId" IS DISTINCT FROM default_category_id;

    DELETE FROM "IncomeCategory"
    WHERE "workspaceId" = current_workspace_id
      AND "id" <> default_category_id;

    UPDATE "IncomeCategory"
    SET "code" = 'DEFAULT',
        "name" = 'Predefinita',
        "icon" = '•'
    WHERE "id" = default_category_id;
  END LOOP;
END $$;
