import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as helpers from '../lib/page-transition';

function setup({mobile = true, reduced = false} = {}) {
  const listeners = new Map<string, Function>();
  const refs: any[] = [];
  let hook = 0, pathname = '/expenses', params = new URLSearchParams();
  const effects: Function[] = [], layoutEffects: Function[] = [];
  const slides: any[] = [];
  const layers: any[] = [];
  class Element {
    style = {};
    inert = false;
    className = '';
    target = '';
    href = 'http://localhost/expenses/42';
    attributes = new Map<string, string>();
    children: Element[] = [];
    removed = false;
    closest() { return this; }
    hasAttribute(name: string) { return this.attributes.has(name); }
    getAttribute(name: string) { return this.attributes.get(name) ?? (name === 'href' ? this.href : null); }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return {top: -120, left: 12, width: 366}; }
    cloneNode() { return new Element(); }
    append(node: Element) { this.children.push(node); }
    attachShadow() { return new Element(); }
    remove() { this.removed = true; }
    animate(frames: unknown, options: unknown) {
      const slide = {frames, options, cancelled: false, finished: new Promise<void>(() => {}), cancel() {this.cancelled = true;}};
      slides.push(slide);
      return slide;
    }
  }
  const content = new Element();
  const history = {state: {__NA: true, tree: 'preserved'} as any, replaceState(state: unknown) {this.state = state;}};
  const location = {href: 'http://localhost/expenses', pathname, origin: 'http://localhost'};
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(new URL('../components/MobilePageTransition.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
  }).outputText;
  runInNewContext(source, {exports, URL, Element, setTimeout: () => 1, clearTimeout() {},
    require(name: string) {
      if (name === 'react') return {
        useRef(value: unknown) {const index = hook++; return refs[index] ?? (refs[index] = {current: value});},
        useEffect(effect: Function) {effects.push(effect);}, useLayoutEffect(effect: Function) {layoutEffects.push(effect);}
      };
      if (name === 'next/navigation') return {usePathname: () => pathname, useSearchParams: () => params};
      return helpers;
    },
    document: {styleSheets: [], querySelector: () => content, createElement: () => new Element(), body: {append(node: Element) {layers.push(node);}},
      addEventListener(name: string, handler: Function) {listeners.set(name, handler);}, removeEventListener(name: string) {listeners.delete(name);}},
    window: {history, location, matchMedia(query: string) {return {matches: query.includes('reduced') ? reduced : mobile, addEventListener() {}, removeEventListener() {}};},
      addEventListener(name: string, handler: Function) {listeners.set(name, handler);}, removeEventListener(name: string) {listeners.delete(name);}}
  });
  exports.default();
  layoutEffects.forEach(effect => effect());
  const cleanup = effects[0]();
  return {slides, layers, history, cleanup,
    click(href = '/expenses/42', extra = {}, attributes: Record<string, string> = {}) {
      const link = new Element(); link.href = `http://localhost${href}`;
      for (const [key, value] of Object.entries(attributes)) link.attributes.set(key, value);
      listeners.get('click')!({target: link, button: 0, ...extra});
    },
    route(to: string) {
      const url = new URL(to, location.origin);
      pathname = url.pathname; params = url.searchParams; location.pathname = pathname; location.href = url.href; hook = 0;
      exports.default();
      layoutEffects.at(-1)!();
    },
    pop(to: string, index: number) {
      location.pathname = new URL(to, location.origin).pathname; location.href = new URL(to, location.origin).href; history.state = {...history.state, tabulariumPageIndex: index};
      listeners.get('popstate')!({state: history.state});
    }
  };
}

test('mobile navigation slides both pages and cleans up its inert snapshot', () => {
  const app = setup();
  app.click(); app.route('/expenses/42');
  assert.equal(app.slides.length, 2);
  assert.equal(app.slides[0].frames[0].transform, 'translateX(100%)');
  assert.equal(app.slides[1].frames[1].transform, 'translateX(-100%)');
  assert.equal(app.layers[0].inert, true);
  assert.equal(app.history.state.tree, 'preserved');
  app.cleanup();
  assert.equal(app.layers[0].removed, true);
  assert.ok(app.slides.every(slide => slide.cancelled));
});

