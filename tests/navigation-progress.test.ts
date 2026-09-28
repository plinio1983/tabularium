import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

function setup() {
  class Element {
    attributes = new Map<string, string>();
    classes = new Set<string>();
    classList = {add: (value: string) => this.classes.add(value), remove: (value: string) => this.classes.delete(value), contains: (value: string) => this.classes.has(value)};
    dataset: Record<string, string> = {};
    target = '';
    getAttribute(name: string) {return this.attributes.get(name) ?? null;}
    hasAttribute(name: string) {return this.attributes.has(name);}
    matches() {return this.hasAttribute('data-expense-new') || this.hasAttribute('data-income-new');}
    closest() {return this;}
  }
  class Form extends Element {querySelector() {return null;}}
  const documentListeners = new Map<string, Function>();
  const windowListeners = new Map<string, Function>();
  const effects: Function[] = [];
  const timers = new Map<number, {handler: Function; delay: number}>();
  let timerId = 0;
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(new URL('../components/NavigationProgress.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
  }).outputText;
  runInNewContext(source, {exports, URL, queueMicrotask, HTMLElement: Element, HTMLFormElement: Form,
    require: (name: string) => {
      if (name === 'react') return {useRef: (value: unknown) => ({current: value}), useState: (value: unknown) => [value, () => {}], useEffect: (effect: Function) => effects.push(effect)};
      if (name === 'next/navigation') return {usePathname: () => '/expenses', useSearchParams: () => new URLSearchParams()};
      return {jsx: () => null};
    },
    document: {documentElement: new Element(), addEventListener: (name: string, handler: Function) => documentListeners.set(name, handler), removeEventListener: (name: string) => documentListeners.delete(name)},
    window: {location: {href: 'http://localhost/expenses', origin: 'http://localhost', pathname: '/expenses', search: ''},
      setTimeout: (handler: Function, delay: number) => {timers.set(++timerId, {handler, delay}); return timerId;}, clearTimeout: (id: number) => timers.delete(id),
      addEventListener: (name: string, handler: Function) => windowListeners.set(name, handler), removeEventListener: (name: string) => windowListeners.delete(name)},
  });
  exports.default();
  effects.forEach(effect => effect());
  return {Element, Form, documentListeners, windowListeners, effects, timers, flushEvents() {
    for (const [id, timer] of timers) if (timer.delay === 0) {timers.delete(id); timer.handler();}
  }};
}

for (const kind of ['expense', 'income']) {
  test(`apertura ${kind} intercettata dal pannello non lascia un loader di navigazione`, async () => {
    const {Element, documentListeners, flushEvents} = setup();
    const link = new Element();
    link.attributes.set('href', '/expenses?new=1');
    link.attributes.set(`data-${kind}-new`, '');
    const event = {target: link, button: 0, defaultPrevented: false};
    documentListeners.get('click')!(event);
    event.defaultPrevented = true;
    flushEvents();
    assert.equal(link.classes.has('navigation-pending-control'), false);
  });
}

test('conferma bulk annullata e download CSV non avviano il loader', async () => {
  const {Element, Form, documentListeners, flushEvents} = setup();
  const button = new Element(), form = new Form();
  form.attributes.set('action', '/api/expenses/bulk');
  const event = {target: form, submitter: button, defaultPrevented: false};
  documentListeners.get('submit')!(event);
  event.defaultPrevented = true;
  flushEvents();
  assert.equal(button.classes.has('navigation-pending-control'), false);
  button.attributes.set('value', 'export_csv');
  documentListeners.get('submit')!({...event, defaultPrevented: false});
  flushEvents();
  assert.equal(button.classes.has('navigation-pending-control'), false);
});

test('navigazione reale termina sul cambio pagina e sul ripristino dal browser', async () => {
  const {Element, documentListeners, windowListeners, effects, flushEvents} = setup();
  const link = new Element();
  link.attributes.set('href', '/incomes');
  const click = {target: link, button: 0, defaultPrevented: true}; // Next Link handles navigation.
  documentListeners.get('click')!(click);
  flushEvents();
  assert.equal(link.classes.has('navigation-pending-control'), true);
  effects[0]();
  assert.equal(link.classes.has('navigation-pending-control'), false);
  documentListeners.get('click')!(click);
  flushEvents();
  assert.equal(link.classes.has('navigation-pending-control'), true);
  windowListeners.get('pageshow')!();
  assert.equal(link.classes.has('navigation-pending-control'), false);
});
