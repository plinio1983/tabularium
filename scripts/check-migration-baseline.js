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

const client = new pg.Client({ connectionString: databaseUrl });
try {
  await client.connect();
  const result = await client.query(`
    SELECT
      to_regclass('"Workspace"') IS NOT NULL AS "hasApplicationTables",
      to_regclass('"_prisma_migrations"') IS NOT NULL AS "hasMigrationTable"
  `);
  const state = result.rows[0];
  if (state?.hasApplicationTables && !state?.hasMigrationTable) process.exitCode = 10;
} finally {
  await client.end();
}
