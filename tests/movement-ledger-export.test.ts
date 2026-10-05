import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {ledgerExportLimit, movementLedgerCsv} from '../lib/movement-ledger-export';
import type {Movement} from '../lib/movement-ledger-data';

const require = createRequire(import.meta.url);
const row = (id: number): Movement => ({id, documentId: 8, date: new Date('2026-09-30T22:30:00Z'), amount: '10.50', party: '=Cliente', description: 'Test; "CSV"', method: 'Bonifico', methodIcon: null, bank: 'Conto', type: 'STANDARD'});
const compiled = ts.transpileModule(readFileSync(new URL('../app/api/exports/[entity]/route.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
function setup(rows: Movement[], denied = false, fail = false) {
  const queries: any[] = [];
  const exports: any = {};
  runInNewContext(compiled, {exports, URL, require: (name: string) => {
    if (name === '@/lib/auth') return {workspaceOperationalRoles: ['OWNER', 'ADMIN', 'ACCOUNTANT'], getWorkspaceApiAccess: async () => denied ? {ok: false, status: 403, error: 'Permessi insufficienti'} : {ok: true, current: {workspace: {id: 21}, company: {id: 32, timeZone: 'Europe/Rome'}}}};
    if (name === '@/lib/prisma') return {prisma: {$queryRaw: async (query: any) => {queries.push(query); if (fail) throw new Error('Database non disponibile'); return rows;}}};
    return require(name);
  }});
  return {queries, get: (entity: string, query = '') => exports.GET(new Request(`http://localhost/api/exports/${entity}?${query}`), {params: Promise.resolve({entity})}) as Promise<Response>};
}

test('CSV: una riga per movimento, decimali precisi, date locali, valori mancanti e protezione formule', () => {
  const csv = movementLedgerCsv('payments', [row(1), {...row(2), date: null, bank: 'Non specificato', type: 'PAYROLL'}], 'Europe/Rome');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"ID spesa"/);
  assert.match(csv, /"2026-10-01";"10,50"/);
  assert.match(csv, /"'=Cliente"/);
  assert.match(csv, /"Test; ""CSV"""/);
  assert.match(csv, /"2";"";"10,50"/);
  assert.match(csv, /"Busta paga"/);
  assert.match(movementLedgerCsv('credits', [row(1)], 'Europe/Rome'), /"Cliente \/ canale".*"ID incasso"/);
});

test('download: tutti i risultati filtrati oltre la pagina, stessa ricerca e ordine, isolamento workspace/società', async () => {
  for (const entity of ['payments', 'credits']) {
    const app = setup(Array.from({length: 60}, (_, i) => row(i + 1)));
    const response = await app.get(entity, 'page=2&search=Cliente&methodId=3&bankId=4&type=STANDARD&salesChannelId=5&sort=amount&direction=asc&exportFrom=2026-09-01&exportTo=2026-09-30');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Disposition')!, /attachment; filename="(pagamenti|accrediti)-.*\.csv"/);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal((await response.text()).split('\r\n').length, 62);
    const query = app.queries[0];
    assert.match(query.sql, /ORDER BY filtered.amount ASC NULLS LAST, id DESC/);
    assert.doesNotMatch(query.sql, /OFFSET/);
    assert.match(query.sql, /d\."workspaceId" = \? AND d\."companyId" = \?/);
    assert.ok(query.values.includes(21) && query.values.includes(32));
    for (const value of ['Cliente', 3, 4, 'STANDARD', 5, ledgerExportLimit + 1]) assert.ok(query.values.includes(value));
    const dates = query.values.filter((value: any) => value instanceof Date);
    assert.deepEqual(dates.map((date: Date) => date.toISOString()), ['2026-08-31T22:00:00.000Z', '2026-09-30T22:00:00.000Z']);
  }
});

test('limite, risultati vuoti ed errori tornano alla lista con i filtri originali senza CSV parziali', async () => {
  for (const [rows, fail, error] of [[Array.from({length: ledgerExportLimit + 1}, (_, i) => row(i)), false, 'export_limit'], [[], false, 'export_empty'], [[], true, 'export_failed']] as const) {
    const response = await setup([...rows], false, fail).get('credits', 'search=Test&dateQuick=quarter_3&dateYear=2026&mobileList=1&page=2&exportFrom=2026-07-01&exportTo=2026-09-30');
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get('Location')!);
    assert.equal(location.pathname, '/incomes/credits');
    assert.equal(location.searchParams.get('error'), error);
    assert.equal(location.searchParams.get('search'), 'Test');
    assert.equal(location.searchParams.get('dateQuick'), 'quarter_3');
    assert.equal(location.searchParams.get('mobileList'), '1');
    assert.equal(location.searchParams.get('page'), '2');
    assert.equal(location.searchParams.has('exportFrom'), false);
    assert.equal(response.headers.has('Content-Disposition'), false);
  }
});

test('permessi e tipi non supportati impediscono la lettura dei dati', async () => {
  const denied = setup([row(1)], true);
  assert.equal((await denied.get('payments')).status, 403);
  assert.equal(denied.queries.length, 0);
  const unsupported = setup([row(1)]);
  assert.equal((await unsupported.get('expenses')).status, 404);
  assert.equal(unsupported.queries.length, 0);
});
