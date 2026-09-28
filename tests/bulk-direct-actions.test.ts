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
