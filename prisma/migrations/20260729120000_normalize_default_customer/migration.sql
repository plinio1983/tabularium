-- "New customer" is no longer a system-owned customer. Existing records keep
-- their identity and linked incomes, but follow the same rules as other customers.
UPDATE "Customer"
SET "systemRole" = NULL
WHERE "systemRole" = 'DEFAULT';
