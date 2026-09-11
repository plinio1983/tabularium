import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL('../app/api/expenses/[id]/payments/[paymentId]/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
function setup(amounts: number[], options: {missing?: boolean; forbidden?: boolean; conflict?: boolean} = {}) {
  const payments = amounts.map((amount, index) => ({id: index + 10, amount, paymentDate: new Date(`2026-09-${index + 10}`)}));
  const writes: any[] = [];
  let reads = 0;
  const tx = {
    expense: {
      findFirst: async ({where}: any) => {
        assert.equal(where.id, 5);
        assert.equal(where.workspaceId, 2);
        assert.equal(where.companyId, 3);
        reads++;
        return options.missing ? null : {amount: 100, payments};
      },
      update: async (args: any) => {writes.push(args.data);},
    },
    expensePayment: {delete: async ({where}: any) => {assert.equal(where.id, 10); writes.push('delete');}},
    auditLog: {create: async () => {writes.push('audit');}},
  };
  let attempts = 0;
  const mocks: Record<string, unknown> = {
    '@/lib/auth': {workspaceOperationalRoles: [], getWorkspaceApiAccess: async () => options.forbidden
      ? {ok: false, status: 403, error: 'Non autorizzato'}
      : {ok: true, current: {workspace: {id: 2}, company: {id: 3}, user: {id: 4}}}},
    '@/lib/prisma': {prisma: {$transaction: async (callback: any, config: any) => {
      assert.equal(config.isolationLevel, 'Serializable');
      if (options.conflict && attempts++ === 0) throw {code: 'P2034'};
      return callback(tx);
    }}},
  };
  const exports: any = {};
  runInNewContext(compiled, {exports, require: (name: string) => mocks[name] ?? require(name), console});
  return {writes, reads: () => reads, remove: async (paymentId = '10') => {
    const form = new FormData(); form.set('_action', 'delete');
    return exports.POST(new Request('http://localhost/api/expenses/5/payments/10', {method: 'POST', body: form}), {params: Promise.resolve({id: '5', paymentId})}) as Promise<Response>;
  }};
}

test('elimina un pagamento e ricalcola saldo parziale senza riscrivere gli altri movimenti', async () => {
  const {remove, writes} = setup([60, 40]);
  assert.equal((await remove()).status, 200);
  assert.equal(writes[0], 'delete');
  assert.equal(writes[1].paidAmount, 40);
  assert.equal(writes[1].paymentStatus, 'PAGATO_PARZIALMENTE');
  assert.equal(writes[1].isComplete, false);
  assert.equal(writes[1].paymentDate.toISOString(), '2026-09-11T00:00:00.000Z');
  assert.equal(writes[1].payments, undefined);
  assert.equal(writes[2], 'audit');
});

test('eliminando l’ultimo pagamento la spesa torna da pagare', async () => {
  const {remove, writes} = setup([100]);
  assert.equal((await remove()).status, 200);
  assert.equal(writes[1].paidAmount, 0);
  assert.equal(writes[1].paymentStatus, 'DA_PAGARE');
  assert.equal(writes[1].paymentDate, null);
  assert.equal(writes[1].isComplete, false);
});

test('totali in centesimi e stato completato se i pagamenti residui coprono ancora il totale', async () => {
  const {remove, writes} = setup([10, 33.33, 66.67]);
  assert.equal((await remove()).status, 200);
  assert.equal(writes[1].paidAmount, 100);
  assert.equal(writes[1].paymentStatus, 'COMPLETATO');
  assert.equal(writes[1].isComplete, true);
});

test('spesa di altra azienda o pagamento non appartenente alla spesa: nessuna scrittura', async () => {
  for (const scenario of [{missing: true, id: '10'}, {missing: false, id: '999'}]) {
    const {remove, writes} = setup([100], scenario);
    assert.equal((await remove(scenario.id)).status, 404);
    assert.equal(writes.length, 0);
  }
});

test('autorizzazione e identificativi controllati prima di accedere ai dati', async () => {
  const forbidden = setup([100], {forbidden: true});
  assert.equal((await forbidden.remove()).status, 403);
  assert.equal(forbidden.reads(), 0);
  const invalid = setup([100]);
  assert.equal((await invalid.remove('NaN')).status, 400);
  assert.equal(invalid.reads(), 0);
});

test('un conflitto concorrente ritenta la transazione', async () => {
  const {remove, writes} = setup([100], {conflict: true});
  assert.equal((await remove()).status, 200);
  assert.equal(writes.length, 3);
});
