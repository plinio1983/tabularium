import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL
  || `postgresql://${encodeURIComponent(process.env.POSTGRES_USER || 'dms')}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || 'dms')}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5433'}/${process.env.POSTGRES_DB || 'dms_spese_ricavi'}?schema=public`;

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query('BEGIN');
  const workspaces = await client.query('SELECT id FROM "Workspace" ORDER BY id');
  let assigned = 0;

  for (const { id: workspaceId } of workspaces.rows) {
    const existing = await client.query(
      'SELECT id FROM "Customer" WHERE "workspaceId" = $1 AND "businessName" = $2 ORDER BY id LIMIT 1',
      [workspaceId, 'New customer']
    );
    let customerId = existing.rows[0]?.id;
    if (!customerId) {
      const created = await client.query(
        'INSERT INTO "Customer" ("businessName", "workspaceId", "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW()) RETURNING id',
        ['New customer', workspaceId]
      );
      customerId = created.rows[0].id;
    }
    const result = await client.query(
      'UPDATE "Income" SET "customerId" = $1 WHERE "workspaceId" = $2 AND "customerId" IS NULL',
      [customerId, workspaceId]
    );
    assigned += result.rowCount || 0;
  }

  await client.query('COMMIT');
  console.log(`Backfill clienti completato: ${assigned} incassi aggiornati in ${workspaces.rowCount} workspace.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
