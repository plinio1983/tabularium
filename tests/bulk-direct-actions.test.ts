import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

function setup(kind: 'expense' | 'income') {
  class Button {
    disabled = true;
    dataset: Record<string, string> = {};
    attributes = new Map<string, string>();
    classes = new Set<string>();
    classList = {toggle: (name: string, enabled: boolean) => enabled ? this.classes.add(name) : this.classes.delete(name)};
    setAttribute(name: string, value: string) {this.attributes.set(name, value);}
    matches() {return this.disabled || this.attributes.get('aria-disabled') === 'true' || this.classes.has('is-disabled');}
    removeAttribute(name: string) {this.attributes.delete(name);}
  }
  const copy = new Button(), shortcut = new Button(), menuCopy = new Button();
  menuCopy.dataset.bulkActionProxy = '[data-bulk-copy]';
  let selected: Array<{value: string; dataset: object}> = [];
  const exports: any = {};
  const code = readFileSync(new URL('../components/BulkSelectionController.tsx', import.meta.url), 'utf8') + '\nexport {syncDirectActionGroup};';
  runInNewContext(ts.transpileModule(code, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {
    exports, require: () => ({}), HTMLButtonElement: Button, HTMLAnchorElement: class {},
    document: {querySelectorAll: () => selected},
  });
  const group = {
    getAttribute: (name: string) => (({'data-bulk-form': `${kind}BulkForm`, 'data-copy-trigger-attr': `data-${kind}-copy-id`} as Record<string, string>)[name] ?? null),
    closest: () => ({querySelector: () => copy, querySelectorAll: () => [menuCopy]}),
    querySelector: (selector: string) => selector === '[data-bulk-copy]' ? copy : null,
    querySelectorAll: () => [shortcut],
  };
  return {copy, shortcut, menuCopy, sync(ids: string[]) {
    selected = ids.map(value => ({value, dataset: {}}));
    exports.syncDirectActionGroup(group);
  }};
}

for (const kind of ['expense', 'income'] as const) {
  test(`${kind}: Copia passa da disabilitato a copia singola e multipla`, () => {
    const {copy, shortcut, menuCopy, sync} = setup(kind);
    sync([]);
    assert.equal(copy.disabled, true);
    assert.equal(menuCopy.disabled, true);
    assert.equal(shortcut.disabled, true);
    sync(['7']);
    assert.equal(copy.disabled, false);
    assert.equal(menuCopy.disabled, false);
    assert.equal(copy.attributes.get(`data-${kind}-copy-id`), '7');
    assert.equal(copy.dataset.bulkCopyMode, 'single');
    assert.equal(shortcut.disabled, false);
    sync(['7', '8']);
    assert.equal(copy.disabled, false);
    assert.equal(menuCopy.disabled, false);
    assert.equal(copy.attributes.has(`data-${kind}-copy-id`), false);
    assert.equal(copy.dataset.bulkCopyMode, 'bulk');
    sync([]);
    assert.equal(copy.disabled, true);
    assert.equal(menuCopy.disabled, true);
    assert.equal(shortcut.disabled, true);
  });
}

function visibilitySetup() {
  type Action = {hidden: boolean; dataset: {bulkActionProxy?: string}; name: string; value: string; visible: boolean; attrs: Record<string, string>; getAttribute: (key: string) => string | null; getClientRects: () => object[]};
  function action(name = '', value = '', attrs: Record<string, string> = {}): Action {
    return {hidden: false, dataset: {}, name, value, visible: true, attrs,
      getAttribute(key) {return this.attrs[key] ?? null;},
      getClientRects() {return this.visible ? [{}] : [];}};
  }
  const copy = action(), payment = action(), exportButton = action('bulkAction', 'export_csv', {formaction: '/api/exports/expenses', formmethod: 'post'});
  const deactivate = action('bulkAction', 'deactivate');
  const copyItem = action(), paymentItem = action();
  copyItem.dataset.bulkActionProxy = '[data-bulk-copy]';
  paymentItem.dataset.bulkActionProxy = '[data-bulk-add-payment]';
  const exportItem = action('bulkAction', 'export_csv', {...exportButton.attrs});
  const deactivateItem = action('bulkAction', 'deactivate');
  const deleteItem = action('bulkAction', 'delete');
  const menu = [copyItem, paymentItem, exportItem, deactivateItem, deleteItem];
  const direct = {
    querySelector: (selector: string) => selector === '[data-bulk-copy]' ? copy : selector === '[data-bulk-add-payment]' ? payment : null,
    querySelectorAll: () => [exportButton, deactivate],
  };
  const bar = {querySelector: () => direct, querySelectorAll: () => menu};
  const exports: any = {};
  const code = readFileSync(new URL('../components/BulkSelectionController.tsx', import.meta.url), 'utf8') + '\nexport {syncActionMenuVisibility};';
  runInNewContext(ts.transpileModule(code, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText,
    {exports, require: () => ({})});
  return {copy, payment, exportButton, deactivate, copyItem, paymentItem, exportItem, deactivateItem, deleteItem,
    sync() {exports.syncActionMenuVisibility(bar);}};
}

test('le azioni direttamente visibili spariscono dal menu; Elimina resta disponibile', () => {
  const state = visibilitySetup();
  state.sync();
  for (const item of [state.copyItem, state.paymentItem, state.exportItem, state.deactivateItem]) assert.equal(item.hidden, true);
  assert.equal(state.deleteItem.hidden, false);
});

test('le azioni ritornano nel menu quando i pulsanti sono nascosti e si aggiornano al resize', () => {
  const state = visibilitySetup();
  state.copy.visible = false;
  state.payment.visible = false;
  state.exportButton.visible = false;
  state.deactivate.visible = false;
  state.sync();
  for (const item of [state.copyItem, state.paymentItem, state.exportItem, state.deactivateItem]) assert.equal(item.hidden, false);
  state.payment.visible = true;
  state.sync();
  assert.equal(state.paymentItem.hidden, true);
  assert.equal(state.copyItem.hidden, false);
  state.copy.visible = true;
  state.sync();
  assert.equal(state.copyItem.hidden, true);
});

test('azioni con destinazioni diverse non sono considerate duplicati', () => {
  const state = visibilitySetup();
  state.exportItem.attrs.formaction = '/api/exports/other';
  state.sync();
  assert.equal(state.exportItem.hidden, false);
  state.copyItem.dataset.bulkActionProxy = '[data-bulk-missing]';
  state.sync();
  assert.equal(state.copyItem.hidden, false);
});

test('conversione: selezione singola idonea, duplicati desktop/mobile e reset del collegamento', () => {
  let selected: Array<{value: string}> = [];
  const exports: any = {};
  const code = readFileSync(new URL('../components/BulkSelectionController.tsx', import.meta.url), 'utf8') + '\nexport {syncConversionAction};';
  runInNewContext(ts.transpileModule(code, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {
    exports, require: () => ({}), document: {querySelectorAll: () => selected}
  });
  for (const kind of ['expenses', 'incomes']) {
    const button = {disabled: true, title: '', dataset: {bulkForm: 'records', bulkConvert: kind, convertEligibleIds: '7,8', returnTo: '%2Fexpenses%3FmobileList%3D1', convertId: ''}, setAttribute() {}};
    for (const ids of [[], ['9'], ['7', '8']]) {
      selected = ids.map(value => ({value})); exports.syncConversionAction(button);
      assert.equal(button.disabled, true);
      assert.equal(button.dataset.convertId, '');
    }
    selected = [{value: '7'}, {value: '7'}]; exports.syncConversionAction(button);
    assert.equal(button.disabled, false);
    assert.equal(button.dataset.convertId, '7');
    selected = []; exports.syncConversionAction(button);
    assert.equal(button.disabled, true);
    assert.equal(button.dataset.convertId, '');
  }
});
