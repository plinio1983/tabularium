import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {companyUsageSelect, companyUsageSummary} from '../lib/company-usage';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL('../lib/company-management.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
}).outputText;
const empty = () => Object.fromEntries(Object.keys(companyUsageSelect).map(key => [key, 0]));
const company = (id: number, extra = {}) => ({id, workspaceId: 2, name: `Società ${id}`, code: `S${id}`, isActive: true, isDefault: id === 1, _count: empty(), ...extra});
function setup(companies = [company(1), company(2)], options: {auditFails?: boolean; conflicts?: number} = {}) {
  let state: any = {companies, sessions: [{workspaceId: 2, activeCompanyId: 1}, {workspaceId: 2, activeCompanyId: 1}, {workspaceId: 2, activeCompanyId: 2}], audits: []};
  let attempts = 0;
  const matches = (row: any, where: any) => Object.entries(where).every(([key, value]: [string, any]) => value && typeof value === 'object' ? row[key] !== value.not : row[key] === value);
  const prisma = {$transaction: async (run: Function, config: any) => {
    assert.equal(config.isolationLevel, 'Serializable');
    attempts++;
    if (attempts <= (options.conflicts ?? 0)) throw {code: 'P2034'};
    const draft = structuredClone(state);
    const tx = {
      $queryRaw: async () => [],
      company: {
        findFirst: async ({where}: any) => draft.companies.filter((row: any) => matches(row, where)).sort((a: any, b: any) => Number(b.isDefault) - Number(a.isDefault) || a.id - b.id)[0] ?? null,
        updateMany: async ({where, data}: any) => {draft.companies.filter((row: any) => matches(row, where)).forEach((row: any) => Object.assign(row, data));},
        update: async ({where, data}: any) => {Object.assign(draft.companies.find((row: any) => matches(row, where)), data);},
        delete: async ({where}: any) => {draft.companies = draft.companies.filter((row: any) => !matches(row, where));}
      },
      authSession: {updateMany: async ({where, data}: any) => {draft.sessions.filter((row: any) => matches(row, where)).forEach((row: any) => Object.assign(row, data));}},
      auditLog: {create: async ({data}: any) => {if (options.auditFails) throw new Error('audit unavailable'); draft.audits.push(data);}}
    };
    const result = await run(tx);
    state = draft;
    return result;
  }};
  const exports: any = {};
  runInNewContext(compiled, {exports, require: (name: string) => name === '@/lib/prisma' ? {prisma} : name === './company-usage' ? {companyUsageSelect, companyUsageSummary} : require(name)});
  return {change: exports.changeCompany, state: () => state, attempts: () => attempts};
}

test('elimina la società vuota in uso, sposta tutte le sessioni e la predefinita e registra audit', async () => {
  const app = setup();
  assert.equal((await app.change('delete', 1, 2, 9)).saved, 'deleted');
  assert.deepEqual(app.state().companies.map((row: any) => [row.id, row.isDefault]), [[2, true]]);
  assert.ok(app.state().sessions.every((row: any) => row.activeCompanyId === 2));
  assert.equal(app.state().audits[0].action, 'DELETE');
  assert.equal(app.state().audits[0].metadata.companyName, 'Società 1');
});

test('ogni relazione collegata impedisce la cancellazione, inclusi dipendenti e ricorrenze', async () => {
  for (const key of Object.keys(companyUsageSelect)) {
    const app = setup([company(1, {_count: {...empty(), [key]: 1}}), company(2)]);
    assert.equal((await app.change('delete', 1, 2, 9)).error, 'in_use', key);
    assert.equal(app.state().companies.length, 2);
    assert.equal(app.state().audits.length, 0);
    assert.equal(app.state().sessions[0].activeCompanyId, 1);
  }
});

test('non elimina né disabilita l’ultima società abilitata anche con altre disabilitate', async () => {
  for (const operation of ['delete', 'toggle']) {
    const app = setup([company(1), company(2, {isActive: false})]);
    assert.equal((await app.change(operation, 1, 2, 9)).error, 'last_active');
    assert.equal(app.state().companies[0].isActive, true);
  }
});

