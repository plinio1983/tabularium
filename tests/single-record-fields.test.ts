import test from 'node:test';
import assert from 'node:assert/strict';
import {updateSingleRecordFields} from '../lib/single-record-fields';

function setup(kind: 'expenses' | 'incomes', overrides = {}) {
  const writes: any[] = [];
  const record = {id: 7, workspaceId: 2, companyId: 3, expenseType: 'STANDARD', incomeType: 'STANDARD', amount: 100,
    paidAmount: 40, payments: [{id: 9, amount: 40}], credits: [{id: 10, amount: 40}], isCredited: false, ...overrides};
  const model = {findFirst: async ({where}: any) => where.id === 7 && where.workspaceId === 2 && where.companyId === 3 ? record : null,
    update: async (value: any) => {writes.push(value.data); return record;}};
  const db: any = {$transaction: async (callback: any, options: any) => {assert.equal(options.isolationLevel, 'Serializable'); return callback({expense: model, income: model,
      supplier: {findFirst: async ({where}: any) => where.workspaceId === 2 && where.id === 4 ? {id: 4, businessName: 'Esercente'} : null},
      expenseCategory: {findFirst: async ({where}: any) => where.workspaceId === 2 && where.id === 5 ? {id: 5} : null},
      customer: {findFirst: async ({where}: any) => where.workspaceId === 2 && where.id === 4 ? {id: 4} : null},
      incomeSalesChannel: {findFirst: async ({where}: any) => where.workspaceId === 2 && where.id === 5 ? {id: 5} : null}
    });}};
  const submit = (data: Record<string, string>, ids = [7], workspaceId = 2, companyId = 3) => {
    const form = new FormData(); Object.entries(data).forEach(([key, value]) => form.set(key, value));
    return updateSingleRecordFields(db, kind, workspaceId, companyId, ids, form);
  };
  return {writes, submit};
}
for (const kind of ['expenses', 'incomes'] as const) {
  test(`${kind}: partial notes/details preserve movements and all unselected fields`, async () => {
    const app = setup(kind);
    await app.submit({bulkAction: 'change_notes', notes: '', amount: '0', paymentStatus: 'COMPLETATO', credits: '[]'});
    assert.deepEqual(app.writes[0], {notes: ''});
    await app.submit({bulkAction: 'change_details', amount: '80.50', description: 'Aggiornata', notes: 'Non modificare'});
    assert.deepEqual(app.writes[1], kind === 'expenses' ? {amount: 80.5, description: 'Aggiornata', paymentStatus: 'PAGATO_PARZIALMENTE'} : {amount: 80.5, description: 'Aggiornata', isCredited: false});
    await app.submit({bulkAction: 'change_details', amount: '40', description: 'Completo'});
    assert.equal(kind === 'expenses' ? app.writes[2].paymentStatus : app.writes[2].isCredited, kind === 'expenses' ? 'COMPLETATO' : true);
  });
  test(`${kind}: rejects overpayments, invalid amounts, other companies and specialized types`, async () => {
    const app = setup(kind);
    for (const amount of ['39.99', '-1', 'NaN', 'Infinity', '40.001', '10000000000']) await assert.rejects(app.submit({bulkAction: 'change_details', amount, description: 'Test'}));
    await assert.rejects(app.submit({bulkAction: 'change_notes'}, [7, 8]));
    await assert.rejects(app.submit({bulkAction: 'change_notes'}, [7], 99));
    await assert.rejects(app.submit({bulkAction: 'change_notes'}, [7], 2, 99));
    await assert.rejects(setup(kind, {expenseType: 'PAYROLL', incomeType: 'CASH_REGISTER'}).submit({bulkAction: 'change_notes'}));
    assert.equal(app.writes.length, 0);
  });
}
test('legacy completed credits cannot be removed by changing the document amount', async () => {
  const app = setup('incomes', {credits: [], isCredited: true});
  await assert.rejects(app.submit({bulkAction: 'change_details', amount: '50', description: 'Test'}));
  assert.equal(app.writes.length, 0);
});

for (const kind of ['expenses', 'incomes'] as const) {
  test(`${kind}: amount updates preserve description and grouped identity updates preserve amount and movements`, async () => {
    const app = setup(kind);
    await app.submit({bulkAction: 'change_amount', amount: '80', description: 'Ignore'});
    assert.equal('description' in app.writes[0], false);
    await assert.rejects(app.submit({bulkAction: 'change_amount', amount: '39'}));
    await app.submit({bulkAction: 'change_identity', supplierId: '4', categoryId: '5', customerId: '4', salesChannelId: '5', description: 'Nuova', amount: '1'});
    assert.deepEqual(app.writes[1], kind === 'expenses' ? {supplierId: 4, merchant: 'Esercente', categoryId: 5, description: 'Nuova'} : {customerId: 4, salesChannelId: 5, description: 'Nuova'});
    await assert.rejects(app.submit({bulkAction: 'change_identity', supplierId: '99', categoryId: '5', customerId: '99', salesChannelId: '5', description: 'Nuova'}));
    assert.equal(app.writes.length, 2);
  });
}
