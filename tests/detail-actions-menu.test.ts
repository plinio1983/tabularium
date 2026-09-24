import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createElement, Fragment} from 'react';

const require = createRequire(import.meta.url);
function load(file: string, mocks: Record<string, unknown>, globals = {}) {
  const exports: any = {};
  const compiled = ts.transpileModule(readFileSync(new URL(`../components/${file}.tsx`, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
  }).outputText;
  runInNewContext(compiled, {exports, require: (name: string) => mocks[name] ?? require(name), ...globals});
  return exports.default;
}

test('il menu si chiude all’esterno e con Escape restituendo il focus al burger', () => {
  const listeners = new Map<string, Function>();
  let cleanup: Function | undefined, focused = false;
  class Node {}
  const inside = new Node();
  const menu = {open: true, contains: (node: unknown) => node === inside, querySelector: () => ({focus() {focused = true;}})};
  const Menu = load('DetailActionsMenu', {
    react: {useRef: () => ({current: menu}), useEffect: (effect: Function) => {cleanup = effect();}}
  }, {Node, document: {
    addEventListener: (name: string, handler: Function) => listeners.set(name, handler),
    removeEventListener: (name: string) => listeners.delete(name)
  }});
  Menu({children: null});
  listeners.get('pointerdown')!({target: inside});
  assert.equal(menu.open, true);
  listeners.get('pointerdown')!({target: new Node()});
  assert.equal(menu.open, false);
  menu.open = true;
  listeners.get('keydown')!({key: 'Escape'});
  assert.equal(menu.open, false);
  assert.equal(focused, true);
  cleanup!();
  assert.equal(listeners.size, 0);
});

test('la scelta chiude il menu dopo gli handler, una voce disabilitata lo lascia aperto', () => {
  const menu = {open: true};
  const queued: Function[] = [];
  class Element {
    constructor(private disabled = false) {}
    closest() {return this;}
    matches() {return this.disabled;}
  }
  const Menu = load('DetailActionsMenu', {react: {useRef: () => ({current: menu}), useEffect() {}}}, {
    Element, window: {setTimeout: (callback: Function) => queued.push(callback)}
  });
  const tree = Menu({children: null});
  const click = tree.props.children[1].props.onClick;
  click({target: new Element(true)});
  assert.equal(queued.length, 0);
  click({target: new Element()});
  assert.equal(menu.open, true);
  queued[0]();
  assert.equal(menu.open, false);
});

test('il download da dettaglio usa solo il record aperto senza selezioni nella lista', () => {
  const changes: unknown[] = [];
  const Modal = load('BulkExpenseAttachmentsModal', {react: {
    useState: (initial: unknown) => [initial, (value: unknown) => changes.push(value)], useEffect() {}
  }}, {document: {querySelectorAll() {throw new Error('Non deve leggere le selezioni bulk');}}});
  const tree = Modal({formId: 'detail-download', recordIds: [28]});
  const button = tree.props.children[0];
  assert.equal(button.props.children[1].props.children, 'Scarica allegati');
  assert.equal(button.props.children[1].props.className, undefined);
  button.props.onClick();
  assert.deepEqual(changes[0], [28]);
  const disabled = Modal({formId: 'detail-download', recordIds: [28], disabled: true});
  assert.equal(disabled.props.children[0].props.disabled, true);
});

test('aggiungi spesa dal dipendente mantiene la busta paga e il dipendente precompilato', () => {
  const Panel = load('NewExpensePanel', {
    react: {useState: (initial: unknown) => [initial, () => {}], useEffect() {}},
    'next/navigation': {useRouter: () => ({})},
    '@/components/ExpenseCreationSwitcher': {default: 'expense-creation'},
    '@/lib/flash': {flashParamNames: []}
  });
  const initialExpense = {expenseType: 'PAYROLL', employeeId: 7};
  const tree = Panel({categories: [], banks: [], paymentMethods: [], suppliers: [], initialExpense, initialOpen: true, showToolbar: false});
  const modal = tree.props.children[1];
  assert.equal(modal.props['aria-label'], 'Nuova busta paga');
  const form = modal.props.children.props.children[1];
  assert.equal(form.props.initialExpense, initialExpense);
});

test('la barra conserva azioni e stati tra pulsanti desktop e menu mobile, con switch esterno', () => {
  const Bar = load('DetailActionsBar', {'./DetailActionsMenu': {default: 'detail-menu'}});
  const primary = createElement('button', {disabled: true}, 'Aggiungi pagamento');
  const secondary = createElement('button', null, 'Scarica allegati');
  const controls = createElement('form', null, 'In corso / Sospeso');
  const tree = Bar({primary, secondary, controls});
  const [switches, inline, menu] = tree.props.children;
  assert.equal(switches.props.children, controls);
  assert.equal(inline.props.children[0].props.children.props.disabled, true);
  assert.equal(menu.props.desktop, true);
  assert.equal(menu.props.children[0].props.children[0].props.children.props.disabled, true);
  assert.equal(menu.props.children[1], secondary);
});

test('senza azioni secondarie il burger è riservato al mobile', () => {
  const Bar = load('DetailActionsBar', {'./DetailActionsMenu': {default: 'detail-menu'}});
  const tree = Bar({primary: 'Modifica, Aggiungi spesa, Elimina'});
  const menu = tree.props.children[2];
  assert.equal(menu.props.desktop, false);
  assert.equal(tree.props.children[1].props.children[0].props.children, menu.props.children[0].props.children[0].props.children);
});

test('i pulsanti esterni usano btn-default e le stesse azioni nel burger mantengono btn-option', () => {
  const Bar = load('DetailActionsBar', {'./DetailActionsMenu': {default: 'detail-menu'}});
  const action = createElement('button', {className: 'btn btn-sm btn-option detail-actions-delete', disabled: true}, 'Elimina');
  const primary = createElement(Fragment, null, action);
  const tree = Bar({primary});
  const inline = tree.props.children[1].props.children[0].props.children;
  const mobile = tree.props.children[2].props.children[0].props.children[0].props.children;
  assert.equal(inline.props.className, 'btn btn-sm btn-default detail-actions-delete');
  assert.equal(inline.props.disabled, true);
  assert.equal(mobile.props.className, 'btn btn-sm btn-option detail-actions-delete');
});

test('le azioni nei fragment mantengono ordine e corrispondenza tra barra e menu', () => {
  const Bar = load('DetailActionsBar', {'./DetailActionsMenu': {default: 'detail-menu'}});
  const primary = createElement(Fragment, null,
    createElement('button', {key: 'edit'}, 'Modifica'),
    createElement(Fragment, null,
      createElement('button', {key: 'copy'}, 'Copia'),
      createElement('button', {key: 'payment'}, 'Aggiungi pagamento')));
  const tree = Bar({primary});
  const labels = (items: any[]) => Array.from(items, item => item.props.children.props.children);
  assert.deepEqual(labels(tree.props.children[1].props.children), ['Modifica', 'Copia', 'Aggiungi pagamento']);
  assert.deepEqual(labels(tree.props.children[2].props.children[0].props.children), ['Modifica', 'Copia', 'Aggiungi pagamento']);
});
