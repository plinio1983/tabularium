import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as companyTime from '../lib/company-time';
import * as dateFormat from '../lib/date-format';
import * as money from '../lib/money';

const require = createRequire(import.meta.url);
function load(file: string, mocks: Record<string, unknown>, globals = {}) {
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  runInNewContext(source, {exports, require: (id: string) => mocks[id] ?? require(id), URL, console: {error() {}}, ...globals});
  return exports;
}
const libraries = {'@/lib/company-time': companyTime, '@/lib/date-format': dateFormat, '@/lib/money': money};
const models = ['expense', 'income', 'recurringExpense', 'recurringIncome', 'supplier', 'customer', 'employee'];
const fixture = (id: number) => ({id, description: 'Olio', merchant: 'Bottega', amount: '12.50', receivedDate: new Date('2026-01-01'), creditDate: new Date('2026-01-02'), startDate: new Date('2025-01-01'), supplier: null, employee: null, taxAuthority: null, customer: null, businessName: 'Bottega', alias: null, vatNumber: '12345', firstName: 'Mario', lastName: 'Rossi', employeeCode: 'D01', taxCode: 'RSSMRA'});

test('dashboard search is bounded and scoped, ranks exact matches first and never filters by dashboard year', async () => {
  const queries: any[] = [];
  const db = Object.fromEntries(models.map(model => [model, {findMany: async (query: any) => {
    queries.push({model, ...query});
    return query.where.OR ? [fixture(99)] : [fixture(1), fixture(99), fixture(2), fixture(3), fixture(4)];
  }}]));
  const service = load('lib/dashboard-search.ts', {...libraries, '@/lib/prisma': {prisma: db}});
  const groups = await service.searchDashboard('  olio   ', {workspaceId: 2, companyId: 3});
  assert.equal(groups.length, 7);
  assert.equal(queries.length, 14);
  for (const query of queries) {
    assert.equal(query.where.workspaceId, 2);
    assert.equal(query.where.companyId, ['supplier', 'customer'].includes(query.model) ? undefined : 3);
    assert.equal(query.take, 5);
    assert.equal(query.where.year, undefined); assert.equal(query.where.billingYear, undefined);
    assert.equal(query.include, undefined);
    assert.ok(query.select.id);
  }
  for (const group of groups) {
    assert.deepEqual(Array.from(group.items, (item: any) => item.id), [99, 1, 2, 3, 4]);
    assert.equal(group.items[0].href, `/${group.key}/99`);
    assert.equal(Object.hasOwn(group.items[0], 'amount'), false);
  }
  assert.match(groups[0].items[0].subtitle, /12,50/);
});

test('short searches do not query, multiple words match across fields, input is normalized and capped', async () => {
  const queries: any[] = [];
  const db = Object.fromEntries(models.map(model => [model, {findMany: async (query: any) => {queries.push({model, ...query}); return [];}}]));
  const service = load('lib/dashboard-search.ts', {...libraries, '@/lib/prisma': {prisma: db}});
  assert.equal((await service.searchDashboard(' a ', {workspaceId: 2, companyId: 3})).length, 0);
  assert.equal(queries.length, 0);
  assert.equal(service.normalizeDashboardSearch(' x '.repeat(100)).length, 120);
  const groups = await service.searchDashboard(' Mario   Rossi ', {workspaceId: 2, companyId: 3});
  assert.equal(groups.length, 0);
  const employee = queries.find(query => query.model === 'employee' && query.where.AND);
  assert.equal(employee.where.AND.length, 2);
  assert.equal(employee.where.AND[0].OR[0].firstName.contains, 'Mario');
  assert.equal(employee.where.AND[1].OR[1].lastName.contains, 'Rossi');
  assert.equal(employee.where.AND[0].OR[0].firstName.mode, 'insensitive');
});

test('dashboard search endpoint requires authentication and derives scope from session only', async () => {
  const endpoint = 'app/api/dashboard/search/route.ts';
  const req = new Request('http://localhost/api/dashboard/search?q=olio&workspaceId=88&companyId=99');
  const denied = load(endpoint, {'@/lib/auth': {getWorkspaceContext: async () => null}, '@/lib/dashboard-search': {searchDashboard() {assert.fail('No search without auth');}}});
  assert.equal((await denied.GET(req)).status, 401);
  const api = load(endpoint, {
    '@/lib/auth': {getWorkspaceContext: async () => ({workspace: {id: 2}, company: {id: 3}})},
    '@/lib/dashboard-search': {searchDashboard: async (q: string, context: any) => {assert.equal(q, 'olio'); assert.equal(context.workspaceId, 2); assert.equal(context.companyId, 3); return [];}},
  });
  const response = await api.GET(req);
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await response.json(), {groups: []});
});

