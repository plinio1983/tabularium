import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as currency from '../lib/currency-input';
import * as lines from '../lib/cash-register-lines';
import * as time from '../lib/company-time';
import {euro} from '../lib/money';
const require = createRequire(import.meta.url);
const nodes = (tree: any): any[] => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
function setup(mode = 'create', initialReceipt: any = null) {
  const states: any[] = [], refs: any[] = [], posts: any[] = [];
  const listeners = new Map<string, Function>();
  let index = 0, refIndex = 0, fail = false;
  const exports: any = {};
  const src = ts.transpileModule(readFileSync(new URL('../components/CashRegister.tsx', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  runInNewContext(src, {exports, document: {body: {}}, window: {addEventListener: (name: string, fn: Function) => listeners.set(name, fn), removeEventListener() {}}, requestAnimationFrame: (fn: Function) => fn(), crypto: {randomUUID: () => '619f9a97-725a-4f30-8b03-ab9427c51d3b'}, fetch: async (_url: string, options: any) => {posts.push(JSON.parse(options.body)); return {ok: !fail, json: async () => fail ? {error: 'DB non disponibile'} : {receipt: {id: 1}}};}, require: (name: string) => {
    if (name === 'react') return {useState(initial: any) {const i = index++; if (!(i in states)) states[i] = i === 13 ? true : i === 12 ? '619f9a97-725a-4f30-8b03-ab9427c51d3b' : typeof initial === 'function' ? initial() : initial; return [states[i], (value: any) => {states[i] = typeof value === 'function' ? value(states[i]) : value;}];}, useRef(initial: any) {const i = refIndex++; return refs[i] ?? (refs[i] = {current: initial});}, useMemo: (fn: Function) => fn(), useEffect(fn: Function) {if (fn.toString().includes('window.addEventListener')) fn();}};
    if (name === 'react-dom') return {createPortal: (tree: any) => tree};
    if (name === 'next/link') return {default: 'Link'};
    if (name === 'next/navigation') return {useRouter: () => ({push() {}, refresh() {}})};
    if (name.endsWith('CompanyTimeZoneProvider')) return {useCompanyTimeZone: () => 'Europe/Rome'};
    if (name.endsWith('currency-input')) return currency;
    if (name.endsWith('cash-register-lines')) return lines;
    if (name.endsWith('company-time')) return time;
    if (name.endsWith('FormControls')) return {SelectField: 'SelectField'};
    if (name.endsWith('money')) return {euro};
    return require(name);
  }});
  const props = {methods: [{id: 1, name: 'Cash', systemRole: 'CASH', icon: '€', defaultBankId: 1, bankRules: []}, {id: 2, name: 'Carta', systemRole: null, icon: '▣', defaultBankId: 2, bankRules: []}], banks: [{id: 1, name: 'Cassa'}], channels: [{id: 1, name: 'Negozio'}], categories: [{id: 1, name: 'Vendite'}], defaultCategoryId: 1, defaultChannelId: 1, primaryMethodId: 2, initialDate: '2026-10-14', mode, initialReceipt, returnTo: '/incomes'};
  const render = () => {index = 0; refIndex = 0; return nodes(exports.default(props));};
  const button = (label: string) => render().find(node => node.type === 'button' && (node.props.children === label || node.props['aria-label'] === label || Array.isArray(node.props.children) && (node.props.children.includes(label) || node.props.children.filter((part: any) => typeof part === 'string' || typeof part === 'number').join('').trim() === label)));
  return {render, button, posts, key(key: string, modifiers: Record<string, boolean> = {}) {const target = {matches: () => false, closest: () => null, focus() {}}; render().find(node => node.props['aria-label'] === 'Importo da aggiungere').props.ref.current = target; listeners.get('keydown')!({key, target, ...modifiers, preventDefault() {}});}, setFail() {fail = true;}, type(value: string) {for (const digit of value) button(digit).props.onClick();}};
}

test('cash register adds multiple rates, returns from methods on typing, and retains the basket on clear', () => {
  const app = setup();
  assert.equal(app.button('Aggiungi').props.disabled, true);
  assert.equal(app.button('Non Fisc.').props.disabled, true);
  app.type('1220'); app.button('Aggiungi').props.onClick();
  assert.equal(app.render().find(node => node.props.className === 'cash-register-panel-slider').props['data-methods-open'], true);
  app.type('1100');
  assert.equal(app.render().find(node => node.props.className === 'cash-register-panel-slider').props['data-methods-open'], false);
  app.button('10%').props.onClick(); app.button('Aggiungi').props.onClick();
  app.type('500'); app.button('Non Fisc.').props.onClick(); app.button('Aggiungi').props.onClick();
  assert.equal(app.button('Carta').props.disabled, true);
  app.type('100'); app.button('Azzera importo').props.onClick();
  assert.equal(app.render().find(node => node.props.className === 'cash-register-panel-slider').props['data-methods-open'], true);
  assert.ok(app.render().some(node => node.type === 'strong' && node.props.children === euro(28.2)));
  app.button('Annulla ultimo').props.onClick();
  assert.equal(app.render().find(node => node.props['aria-label'] === 'Importo da aggiungere').props.value, '5,00');
  assert.equal(app.button('Non Fisc.').props['aria-pressed'], true);
});

test('confirmation cancels without clearing amounts and final receipt has one request with all lines', async () => {
  const app = setup(); app.type('1220'); app.button('Aggiungi').props.onClick();
  app.button('Cash').props.onClick();
  assert.ok(app.render().some(node => node.props.role === 'dialog'));
  app.button('Annulla e torna al registratore').props.onClick();
  assert.equal(app.render().some(node => node.props.role === 'dialog'), false);
  app.button('Cash').props.onClick();
  assert.ok(app.button('INCASSA').props.className.includes('btn-success'));
  assert.equal(app.button('INCASSA').props.className.includes('btn-primary'), false);
  assert.ok(nodes(app.button('INCASSA')).some(node => node.props['aria-hidden'] === 'true' && node.props.children === '✓'));
  const submit = app.button('INCASSA').props.onClick;
  submit(); submit();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(app.posts.length, 1);
  assert.equal(app.posts[0].lines.length, 1);
  assert.equal(app.posts[0].lines[0].amount, 12.2);
  assert.equal(app.render().some(node => node.props.role === 'dialog'), false);
});

test('failed receipt submission keeps the confirmation and every amount for retry', async () => {
  const app = setup(); app.type('1220'); app.button('Aggiungi').props.onClick(); app.button('Cash').props.onClick(); app.setFail();
  app.button('INCASSA').props.onClick(); await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(app.render().some(node => node.props.role === 'dialog'));
  assert.ok(app.render().some(node => node.props.role === 'alert' && node.props.children === 'DB non disponibile'));
  assert.equal(app.posts[0].lines[0].amount, 12.2);
});

test('computer keyboard adds a default VAT line with Enter and clearing a draft returns to methods', () => {
  const app = setup();
  for (const digit of '1220') app.key(digit);
  app.key('Enter');
  assert.equal(app.render().find(node => node.props.className === 'cash-register-panel-slider').props['data-methods-open'], true);
  app.key('1');
  assert.equal(app.render().find(node => node.props.className === 'cash-register-panel-slider').props['data-methods-open'], false);
  app.key('Escape');
  assert.equal(app.render().find(node => node.props.className === 'cash-register-panel-slider').props['data-methods-open'], true);
});

test('editing and copying existing receipts load all lines without flattening their VAT', () => {
  const receipt = {id: 9, amount: 23.2, isFiscal: true, vatRate: 0, incomeCategoryId: 1, salesChannelId: 1, bankId: 1, paymentMethodId: 1, description: 'Originale', receiptLines: [{amount: 12.2, isFiscal: true, vatRate: 22}, {amount: 11, isFiscal: true, vatRate: 10}]};
  for (const mode of ['edit', 'copy']) {
    const app = setup(mode, receipt);
    app.button('Cash').props.onClick();
    const list = app.render().find(node => node.props['aria-label'] === 'Importi inseriti');
    assert.equal(nodes(list).filter(node => node.type === 'li').length, 2);
    assert.ok(app.render().some(node => node.type === 'strong' && node.props.children === euro(23.2)));
  }
});


test('keyboard shortcuts do not enter amounts', () => {
  const app = setup();
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'isComposing']) app.key('5', {[modifier]: true});
  assert.equal(app.button('Aggiungi').props.disabled, true);
  app.key('5');
  assert.equal(app.button('Aggiungi').props.disabled, false);
});

test('undoing an imported line preserves its description and a successful checkout permits a new basket', async () => {
  const app = setup('copy', {id: 9, amount: 12.2, isFiscal: true, vatRate: 22, incomeCategoryId: 1, salesChannelId: 1, bankId: 1, paymentMethodId: 1, receiptLines: [{amount: 12.2, isFiscal: true, vatRate: 22, description: 'Articolo originale'}]});
  app.button('Annulla ultimo').props.onClick();
  app.button('Aggiungi').props.onClick();
  app.button('Cash').props.onClick();
  app.button('INCASSA').props.onClick();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(app.posts[0].lines[0].description, 'Articolo originale');
  assert.equal(app.button('Aggiungi').props.disabled, true);
  app.type('200'); app.button('Aggiungi').props.onClick();
  assert.ok(app.render().some(node => node.type === 'strong' && node.props.children === euro(2)));
});


test('cancel receipt clears the current basket and returns to VAT entry', () => {
  const app = setup();
  app.type('1220'); app.button('Aggiungi').props.onClick();
  app.type('500'); app.button('Aggiungi').props.onClick();
  app.button('Annulla scontrino').props.onClick();
  assert.equal(app.button('Aggiungi').props.disabled, true);
  assert.equal(app.render().find(node => node.props.className === 'cash-register-panel-slider').props['data-methods-open'], false);
  assert.ok(app.render().some(node => node.type === 'strong' && node.props.children === euro(0)));
  assert.equal(app.posts.length, 0);
});


test('cash register does not expose the technical income category', () => {
  const app = setup();
  assert.equal(app.render().some(node => node.props['aria-label'] === 'Categoria'), false);
  app.type('1220'); app.button('Aggiungi').props.onClick(); app.button('Cash').props.onClick();
  assert.equal(app.render().some(node => node.type === 'dt' && node.props.children === 'Categoria'), false);
});
