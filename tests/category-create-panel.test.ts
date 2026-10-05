import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function setup(file: string) {
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
  }).outputText;
  const states: any[] = [], refs: any[] = [], effects: any[] = [];
  let stateIndex = 0, refIndex = 0, closed = 0, restored = 0;
  const document = {body: {style: {overflow: 'auto'}}, activeElement: {focus: () => restored++},
    querySelector: (_selector: string): any => null, querySelectorAll: () => []};
  const exports: any = {};
  runInNewContext(compiled, {exports, document, require: (name: string) => {
    if (name === 'react') return {
      useState: (initial: any) => {const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], (value: any) => states[index] = value];},
      useRef: (initial: any) => {const index = refIndex++; return refs[index] ??= {current: initial};},
      useId: () => 'category-field', useEffect: (effect: any) => effects.push(effect)
    };
    if (name === 'react-dom') return {createPortal: (tree: any) => tree, useFormStatus: () => ({pending: false})};
    if (name.includes('ExpenseCategoryFormModal')) return {default: 'SharedCategoryModal'};
    if (name.includes('CategoryDeleteForm')) return {default: 'CategoryDeleteForm'};
    if (name.includes('FormControls')) return {FormField: 'FormField'};
    if (name.includes('EntityFormActions')) return {default: 'EntityFormActions'};
    return require(name);
  }});
  return {effects, document, refs, get closed() {return closed;}, get restored() {return restored;},
    render: (props: any = {}) => {stateIndex = refIndex = 0; return exports.default({action: () => {}, iconOptions: ['🧾'], onClose: () => closed++, ...props});}};
}

test('Creazione e modifica aprono lo stesso componente modale', () => {
  const create = setup('../app/settings/categories/CategoryCreatePanel.tsx');
  nodes(create.render()).find(node => node.type === 'button').props.onClick();
  const modal = nodes(create.render()).find(node => node.type === 'SharedCategoryModal');
  assert.ok(modal);
  modal.props.onClose();
  assert.equal(nodes(create.render()).some(node => node.type === 'SharedCategoryModal'), false);
  const edit = setup('../app/settings/categories/expenses/ExpenseCategoryList.tsx');
  const category = {id: 1, name: 'Servizi', code: 'SERV', icon: '🧾', protected: false, usageCount: 0};
  const props = {categories: [category], updateAction: () => {}, deleteAction: () => {}};
  nodes(edit.render(props)).find(node => node.type === 'button').props.onClick();
  assert.equal(nodes(edit.render(props)).find(node => node.type === 'SharedCategoryModal').props.category, category);
});

test('Il form usa campi e azioni condivisi e preserva i dati delle categorie protette', () => {
  const app = setup('../app/settings/categories/ExpenseCategoryFormModal.tsx');
  const all = nodes(app.render({category: {id: 3, name: 'Sistema', code: 'SYS', icon: '🧾', protected: true}}));
  assert.equal(all.find(node => node.props?.role === 'dialog').props.className, 'modal-card modal-card-wide entity-form-modal-card');
  assert.equal(all.filter(node => node.type === 'FormField').length, 3);
  const code = all.find(node => node.type === 'input' && node.props.name === 'code');
  assert.equal(code.props.readOnly, true);
  assert.equal(code.props.defaultValue, 'SYS');
  assert.equal(code.props.maxLength, 5);
  assert.equal(all.find(node => node.props?.name === 'id').props.value, 3);
  const actions = all.find(node => typeof node.type === 'function');
  assert.equal(actions.type(actions.props).type, 'EntityFormActions');
});

test('Chiusura e ripristino del focus; Escape dei suggerimenti non chiude la modale', () => {
  const app = setup('../app/settings/categories/ExpenseCategoryFormModal.tsx');
  const backdrop = nodes(app.render()).find(node => node.props?.role === 'presentation');
  const cleanup = app.effects[0]();
  assert.equal(app.document.body.style.overflow, 'hidden');
  app.document.querySelector = () => ({});
  backdrop.props.onKeyDown({key: 'Escape', stopPropagation() {}});
  assert.equal(app.closed, 0);
  app.document.querySelector = () => null;
  backdrop.props.onKeyDown({key: 'Escape', stopPropagation() {}});
  assert.equal(app.closed, 1);
  cleanup();
  assert.equal(app.document.body.style.overflow, 'auto');
  assert.equal(app.restored, 1);
});

test('Durante il salvataggio impedisce invii duplicati e chiusura accidentale', async () => {
  const app = setup('../app/settings/categories/ExpenseCategoryFormModal.tsx');
  let resolve!: () => void, calls = 0;
  const action = () => {calls++; return new Promise<void>(done => resolve = done);};
  const all = nodes(app.render({action}));
  const submit = all.find(node => node.type === 'form').props.action;
  const pending = submit(new FormData());
  await submit(new FormData());
  const backdrop = all.find(node => node.props?.role === 'presentation');
  backdrop.props.onMouseDown({target: backdrop, currentTarget: backdrop});
  assert.equal(calls, 1);
  assert.equal(app.closed, 0);
  resolve();
  await pending;
  assert.equal(app.closed, 1);
});