function nodes(tree: any): any[] {return Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];}
function uiHarness() {
  const state: any[] = [], effects: any[] = [], timers = new Map<number, Function>(), requests: any[] = [], navigations: string[] = [];
  let cursor = 0, effectCursor = 0, timerId = 0;
  const Component = load('components/DashboardSearch.tsx', {
    react: {
      useState(initial: any) {const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (value: any) => {state[i] = typeof value === 'function' ? value(state[i]) : value;}];},
      useId: () => 'search', useRef: () => ({current: null}),
      useEffect(callback: Function, deps: any[]) {
        const i = effectCursor++, prior = effects[i];
        if (!prior || deps.some((dep, j) => dep !== prior.deps[j])) {prior?.cleanup?.(); effects[i] = {deps, callback, pending: true};}
      },
    },
    'next/link': {default: 'Link'},
    'next/navigation': {useRouter: () => ({push: (href: string) => navigations.push(href)}), usePathname: () => '/', useSearchParams: () => new URLSearchParams('year=2025')},
    '@/components/SearchIcon': {default: 'SearchIcon'},
  }, {
    AbortController,
    window: {setTimeout: (fn: Function) => {timers.set(++timerId, fn); return timerId;}, clearTimeout: (id: number) => timers.delete(id)},
    document: {addEventListener() {}, removeEventListener() {}, getElementById: () => null},
    fetch: (url: string, options: any) => new Promise(resolve => requests.push({url, signal: options.signal, resolve})),
  }).default;
  const render = () => {
    cursor = 0; effectCursor = 0;
    const result = nodes(Component());
    effects.forEach(effect => {if (effect.pending) {effect.pending = false; effect.cleanup = effect.callback();}});
    return result;
  };
  const type = (value: string) => {render().find(node => node.type === 'input').props.onChange({target: {value}}); render();};
  const tick = () => {for (const [id, fn] of timers) {timers.delete(id); fn();}};
  const respond = async (index: number, title: string) => {
    requests[index].resolve({ok: true, json: async () => ({groups: [{key: 'expenses', label: 'Spese', items: [{id: 1, title, subtitle: '12 €', href: '/expenses/1'}]}]})});
    await new Promise(resolve => setImmediate(resolve));
  };
  return {render, type, tick, respond, requests, navigations};
}

test('autosuggest debounces, cancels superseded requests and ignores out-of-order responses', async () => {
  const ui = uiHarness();
  ui.type('a'); ui.tick(); assert.equal(ui.requests.length, 0);
  ui.type('al'); ui.type('alp'); ui.tick(); assert.equal(ui.requests.length, 1);
  assert.match(ui.requests[0].url, /q=alp$/);
  ui.type('beta'); ui.tick(); assert.equal(ui.requests[0].signal.aborted, true);
  await ui.respond(1, 'Risultato nuovo');
  await ui.respond(0, 'Risultato vecchio');
  const results = ui.render().filter(node => node.type === 'Link');
  assert.equal(results.length, 1);
  assert.equal(results[0].props.children[0].props.children, 'Risultato nuovo');
  assert.equal(results[0].props.href, '/expenses/1?returnTo=%2F%3Fyear%3D2025');
});

test('keyboard selection opens an existing detail and Escape closes suggestions without navigating', async () => {
  const ui = uiHarness(); ui.type('olio'); ui.tick(); await ui.respond(0, 'Olio');
  const key = (value: string) => ui.render().find(node => node.type === 'input').props.onKeyDown({key: value, nativeEvent: {}, preventDefault() {}});
  key('ArrowDown'); key('Enter');
  assert.deepEqual(ui.navigations, ['/expenses/1?returnTo=%2F%3Fyear%3D2025']);
  key('ArrowDown'); key('Escape');
  assert.equal(ui.render().some(node => node.props.role === 'listbox'), false);
  assert.equal(ui.navigations.length, 1);
});

test('failed searches show an error and clearing removes suggestions without navigation', async () => {
  const ui = uiHarness(); ui.type('olio'); ui.tick();
  ui.requests[0].resolve({ok: false});
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(ui.render().some(node => node.props.role === 'status' && node.props.children === 'Ricerca non disponibile. Riprova.'));
  ui.render().find(node => node.props['aria-label'] === 'Cancella ricerca').props.onClick();
  assert.equal(ui.render().find(node => node.type === 'input').props.value, '');
  assert.equal(ui.render().some(node => node.props.role === 'listbox'), false);
  assert.equal(ui.navigations.length, 0);
});
