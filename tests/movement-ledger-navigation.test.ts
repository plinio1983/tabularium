import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as ledger from '../lib/movement-ledger';
import * as liveSearch from '../lib/live-search';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../components/MovementLedgerPage.tsx', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}
}).outputText;

async function render(kind: ledger.LedgerKind, page: number, role = 'ACCOUNTANT') {
  const exports: any = {};
  runInNewContext(source, {exports, require: (name: string) => {
    if (name === '@/lib/auth') return {workspaceOperationalRoles: ['OWNER', 'ADMIN', 'ACCOUNTANT'], hasWorkspaceRole: (role: string, roles: string[]) => roles.includes(role), requireWorkspace: async () => ({membership: {role}, workspace: {id: 1}, company: {id: 1, name: 'Test', timeZone: 'Europe/Rome'}})};
    if (name === '@/lib/movement-ledger-export') return {ledgerExportLimit: 5000};
    if (name === '@/lib/prisma') return {prisma: {}};
    if (name === '@/lib/movement-ledger') return ledger;
    if (name === '@/lib/live-search') return liveSearch;
    if (name === '@/lib/company-time') return {dateInputInTimeZone: () => '2026-09-29'};
    if (name === '@/lib/date-format') return {formatItalianCompactDate: (value: string) => value};
    if (name === '@/lib/money') return {euro: String};
    if (name === '@/lib/movement-ledger-data') return {loadMovementLedger: async () => ({
      summary: {count: 125}, total: 125, groups: [], options: [], channels: [], page, pages: 3,
      rows: [{id: 1, documentId: 1, amount: 1, date: null, type: 'SINGLE', party: 'Test'}]
    })};
    if (name === 'react/jsx-runtime') return require(name);
    if (name === './MobileRecordViews') return {__esModule: true, default: 'MobileRecordViews', MobileRecordCloseButton: 'MobileRecordCloseButton'};
    return {__esModule: true, default: name};
  }});
  // Initial server render has no mobileList: opening the list only updates browser history.
  return exports.default({kind, searchParams: Promise.resolve({page: String(page), search: 'Acme', dateMode: 'all', sort: 'amount', direction: 'asc'})});
}

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

for (const kind of ['payments', 'credits'] as const) {
  test(`${kind}: pagination and sorting retain the open list and active filters`, async () => {
    for (const page of [1, 2, 3]) {
      const all = nodes(await render(kind, page));
      const nav = all.find(node => node.type === 'nav' && node.props['aria-label'] === 'Pagine movimenti');
      const links = nodes(nav).filter(node => node.props?.href);
      const expected = [page > 1 ? page - 1 : null, page < 3 ? page + 1 : null].filter(value => value !== null);
      assert.deepEqual(links.map(link => Number(new URL(link.props.href, 'http://test').searchParams.get('page'))), expected);
      const sorting = all.filter(node => node.type === './SortableColumnHeader');
      assert.equal(sorting.length, 7);
      for (const link of [...links, ...sorting]) {
        const url = new URL(link.props.href, 'http://test');
        assert.equal(url.pathname, kind === 'payments' ? '/expenses/payments' : '/incomes/credits');
        assert.equal(url.searchParams.get('mobileList'), '1');
        assert.equal(url.searchParams.get('search'), 'Acme');
        assert.equal(url.searchParams.get('dateMode'), 'all');
        if (sorting.includes(link)) assert.equal(url.searchParams.get('page'), '1');
        else {
          assert.equal(url.searchParams.get('sort'), 'amount');
          assert.equal(url.searchParams.get('direction'), 'asc');
        }
      }
    }
  });
}

for (const kind of ['payments', 'credits'] as const) {
  test(`${kind}: export appears beside both filter triggers with the active filters and ordering`, async () => {
    const all = nodes(await render(kind, 2));
    for (const id of ['ledger-list-filter-trigger', 'ledger-mobile-filter-trigger']) {
      const actions = all.find(node => node.props?.id === id);
      const button = nodes(actions).find(node => node.type === 'a');
      assert.equal(button.props['aria-label'], 'Esporta CSV');
      const url = new URL(button.props.href, 'http://test');
      assert.equal(url.pathname, `/api/exports/${kind}`);
      for (const [key, value] of Object.entries({search: 'Acme', dateMode: 'all', sort: 'amount', direction: 'asc', mobileList: '1'})) assert.equal(url.searchParams.get(key), value);
      assert.ok(url.searchParams.has('exportFrom') && url.searchParams.has('exportTo'));
      assert.ok(button.props.children.includes(id === 'ledger-list-filter-trigger' ? 'Esporta CSV' : null));
    }
    assert.equal(nodes(await render(kind, 1, 'VIEWER')).some(node => node.props?.['aria-label'] === 'Esporta CSV'), false);
  });
}
