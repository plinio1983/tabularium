import assert from 'node:assert/strict';
import test from 'node:test';
import {ledgerFilters, ledgerWhere} from '../lib/movement-ledger';
import {loadMovementLedger} from '../lib/movement-ledger-data';

test('ledger filters validate page and ids and use company date boundaries', () => {
  const filters = ledgerFilters({page: '-1', methodId: 'bad', bankId: 'none', dateFrom: '2026-03-29', dateTo: '2026-03-29'}, '2026-09-10');
  assert.equal(filters.page, 1);
  assert.equal(filters.methodId, null);
  assert.equal(filters.noBank, true);
  const dates = ledgerWhere(filters, 'Europe/Rome').values.filter(value => value instanceof Date) as Date[];
  assert.equal(dates.length, 2);
  assert.equal(dates[1].getTime() - dates[0].getTime(), 23 * 3600000);
});

test('all dates and missing dates do not silently apply the default period', () => {
  for (const dateMode of ['all', 'undated']) {
    const where = ledgerWhere(ledgerFilters({dateMode}, '2026-09-10'), 'Europe/Rome');
    assert.equal(where.values.some(value => value instanceof Date), false);
    assert.equal(where.sql.includes('date IS NULL'), dateMode === 'undated');
  }
});

test('search values stay parameterized, including wildcards and SQL fragments', () => {
  const search = "%' OR 1=1 --";
  const where = ledgerWhere(ledgerFilters({search}, '2026-09-10'), 'Europe/Rome');
  assert.ok(where.values.includes(search));
  assert.ok(!where.sql.includes(search));
});

