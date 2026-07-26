import 'dotenv/config';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL ?? (() => {
  const { POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = process.env;
  if (!POSTGRES_HOST || !POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
    throw new Error('Configurazione database incompleta.');
  }
  const port = process.env.POSTGRES_PORT ?? '5432';
  const schema = process.env.POSTGRES_SCHEMA ?? 'public';
  return `postgresql://${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(POSTGRES_PASSWORD)}@${POSTGRES_HOST}:${port}/${encodeURIComponent(POSTGRES_DB)}?schema=${encodeURIComponent(schema)}`;
})();

const client = new pg.Client({connectionString: databaseUrl});

try {
  await client.connect();
  await client.query('ALTER TABLE "Income" ADD COLUMN IF NOT EXISTS "orderDate" TIMESTAMP(3)');
  const result = await client.query(`
    UPDATE "Income"
    SET "orderDate" = "creditDate"
    WHERE "orderDate" IS NULL
  `);
  await client.query('CREATE INDEX IF NOT EXISTS "Income_orderDate_idx" ON "Income"("orderDate")');
  console.log(`Date ordine incassi valorizzate: ${result.rowCount}.`);
} finally {
  await client.end();
}