test('browser Back and Forward reverse the slide without rewriting entry indexes', () => {
  const app = setup();
  app.click(); app.route('/expenses/42');
  app.pop('/expenses', 0); app.route('/expenses');
  assert.equal(app.slides[2].frames[0].transform, 'translateX(-100%)');
  assert.equal(app.history.state.tabulariumPageIndex, 0);
  app.pop('/expenses/42', 1); app.route('/expenses/42');
  assert.equal(app.slides[4].frames[0].transform, 'translateX(100%)');
  assert.equal(app.history.state.tabulariumPageIndex, 1);
  app.cleanup();
});

test('desktop, reduced motion, initial render and query changes do not animate', () => {
  for (const options of [{mobile: false}, {reduced: true}]) {
    const app = setup(options);
    app.click(); app.route('/expenses/42');
    assert.equal(app.slides.length, 0);
    app.cleanup();
  }
  const app = setup();
  assert.equal(app.slides.length, 0);
  app.click('/expenses?mobileList=1'); app.route('/expenses');
  assert.equal(app.slides.length, 0);
  app.cleanup();
});

test('modified clicks do not capture an outgoing page', () => {
  const app = setup();
  app.click('/expenses/42', {ctrlKey: true});
  app.route('/expenses/42');
  assert.equal(app.layers.length, 0);
  app.cleanup();
});

test('settings pages and payment sections slide forward and reverse on return', () => {
  const app = setup();
  for (const to of ['/settings', '/settings/categories', '/settings/categories/expenses']) {
    app.click(to); app.route(to);
    assert.equal(app.slides.at(-2).frames[0].transform, 'translateX(100%)');
  }
  app.click('/settings/categories'); app.route('/settings/categories');
  assert.equal(app.slides.at(-2).frames[0].transform, 'translateX(-100%)');
  app.click('/settings/payment-credit'); app.route('/settings/payment-credit');
  app.click('/settings/payment-credit?section=banks'); app.route('/settings/payment-credit?section=banks');
  assert.equal(app.slides.at(-2).frames[0].transform, 'translateX(100%)');
  app.click('/settings/payment-credit'); app.route('/settings/payment-credit');
  assert.equal(app.slides.at(-2).frames[0].transform, 'translateX(-100%)');
  app.pop('/settings/payment-credit?section=banks', 6); app.route('/settings/payment-credit?section=banks');
  assert.equal(app.slides.at(-2).frames[0].transform, 'translateX(-100%)');
  app.cleanup();
});

test('explicit Back links return across unrelated routes and retain filtered URLs', () => {
  const app = setup();
  for (const [from, to] of [
    ['/account/workspace', '/settings'],
    ['/suppliers/42', '/expenses?period=custom&mobileList=1'],
    ['/expenses/42', '/months/2026/9?mode=fiscal'],
    ['/incomes/cash-register', '/incomes/cash-register/receipts?mobileList=1']
  ]) {
    app.route(from);
    app.click(to, {}, {'data-page-transition': 'backward'}); app.route(to);
    assert.equal(app.slides.at(-2).frames[0].transform, 'translateX(-100%)');
    assert.equal(app.slides.at(-1).frames[1].transform, 'translateX(100%)');
  }
  app.cleanup();
});

test('programmatic return buttons use the same backward transition', () => {
  const app = setup();
  app.route('/incomes/cash-register');
  const to = '/incomes/cash-register/receipts?mobileList=1';
  app.click(to, {}, {'data-page-transition-back': to}); app.route(to);
  assert.equal(app.slides.at(-2).frames[0].transform, 'translateX(-100%)');
  app.cleanup();
});
