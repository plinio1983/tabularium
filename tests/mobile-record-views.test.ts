import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function render(query: string, pathname = '/expenses', kind = 'expense') {
  const history: Array<{method: string; href: string}> = [];
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(new URL('../components/MobileRecordViews.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
  }).outputText;
  runInNewContext(source, {exports, URLSearchParams, require: (name: string) => {
    if (name === 'react') return {useState: () => [true, () => {}], useRef: (value: unknown) => ({current: value}), useEffect() {}};
    if (name === 'next/navigation') return {usePathname: () => pathname, useSearchParams: () => new URLSearchParams(query)};
    return require(name);
  }, window: {scrollY: 180, location: {search: query}, history: {
    pushState: (_: unknown, __: string, href: string) => history.push({method: 'push', href}),
    replaceState: (_: unknown, __: string, href: string) => history.push({method: 'replace', href})
  }}});
  const tree = exports.default({summary: 'Riepilogo', children: 'Lista', title: kind === 'income' ? 'Lista incassi' : 'Lista spese', count: 12, kind});
  return {tree, history, closeButton: exports.MobileRecordCloseButton()};
}

test('apertura conserva filtri ripetuti e ordinamento e aggiunge uno stato alla cronologia', () => {
  const {tree, history} = render('category=1&category=2&mobileSort=amount_desc');
  const link = tree.props.children[0].props.children[1];
  let prevented = false;
  link.props.onClick({preventDefault() {prevented = true;}});
  assert.equal(prevented, true);
  assert.equal(history[0].method, 'push');
  const query = new URL(history[0].href, 'http://localhost').searchParams;
  assert.deepEqual(query.getAll('category'), ['1', '2']);
  assert.equal(query.get('mobileSort'), 'amount_desc');
  assert.equal(query.get('mobileList'), '1');
});

test('chiusura di un accesso diretto resta sulle spese e mantiene i filtri', () => {
  const {tree, history, closeButton} = render('mobileList=1&residual=open');
  assert.equal(tree.props['data-list-open'], true);
  closeButton.props.onClick();
  assert.deepEqual(history, [{method: 'replace', href: '/expenses?residual=open'}]);
});

test('il link permette apertura in altra scheda', () => {
  const {tree, history} = render('');
  tree.props.children[0].props.children[1].props.onClick({ctrlKey: true, preventDefault() {assert.fail();}});
  assert.equal(history.length, 0);
});

test('incassi: apertura e chiusura mantengono ricerca e ordinamento sulla pagina corretta', () => {
  const {tree, history, closeButton} = render('customerQuick=Cliente&mobileSort=amount_desc&mobileList=1', '/incomes', 'income');
  const link = tree.props.children[0].props.children[1];
  assert.match(link.props.className, /is-income/);
  assert.equal(link.props.children[0].props.children[0], 'Visualizza incassi');
  link.props.onClick({preventDefault() {}});
  assert.equal(history[0].href, '/incomes?customerQuick=Cliente&mobileSort=amount_desc&mobileList=1');
  closeButton.props.onClick();
  assert.equal(history[1].href, '/incomes?customerQuick=Cliente&mobileSort=amount_desc');
});

for (const [pathname, kind] of [['/suppliers/7', 'expense'], ['/employees/8', 'expense'], ['/clients/9', 'income']]) {
  test(`${pathname}: apertura e chiusura dei movimenti collegati conservano il ritorno al dettaglio`, () => {
    const params = new URLSearchParams({returnTo: '/expenses?mobileList=1&supplierQuick=Test', mobileList: '1'});
    const {tree, history, closeButton} = render(params.toString(), pathname, kind);
    tree.props.children[0].props.children[1].props.onClick({preventDefault() {}});
    const opened = new URL(history[0].href, 'http://localhost');
    assert.equal(opened.pathname, pathname);
    assert.equal(opened.searchParams.get('mobileList'), '1');
    closeButton.props.onClick();
    const closed = new URL(history[1].href, 'http://localhost');
    assert.equal(closed.pathname, pathname);
    assert.equal(closed.searchParams.has('mobileList'), false);
    assert.equal(closed.searchParams.get('returnTo'), params.get('returnTo'));
  });
}
