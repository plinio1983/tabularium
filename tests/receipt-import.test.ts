import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes} from 'node:crypto';
import {PrismaClient} from '../generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {getDatabaseUrl} from '../lib/database-url';
import {exportReceiptCsv, parseReceiptCsv, type ReceiptCsvRow} from '../lib/receipt-csv';
import {prepareReceiptImport, commitReceiptImport, receiptInclude, receiptToCsvRow} from '../lib/receipt-import';

const sample: ReceiptCsvRow = {origin: 'shop-1', date: '2026-10-25T01:30:00.000Z', description: 'Vendita; "speciale"\nSeconda riga', amount: '12.50', fiscal: true, vat: '0', channelCode: 'SHOP', channel: 'Negozio', method: 'Contanti', bank: 'Cassa', period: '2026-10', notes: "'=nota letterale"};

test('PostgreSQL: receipt import is atomic, repeatable, scoped and preserves export data', {skip: process.env.RECEIPT_TEST_DATABASE !== '1'}, async () => {
  const schema = `receipt_csv_test_${randomBytes(6).toString('hex')}`;
  const db = new PrismaClient({adapter: new PrismaPg({connectionString: getDatabaseUrl()}, {schema})});
  try {
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    for (const [name, values] of Object.entries({IncomeType: ['STANDARD', 'CASH_REGISTER'], PaymentMethodSystemRole: ['CASH'], CustomerSystemRole: ['DEFAULT', 'CASH_REGISTER']})) {
      await db.$executeRawUnsafe(`CREATE TYPE "${schema}"."${name}" AS ENUM (${values.map(value => `'${value}'`).join(',')})`);
    }
    for (const table of ['Income', 'IncomeCredit', 'IncomeSalesChannel', 'PaymentMethod', 'Bank', 'IncomeCategory', 'Customer']) {
      await db.$executeRawUnsafe(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
      // All defaults point at private sequences; production sequences are never used.
      await db.$executeRawUnsafe(`CREATE SEQUENCE "${schema}"."${table}_test_seq" START 100`);
      await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN id SET DEFAULT nextval('"${schema}"."${table}_test_seq"')`);
    }
    for (const [table, column, type] of [['Income', 'incomeType', 'IncomeType'], ['PaymentMethod', 'systemRole', 'PaymentMethodSystemRole'], ['Customer', 'systemRole', 'CustomerSystemRole']]) {
      await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" DROP DEFAULT`);
      await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" TYPE "${schema}"."${type}" USING "${column}"::text::"${schema}"."${type}"`);
    }
    await db.incomeSalesChannel.create({data: {id: 1, workspaceId: 1, code: 'SHOP', name: 'Negozio'}});
    await db.paymentMethod.createMany({data: [{id: 1, workspaceId: 1, name: 'Contanti', systemRole: 'CASH', cashRegisterEnabled: true}, {id: 2, workspaceId: 1, name: 'Carta', cashRegisterEnabled: true}]});
    await db.bank.create({data: {id: 1, workspaceId: 1, name: 'Cassa'}});
    await db.incomeCategory.create({data: {id: 1, workspaceId: 1, code: 'DEFAULT', name: 'Predefinita'}});
    await db.customer.create({data: {id: 1, workspaceId: 1, businessName: 'Registratore', systemRole: 'CASH_REGISTER'}});
    const context = {workspaceId: 1, companyId: 1};
    const text = exportReceiptCsv([sample]);
    const plan = await prepareReceiptImport(db, text, context);
    assert.equal(plan.preview.counts.new, 1);
    assert.equal(await db.income.count(), 0, 'preview does not write');
    const commit = (csv: string, token: string, ctx = context) => db.$transaction(tx => commitReceiptImport(tx, csv, ctx, token), {isolationLevel: 'Serializable'});
    assert.deepEqual(await commit(text, plan.preview.token), {imported: 1, duplicates: 0});
    const stored = await db.income.findFirstOrThrow({include: receiptInclude});
    assert.equal(stored.incomeType, 'CASH_REGISTER');
    assert.equal(stored.credits.length, 1);
    assert.equal(stored.credits[0].amount.toString(), '12.5');
    assert.deepEqual(parseReceiptCsv(exportReceiptCsv([receiptToCsvRow(stored)]))[0].row, sample);
    const repeat = await prepareReceiptImport(db, text, context);
    assert.equal(repeat.preview.counts.duplicate, 1);
    assert.deepEqual(await commit(text, repeat.preview.token), {imported: 0, duplicates: 1});
    const conflictText = exportReceiptCsv([{...sample, amount: '15.00'}]);
    const conflict = await prepareReceiptImport(db, conflictText, context);
    assert.equal(conflict.preview.counts.conflict, 1);
    await assert.rejects(commit(conflictText, conflict.preview.token), /conflitti/);
    await assert.rejects(commit(text, plan.preview.token), /Anteprima cambiata/);
    const other = {workspaceId: 1, companyId: 2};
    const otherPlan = await prepareReceiptImport(db, text, other);
    assert.equal(otherPlan.preview.counts.new, 1);
    await commit(text, otherPlan.preview.token, other);
    assert.equal(await db.income.count(), 2);
    assert.equal((await prepareReceiptImport(db, text, {workspaceId: 2, companyId: 1})).preview.counts.invalid, 1);
    for (const change of [{method: 'Sconosciuto'}, {bank: 'Sconosciuta'}, {channelCode: 'MISSING'}, {fiscal: false, method: 'Carta'}]) {
      assert.equal((await prepareReceiptImport(db, exportReceiptCsv([{...sample, ...change}]), context)).preview.counts.invalid, 1);
    }
    const twins = exportReceiptCsv([{...sample, origin: 'twin-1'}, {...sample, origin: 'twin-2'}]);
    assert.equal((await prepareReceiptImport(db, twins, context)).preview.counts.new, 2);
    const repeatedFile = await prepareReceiptImport(db, exportReceiptCsv([{...sample, origin: 'new'}, {...sample, origin: 'new'}]), context);
    assert.equal(repeatedFile.preview.counts.new, 1); assert.equal(repeatedFile.preview.counts.duplicate, 1);
    const invalidBatch = exportReceiptCsv([{...sample, origin: 'good'}, {...sample, origin: 'bad', bank: 'Missing'}]);
    const invalidPlan = await prepareReceiptImport(db, invalidBatch, context);
    await assert.rejects(commit(invalidBatch, invalidPlan.preview.token), /errori/);
    assert.equal(await db.income.count(), 2);
    // A failure after the first insertion rolls back both documents and credits.
    await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."Income" ADD CONSTRAINT reject_test_notes CHECK (notes IS DISTINCT FROM 'FAIL')`);
    const batch = exportReceiptCsv([{...sample, origin: 'atomic-1'}, {...sample, origin: 'atomic-2', notes: 'FAIL'}]);
    const batchPlan = await prepareReceiptImport(db, batch, context);
    await assert.rejects(commit(batch, batchPlan.preview.token));
    assert.equal(await db.income.count(), 2); assert.equal(await db.incomeCredit.count(), 2);
    for (const requestId of ['eb55279b-7f98-4596-b63c-9c50eedcb210', null]) {
      const native = await db.income.update({where: {id: stored.id}, data: {cashRegisterRequestId: requestId}, include: receiptInclude});
      const nativeCsv = exportReceiptCsv([receiptToCsvRow(native)]);
      const nativePlan = await prepareReceiptImport(db, nativeCsv, context);
      assert.equal(nativePlan.preview.counts.duplicate, 1, 'native and legacy exports are recognized in their original company');
    }
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