test('PostgreSQL: partial payments, payroll, credits, isolation, totals and pagination', {skip: process.env.LEDGER_TEST_DATABASE !== '1'}, async () => {
  const {prisma} = await import('../lib/prisma');
  try {
    await prisma.$transaction(async db => {
      // Temporary tables shadow the real tables for this connection only.
      const definitions = [
        '"PaymentMethod" (id int, name text)', '"Bank" (id int, name text)',
        '"Supplier" (id int, "businessName" text)', '"Employee" (id int, "firstName" text, "lastName" text)',
        '"Customer" (id int, "businessName" text)', '"IncomeSalesChannel" (id int, name text, "workspaceId" int)',
        '"Expense" (id int, "workspaceId" int, "companyId" int, "employeeId" int, "supplierId" int, merchant text, description text, "expenseType" text)',
        '"ExpensePayment" (id int, "expenseId" int, "paymentDate" timestamp, amount numeric(12,2), "paymentMethodId" int, "bankId" int)',
        '"Income" (id int, "workspaceId" int, "companyId" int, "customerId" int, "salesChannelId" int, description text, "incomeType" text)',
        '"IncomeCredit" (id int, "incomeId" int, "creditDate" timestamp, amount numeric(12,2), "paymentMethodId" int, "bankId" int)',
      ];
      for (const definition of definitions) await db.$executeRawUnsafe(`CREATE TEMP TABLE ${definition} ON COMMIT DROP`);
      const inserts = [
        `INSERT INTO "PaymentMethod" VALUES (1,'Bonifico'),(2,'Carta')`,
        `INSERT INTO "Bank" VALUES (1,'Conto A'),(2,'Conto B')`,
        `INSERT INTO "Supplier" VALUES (1,'Fornitore Uno')`,
        `INSERT INTO "Employee" VALUES (1,'Ada','Rossi')`,
        `INSERT INTO "Customer" VALUES (1,'Cliente Uno')`,
        `INSERT INTO "IncomeSalesChannel" VALUES (1,'Negozio',1)`,
        `INSERT INTO "Expense" VALUES (1,1,1,NULL,1,'Fornitore Uno','Parziale','STANDARD'),(2,1,1,1,NULL,'Dipendente','Stipendio','PAYROLL'),(3,1,2,NULL,1,'Altra società','','STANDARD'),(4,2,1,NULL,1,'Altro workspace','','STANDARD')`,
        `INSERT INTO "ExpensePayment" VALUES (1,1,'2026-09-01',40,1,1),(2,1,'2026-09-02',60,2,2),(3,2,'2026-09-03',1000,1,1),(4,1,NULL,20,1,NULL),(5,3,'2026-09-01',9999,1,1),(6,4,'2026-09-01',9999,1,1)`,
        `INSERT INTO "Income" VALUES (1,1,1,1,1,'Fattura','STANDARD'),(2,1,1,NULL,1,'Scontrino','CASH_REGISTER'),(3,1,2,1,1,'Altra società','STANDARD')`,
        `INSERT INTO "IncomeCredit" VALUES (1,1,'2026-09-01',30,1,1),(2,1,'2026-09-02',70,2,2),(3,2,'2026-09-03',50,2,1),(4,3,'2026-09-01',9999,1,1)`,
      ];
      for (const insert of inserts) await db.$executeRawUnsafe(insert);
      const filters = ledgerFilters({}, '2026-09-10');
      const payments = await loadMovementLedger(db, 'payments', 1, 1, 'Europe/Rome', filters);
      assert.equal(payments.summary.count, 3);
      assert.equal(payments.total, 1100);
      assert.equal(payments.rows[0].party, 'Ada Rossi');
      assert.equal(payments.rows.filter(row => row.documentId === 1).length, 2);
      for (const dimension of ['method','bank']) assert.equal(payments.groups.filter(group => group.dimension === dimension).reduce((sum, group) => sum + Number(group.total), 0), 1100);
      const undated = await loadMovementLedger(db, 'payments', 1, 1, 'Europe/Rome', ledgerFilters({dateMode:'undated',bankId:'none'}, '2026-09-10'));
      assert.equal(undated.total,20);
      assert.equal(undated.rows[0].date,null);
      const all = await loadMovementLedger(db, 'payments', 1, 1, 'Europe/Rome', ledgerFilters({dateMode:'all'}, '2026-09-10'));
      assert.equal(all.summary.count,4);
      assert.equal(all.total,1120);
      const payroll = await loadMovementLedger(db, 'payments', 1, 1, 'Europe/Rome', ledgerFilters({search:'Ada Rossi'}, '2026-09-10'));
      assert.equal(payroll.total,1000);
      const method = await loadMovementLedger(db, 'payments', 1, 1, 'Europe/Rome', ledgerFilters({methodId:'2',bankId:'2'}, '2026-09-10'));
      assert.equal(method.total,60);
      const credits = await loadMovementLedger(db, 'credits', 1, 1, 'Europe/Rome', filters);
      assert.equal(credits.total,150);
      assert.equal(credits.summary.count,3);
      assert.equal(credits.rows[0].party,'Negozio');
      const receipts = await loadMovementLedger(db, 'credits', 1, 1, 'Europe/Rome', ledgerFilters({type:'CASH_REGISTER',salesChannelId:'1'}, '2026-09-10'));
      assert.equal(receipts.total,50);
      await db.$executeRawUnsafe(`INSERT INTO "ExpensePayment" SELECT 100+i,1,'2026-09-04',1,1,1 FROM generate_series(1,60) i`);
      const paged = await loadMovementLedger(db, 'payments', 1, 1, 'Europe/Rome', ledgerFilters({page:'999'}, '2026-09-10'));
      assert.equal(paged.page,2);
      assert.equal(paged.rows.length,13);
      assert.equal(paged.total,1160);
      const empty = await loadMovementLedger(db, 'payments', 1, 1, 'Europe/Rome', ledgerFilters({search:'unmatched'}, '2026-09-10'));
      assert.equal(empty.total,0);
      assert.equal(empty.rows.length,0);
    }, {timeout: 30000});
  } finally { await prisma.$disconnect(); }
});
