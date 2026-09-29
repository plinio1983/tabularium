import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../components/InfoHint.tsx', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
}).outputText;
function setup(open: boolean) {
  const effects: Function[] = [], updates: boolean[] = [], events = new Map<string, Function>();
  const refs: any[] = [];
  const document = {body: {style: {overflow: 'auto'}}};
  const exports: any = {};
  runInNewContext(source, {exports, document, window: {
    addEventListener: (name: string, fn: Function, capture: boolean) => {assert.equal(capture, true); events.set(name, fn);},
    removeEventListener: (name: string) => events.delete(name),
  }, require: (name: string) => {
    if (name === 'react') return {
      useState: () => [open, (value: boolean) => updates.push(value)],
      useRef: () => {const ref = {current: null}; refs.push(ref); return ref;},
      useId: () => 'info-title', useEffect: (fn: Function) => effects.push(fn)
    };
    if (name === 'react-dom') return {createPortal: (node: unknown) => node};
    return require(name);
  }});
  const tree = exports.default({title: 'Periodo fiscale', children: 'Spiegazione'});
  return {tree, refs, effects, updates, events, document};
}

test('il pulsante informativo non invia il form e non apre o chiude la sezione', () => {
  const app = setup(false), button = app.tree.props.children[0];
  assert.equal(button.props.type, 'button');
  assert.equal(button.props['aria-label'], 'Informazioni: Periodo fiscale');
  let prevented = false, stopped = false;
  button.props.onClick({preventDefault() {prevented = true;}, stopPropagation() {stopped = true;}});
  assert.equal(prevented && stopped, true);
  assert.deepEqual(app.updates, [true]);
  assert.equal(app.tree.props.children[2], null);
  assert.equal(app.tree.props.children[1].props.className, 'info-hint-desktop-text');
  assert.equal(app.tree.props.children[1].props.children, 'Spiegazione');
});

test('il modal usa il livello nativo, intercetta Escape e ripristina focus e scorrimento', () => {
  const app = setup(true);
  let shown = false, closed = false, focused = false, stopped = false;
  app.refs[0].current = {showModal() {shown = true;}, close() {closed = true;}};
  app.refs[1].current = {focus() {focused = true;}};
  const cleanup = app.effects[0]();
  assert.equal(shown, true);
  assert.equal(app.document.body.style.overflow, 'hidden');
  assert.equal(app.tree.props.children[2].type, 'dialog');
  assert.equal(app.tree.props.children[2].props['aria-labelledby'], 'info-title');
  app.events.get('keydown')!({key: 'Escape', preventDefault() {}, stopImmediatePropagation() {stopped = true;}});
  assert.equal(stopped, true);
  assert.deepEqual(app.updates, [false]);
  cleanup();
  assert.equal(closed && focused, true);
  assert.equal(app.document.body.style.overflow, 'auto');
  assert.equal(app.events.size, 0);
});