test('può eliminare una società disabilitata se resta una società abilitata', async () => {
  const app = setup([company(1), company(2, {isActive: false})]);
  assert.equal((await app.change('delete', 2, 2, 9)).saved, 'deleted');
  assert.equal(app.state().companies[0].isDefault, true);
});

test('ID non validi, società assenti e di altri workspace non vengono modificati', async () => {
  for (const id of [NaN, -1, 1.5, 99, 3]) {
    const app = setup([company(1), company(3, {workspaceId: 5})]);
    assert.equal((await app.change('delete', id, 2, 9)).error, 'not_found');
    assert.equal(app.state().companies.length, 2);
    assert.equal(app.state().audits.length, 0);
  }
});

test('disabilitazione e cambio della predefinita aggiornano coerentemente la configurazione', async () => {
  const app = setup();
  assert.equal((await app.change('toggle', 1, 2, 9)).saved, 'status');
  assert.equal(app.state().companies[0].isActive, false);
  assert.equal(app.state().companies[0].isDefault, false);
  assert.equal(app.state().companies[1].isDefault, true);
  assert.equal((await app.change('default', 1, 2, 9)).error, 'not_found');
  await app.change('toggle', 1, 2, 9);
  await app.change('default', 1, 2, 9);
  assert.deepEqual(app.state().companies.map((row: any) => row.isDefault), [true, false]);
});

test('un errore audit annulla anche eliminazione, sessioni e cambio predefinita', async () => {
  const app = setup(undefined, {auditFails: true});
  const before = structuredClone(app.state());
  await assert.rejects(app.change('delete', 1, 2, 9), /audit unavailable/);
  assert.deepEqual(app.state(), before);
});

test('ritenta i conflitti transazionali e restituisce un errore comprensibile dopo tre tentativi', async () => {
  const recoverable = setup(undefined, {conflicts: 1});
  assert.equal((await recoverable.change('delete', 1, 2, 9)).saved, 'deleted');
  assert.equal(recoverable.attempts(), 2);
  const app = setup(undefined, {conflicts: 3});
  assert.equal((await app.change('delete', 1, 2, 9)).error, 'conflict');
  assert.equal(app.attempts(), 3);
  assert.equal(app.state().companies.length, 2);
});

test('l’azione server richiede i ruoli di gestione e usa il workspace della sessione', async () => {
  const source = ts.transpileModule(readFileSync(new URL('../app/settings/company-settings/actions.ts', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
  }).outputText;
  for (const allowed of [false, true]) {
    const calls: unknown[][] = [];
    const exports: any = {};
    const mocks: Record<string, unknown> = {
      '@/lib/auth': {workspaceManagementRoles: ['OWNER', 'ADMIN'], requireWorkspaceRole: async (roles: string[]) => {
        assert.deepEqual(roles, ['OWNER', 'ADMIN']);
        if (!allowed) throw new Error('Forbidden');
        return {workspace: {id: 2}, user: {id: 9}};
      }},
      '@/lib/prisma': {prisma: {}}, '@/lib/company-time': {},
      '@/lib/company-management': {changeCompany: async (...args: unknown[]) => {calls.push(args); return {saved: 'deleted'};}},
      'next/navigation': {redirect: (url: string) => {throw new Error(url);}}
    };
    runInNewContext(source, {exports, require: (name: string) => mocks[name] ?? require(name)});
    const form = new FormData(); form.set('id', '1'); form.set('workspaceId', '999');
    await assert.rejects(exports.deleteCompanyAction(form), allowed ? /saved=deleted/ : /Forbidden/);
    assert.deepEqual(calls, allowed ? [['delete', 1, 2, 9]] : []);
  }
});

test('la conferma include il nome della società e l’annullamento impedisce l’invio', () => {
  const source = ts.transpileModule(readFileSync(new URL('../app/settings/company-settings/CompanyDeleteForm.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
  }).outputText;
  const exports: any = {};
  let message = '', prevented = false;
  runInNewContext(source, {exports, require, window: {confirm: (value: string) => {message = value; return false;}}});
  const form = exports.default({id: 1, name: 'Società di prova', action: async () => {}});
  form.props.onSubmit({preventDefault() {prevented = true;}});
  assert.ok(message.includes('Società di prova'));
  assert.equal(prevented, true);
});
